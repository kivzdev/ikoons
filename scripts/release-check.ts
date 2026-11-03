// Runs before `npm publish` (packages/icons prepublishOnly): stops the release while any drawing in icons/ is still a
// placeholder (marked data-placeholder, or a comment saying so). Kivz draws the set; stand-ins never ship.

import { readdir, readFile } from 'node:fs/promises'

const root = new URL('../icons/', import.meta.url)
const left: string[] = []
for (const weight of ['filled', 'outline']) {
  const dir = new URL(`${weight}/`, root)
  for (const file of (await readdir(dir).catch(() => [] as string[])).filter(f => f.endsWith('.svg'))) {
    const text = await readFile(new URL(file, dir), 'utf8')
    if (/data-placeholder|<!--[^>]*placeholder/i.test(text)) left.push(`icons/${weight}/${file}`)
  }
}
if (left.length) {
  console.error(`Not publishing: ${left.length} drawing${left.length > 1 ? 's are' : ' is'} still a placeholder — replace ${left.length > 1 ? 'them' : 'it'} with the real drawing (or take the icon out) first:\n${left.map(f => `  ${f}`).join('\n')}`)
  process.exit(1)
}
console.log('no placeholders left')
