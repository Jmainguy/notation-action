import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import {execFileSync} from 'node:child_process'
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {assetName, expectedChecksum, normalizeVersion, sha256} from './lib.js'

const repository = 'notaryproject/notation'

async function latestVersion(): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: {'user-agent': 'Jmainguy/notation-action'}
  })
  if (!response.ok) throw new Error(`Unable to resolve latest Notation release: HTTP ${response.status}`)
  const release = (await response.json()) as {tag_name?: string}
  if (!release.tag_name) throw new Error('Latest Notation release did not include tag_name')
  return normalizeVersion(release.tag_name)
}

async function install(version: string): Promise<string> {
  const cached = toolCache.find('notation', version, process.arch)
  if (cached) {
    core.addPath(cached)
    return join(cached, process.platform === 'win32' ? 'notation.exe' : 'notation')
  }

  const asset = assetName(version, process.platform, process.arch)
  const baseUrl = `https://github.com/${repository}/releases/download/v${version}`
  const [archive, checksumFile] = await Promise.all([
    toolCache.downloadTool(`${baseUrl}/${asset}`),
    toolCache.downloadTool(`${baseUrl}/notation_${version}_checksums.txt`)
  ])
  const expected = expectedChecksum(readFileSync(checksumFile, 'utf8'), asset)
  const actual = sha256(archive)
  if (actual !== expected) throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`)

  const extracted = process.platform === 'win32'
    ? await toolCache.extractZip(archive)
    : await toolCache.extractTar(archive)
  const cachedPath = await toolCache.cacheDir(extracted, 'notation', version, process.arch)
  core.addPath(cachedPath)
  return join(cachedPath, process.platform === 'win32' ? 'notation.exe' : 'notation')
}

function requiredInput(name: string): string {
  const value = core.getInput(name)
  if (!value) throw new Error(`Input ${name} is required when artifact is provided`)
  return value
}

function signAndVerify(binary: string, artifact: string): void {
  const keyName = core.getInput('key-name') || 'notation-action'
  const signatureFormat = core.getInput('signature-format') || 'jws'
  const privateKey = requiredInput('private-key')
  const certificateChain = requiredInput('certificate-chain')
  const caCertificate = requiredInput('ca-certificate')
  const username = requiredInput('username')
  const password = requiredInput('password')
  core.setSecret(privateKey)
  core.setSecret(certificateChain)
  core.setSecret(caCertificate)
  core.setSecret(password)

  const workDir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'notation-action-'))
  try {
    const configRoot = join(workDir, 'config')
    const notationDir = join(configRoot, 'notation')
    const trustStore = join(notationDir, 'truststore', 'x509', 'ca', 'release')
    const keyPath = join(workDir, 'signer.key')
    const certificatePath = join(workDir, 'certificate-chain.pem')
    mkdirSync(trustStore, {recursive: true, mode: 0o700})
    writeFileSync(keyPath, privateKey, {mode: 0o600})
    writeFileSync(certificatePath, certificateChain, {mode: 0o600})
    writeFileSync(join(trustStore, 'ca.crt'), caCertificate, {mode: 0o600})
    chmodSync(workDir, 0o700)
    writeFileSync(join(notationDir, 'signingkeys.json'), JSON.stringify({
      default: keyName,
      keys: [{name: keyName, keyPath, certPath: certificatePath}]
    }))
    const scope = artifact.split('@', 1)[0]
    writeFileSync(join(notationDir, 'trustpolicy.json'), JSON.stringify({
      version: '1.0',
      trustPolicies: [{
        name: 'release',
        registryScopes: [scope],
        signatureVerification: {level: 'strict'},
        trustStores: ['ca:release'],
        trustedIdentities: ['*']
      }]
    }))
    const env = {...process.env, XDG_CONFIG_HOME: configRoot, NOTATION_USERNAME: username, NOTATION_PASSWORD: password}
    execFileSync(binary, ['sign', '--key', keyName, '--signature-format', signatureFormat, artifact], {env, stdio: 'inherit'})
    execFileSync(binary, ['verify', artifact], {env, stdio: 'inherit'})
  } finally {
    rmSync(workDir, {recursive: true, force: true})
  }
}

export async function run(): Promise<void> {
  try {
    const requested = core.getInput('version') || 'latest'
    const version = requested === 'latest' ? await latestVersion() : normalizeVersion(requested)
    const binary = await install(version)
    core.setOutput('version', version)
    execFileSync(binary, ['version'], {stdio: 'inherit'})

    const artifact = core.getInput('artifact')
    if (artifact) signAndVerify(binary, artifact)
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

void run()
