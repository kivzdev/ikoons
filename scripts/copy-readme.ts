// `npm pack` / `npm publish` of packages/icons: the package carries the repo's README and LICENSE (they live at the
// root, where GitHub shows them), with the README's relative links made absolute so they work on npm too.

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const pkg = new URL('packages/icons/', root)
const REPO = 'https://github.com/kivzdev/ikoons/blob/main/'

const readme = await readFile(new URL('README.md', root), 'utf8')
await writeFile(
  new URL('README.md', pkg),
  readme.replace(/\]\((?!https?:|#|mailto:)([^)]+)\)/g, (_, path: string) => `](${REPO}${path.replace(/^\.\//, '')})`),
)
await copyFile(new URL('LICENSE', root), new URL('LICENSE', pkg))
console.log(`copied README.md and LICENSE into ${fileURLToPath(pkg)}`)
