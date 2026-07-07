// Launch-argument parsing, kept free of Electron imports so it is unit-testable.

export const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.markdn', '.mkd', '.mkdn']

/**
 * Extract a markdown file path from a process argv array.
 * Handles both dev (electron . file.md) and packaged (MARKMARK.exe file.md) invocations,
 * and skips electron/chromium flags.
 * @param {string[]} argv
 * @param {{isDev: boolean, exists: (p: string) => boolean}} env
 */
export function findFilePathInArgv(argv, { isDev, exists }) {
  // In dev, argv = [electronBinary, '.', ...maybe file]. In prod, argv = [exe, ...args].
  const args = argv.slice(isDev ? 2 : 1)
  for (const arg of args) {
    if (!arg || arg.startsWith('-')) continue
    if (arg === '.') continue
    const lower = arg.toLowerCase()
    if (MD_EXTENSIONS.some((ext) => lower.endsWith(ext)) && exists(arg)) {
      return arg
    }
  }
  return null
}
