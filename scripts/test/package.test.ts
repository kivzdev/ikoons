// @vitest-environment node
// The package as it ships: built with its own tsconfig into a scratch folder in the repo (so it finds React), then
// imported by Node as plain ESM and rendered on the "server", and bundled to see that unused icons fall away.
import { execFileSync } from 'node:child_process'
import { readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generate } from '../generate.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const pkg = join(root, 'packages/icons')
const out = join(pkg, '.test-dist')

beforeAll(async () => {
  await generate()
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(pkg, 'tsconfig.build.json'), '--outDir', out], { stdio: 'pipe' })
}, 60_000)
afterAll(() => rm(out, { recursive: true, force: true }))

describe('the built package', () => {
  it('has an ES module and its types for every source module', async () => {
    const files = await readdir(join(out, 'icons'))
    const icons = files.filter(f => f.endsWith('.js'))
    expect(icons.length).toBeGreaterThan(20)
    for (const js of icons) expect(files).toContain(js.replace(/\.js$/, '.d.ts'))
    for (const f of ['index.js', 'index.d.ts', 'motion.js', 'motion.d.ts']) expect(await readdir(out)).toContain(f)
  })

  it('keeps the client directive at the top of every component module', async () => {
    const heart = await readFile(join(out, 'icons/heart.js'), 'utf8')
    expect(heart.split('\n').find(l => !l.startsWith('//'))).toBe(`'use client';`)
    expect(await readFile(join(out, 'core/create.js'), 'utf8')).toMatch(/^'use client';/)
  })

  it('runs in Node as it is, and renders on a server', async () => {
    const lib = await import(pathToFileURL(join(out, 'index.js')).href)
    const html = renderToString(createElement(lib.Heart, { size: 20 }))
    expect(html).toMatch(/^<svg[^>]+viewBox="0 0 24 24"[^>]+width="20"[^>]+height="20"/)
    expect(html).toContain('data-kz-icon="heart"')
    expect(lib.HeartIcon).toBe(lib.Heart)
  })

  it('leaves out every icon you don’t import', async () => {
    const bundle = await build({
      stdin: { contents: `import { Heart } from '${join(out, 'index.js')}'; console.log(Heart)`, resolveDir: root, loader: 'js' },
      bundle: true,
      minify: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      external: ['react', 'react/jsx-runtime'],
      logLevel: 'silent',
    })
    const code = bundle.outputFiles[0].text
    const heart = (await readFile(join(pkg, 'src/icons/heart.ts'), 'utf8')).match(/d:"([^"]+)"/)![1]
    const bell = (await readFile(join(pkg, 'src/icons/bell.ts'), 'utf8')).match(/d:"([^"]+)"/)![1]
    expect(code).toContain(heart)
    expect(code).not.toContain(bell)
    // (and with it only the motion it plays: no morphing, no other recipes' code)
    expect(code).not.toContain('getPointAtLength')
  })
})
