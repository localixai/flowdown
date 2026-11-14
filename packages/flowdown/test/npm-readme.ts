/**
 * The package's README on npm (`packages/flowdown/README.md`), as `scripts/readme.ts` writes it
 * from the repository's README: one text, its links made absolute (npm resolves none against the
 * repository), its Development section left out (it is about working on the repository, not
 * using the package). Test and script only.
 */

const RAW = 'https://raw.githubusercontent.com/localixai/flowdown/main/'
const BLOB = 'https://github.com/localixai/flowdown/blob/main/'

/** The repository's README, and where the package's copy goes. */
export const ROOT_README = new URL('../../../README.md', import.meta.url)
export const NPM_README = new URL('../README.md', import.meta.url)

const relative = (target: string): boolean => !/^(?:[a-z]+:|#|\/)/.test(target)

/** The package's README from the repository's. */
export function npmReadme(root: string): string {
  const withoutDevelopment = root.replace(/\n## Development\n[\s\S]*?(?=\n## )/, '\n')
  return withoutDevelopment
    .replace(/\b(src|srcset)="([^"]+)"/g, (whole, name: string, target: string) =>
      relative(target) ? `${name}="${RAW}${target}"` : whole,
    )
    .replace(/\bhref="([^"]+)"/g, (whole, target: string) =>
      relative(target) ? `href="${BLOB}${target}"` : whole,
    )
    .replace(/\]\(([^)\s]+)\)/g, (whole, target: string) =>
      relative(target) ? `](${BLOB}${target})` : whole,
    )
}
