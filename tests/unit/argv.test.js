import { describe, it, expect } from 'vitest'
import { findFilePathInArgv, MD_EXTENSIONS } from '../../src/main/argv.js'

const existsAll = () => true

describe('findFilePathInArgv', () => {
  it('extracts the file in packaged mode (exe, file)', () => {
    const argv = ['C:\\Program Files\\MARKMARK\\MARKMARK.exe', 'C:\\docs\\readme.md']
    expect(findFilePathInArgv(argv, { isDev: false, exists: existsAll })).toBe('C:\\docs\\readme.md')
  })

  it('extracts the file in dev mode (electron, ".", file)', () => {
    const argv = ['electron', '.', 'C:\\docs\\readme.md']
    expect(findFilePathInArgv(argv, { isDev: true, exists: existsAll })).toBe('C:\\docs\\readme.md')
  })

  it('skips chromium/electron flags and "."', () => {
    const argv = ['MARKMARK.exe', '--allow-file-access', '-x', '.', 'C:\\a.md']
    expect(findFilePathInArgv(argv, { isDev: false, exists: existsAll })).toBe('C:\\a.md')
  })

  it('matches extensions case-insensitively', () => {
    const argv = ['MARKMARK.exe', 'C:\\NOTES.MD']
    expect(findFilePathInArgv(argv, { isDev: false, exists: existsAll })).toBe('C:\\NOTES.MD')
  })

  it.each(MD_EXTENSIONS)('accepts %s files', (ext) => {
    const argv = ['MARKMARK.exe', `C:\\doc${ext}`]
    expect(findFilePathInArgv(argv, { isDev: false, exists: existsAll })).toBe(`C:\\doc${ext}`)
  })

  it('rejects non-markdown files', () => {
    const argv = ['MARKMARK.exe', 'C:\\image.png']
    expect(findFilePathInArgv(argv, { isDev: false, exists: existsAll })).toBeNull()
  })

  it('rejects paths that do not exist', () => {
    const argv = ['MARKMARK.exe', 'C:\\ghost.md']
    expect(findFilePathInArgv(argv, { isDev: false, exists: () => false })).toBeNull()
  })

  it('returns null when only the executable is present', () => {
    expect(findFilePathInArgv(['MARKMARK.exe'], { isDev: false, exists: existsAll })).toBeNull()
  })
})
