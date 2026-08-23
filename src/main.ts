import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
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

export async function run(): Promise<void> {
  try {
    const requested = core.getInput('version') || 'latest'
    const version = requested === 'latest' ? await latestVersion() : normalizeVersion(requested)
    const cached = toolCache.find('notation', version, process.arch)
    if (cached) {
      core.addPath(cached)
      core.setOutput('version', version)
      return
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
    core.setOutput('version', version)

    const binary = join(cachedPath, process.platform === 'win32' ? 'notation.exe' : 'notation')
    execFileSync(binary, ['version'], {stdio: 'inherit'})
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

void run()
