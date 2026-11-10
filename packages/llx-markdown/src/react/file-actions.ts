/** What a code block's buttons do with its text: put it on the clipboard, or save it as a file. */

/**
 * Puts `text` on the clipboard. The Clipboard API where the page has it; on an insecure origin, or
 * where it is refused, a selected hidden textarea and the old copy command, which still works on a
 * click. Resolves whether the text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Refused (an insecure origin, a denied permission): try the textarea.
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  const active = document.activeElement as HTMLElement | null
  document.body.append(area)
  area.focus()
  area.select()
  let copied = false
  try {
    // oxlint-disable-next-line typescript/no-deprecated -- the one copy that works without the API
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  area.remove()
  active?.focus()
  return copied
}

/** Saves `text` as a file named `name`, through a temporary `a[download]`. */
export function downloadFile(text: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked a moment later: a browser that starts the download after this task still finds it.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** The file extension of a fence's language, for a code block saved without a title. */
const EXTENSIONS: Record<string, string> = {
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  js: 'js',
  javascript: 'js',
  jsx: 'jsx',
  json: 'json',
  sh: 'sh',
  bash: 'sh',
  shell: 'sh',
  zsh: 'sh',
  py: 'py',
  python: 'py',
  css: 'css',
  html: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  md: 'md',
  markdown: 'md',
}

/**
 * The name a code block is saved under: the file its fence names (`title="src/app.ts"`, its last
 * path segment), or `code.<ext>` from its language, `code.txt` when the language is unknown.
 */
export function codeFileName(title: string | undefined, language: string | undefined): string {
  const named = title?.split(/[\\/]/).pop()?.trim()
  if (named) return named
  return `code.${(language && EXTENSIONS[language.toLowerCase()]) || 'txt'}`
}
