import {describe, expect, test} from 'vitest'
import {assetName, expectedChecksum, normalizeVersion} from '../src/lib.js'

describe('release resolution', () => {
  test('normalizes tags', () => expect(normalizeVersion('v1.3.2')).toBe('1.3.2'))
  test('maps Linux x64 assets', () => expect(assetName('1.3.2', 'linux', 'x64')).toBe('notation_1.3.2_linux_amd64.tar.gz'))
  test('maps Windows assets', () => expect(assetName('1.3.2', 'win32', 'x64')).toBe('notation_1.3.2_windows_amd64.zip'))
  test('finds an exact checksum', () => {
    const hash = 'a'.repeat(64)
    expect(expectedChecksum(`${hash}  notation_1.3.2_linux_amd64.tar.gz\n`, 'notation_1.3.2_linux_amd64.tar.gz')).toBe(hash)
  })
})
