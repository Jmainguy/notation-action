import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/, '')
}

export function assetName(version: string, platform: NodeJS.Platform, arch: string): string {
  const os = platform === 'win32' ? 'windows' : platform
  const cpu = arch === 'x64' ? 'amd64' : arch === 'arm' ? 'armv7' : arch
  const extension = platform === 'win32' ? 'zip' : 'tar.gz'

  if (!['linux', 'darwin', 'windows'].includes(os)) {
    throw new Error(`Unsupported operating system: ${platform}`)
  }
  if (!['amd64', 'arm64', 'armv7'].includes(cpu)) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }

  return `notation_${version}_${os}_${cpu}.${extension}`
}

export function expectedChecksum(checksums: string, asset: string): string {
  for (const line of checksums.split(/\r?\n/)) {
    const [hash, file] = line.trim().split(/\s+/, 2)
    if (file === asset && /^[a-f0-9]{64}$/i.test(hash)) return hash.toLowerCase()
  }
  throw new Error(`Checksum not found for ${asset}`)
}

export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
