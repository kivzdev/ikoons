import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// The preview reads the library from its source, so it always shows the code (and the drawings) as they are.
const root = fileURLToPath(new URL('..', import.meta.url))
const lib = (path: string) => fileURLToPath(new URL(`../packages/icons/src/${path}`, import.meta.url))

/** reruns the build's generator whenever a drawing (or the catalog) changes, so a new SVG shows up as it's saved */
function drawings(): Plugin {
  let running: Promise<void> | null = null
  let again = false
  const gen = (log: (s: string) => void) => {
    if (running) {
      again = true
      return running
    }
    running = new Promise<void>(done => {
      execFile(process.execPath, ['scripts/generate.ts'], { cwd: root }, (err, stdout, stderr) => {
        log((err ? stderr || err.message : stdout).trim())
        running = null
        done()
        if (again) {
          again = false
          void gen(log)
        }
      })
    })
    return running
  }
  return {
    name: 'ikoons-drawings',
    async configureServer(server) {
      const log = (s: string) => s && server.config.logger.info(s, { timestamp: true })
      server.watcher.add(`${root}icons`)
      server.watcher.on('all', (_, file) => {
        if (file.startsWith(`${root}icons`) && (file.endsWith('.svg') || /(catalog|more)\.ts$/.test(file))) void gen(log)
      })
    },
  }
}

/**
 * The set is five thousand icons: the page can't load them all at once. `virtual:ikoons-index` is the list (each
 * group's drawn icons, by name: cheap), and `virtual:ikoons-group/<id>` is one group's components — its own chunk,
 * loaded when the group comes near the screen (or a search finds something in it).
 */
function groups(): Plugin {
  const INDEX = 'virtual:ikoons-index'
  const GROUP = 'virtual:ikoons-group/'
  let fresh = 0
  const catalog = async () => {
    const m = await import(`${pathToFileURL(`${root}icons/catalog.ts`).href}?v=${fresh}`)
    return m.allGroups as { id: string; title: string; icons: { name: string }[] }[]
  }
  const drawn = (name: string) => existsSync(lib(`icons/${name}.ts`))
  return {
    name: 'ikoons-groups',
    configureServer(s) {
      // the catalog or the generated modules changed: the list and the groups are made again
      s.watcher.on('all', (_, file) => {
        if (!/icons[/\\](catalog|more)\.ts$|src[/\\]icons[/\\]index\.ts$/.test(file)) return
        fresh++
        for (const m of s.moduleGraph.idToModuleMap.values()) if (m.id?.startsWith('\0virtual:ikoons-')) s.moduleGraph.invalidateModule(m)
        s.ws.send({ type: 'full-reload' })
      })
    },
    resolveId(id) {
      if (id === INDEX || id.startsWith(GROUP)) return '\0' + id
    },
    async load(id) {
      if (id === '\0' + INDEX) {
        const index = (await catalog()).map(g => ({ id: g.id, title: g.title, names: g.icons.map(e => e.name).filter(drawn) })).filter(g => g.names.length)
        const loaders = index.map(g => `  ${JSON.stringify(g.id)}: () => import(${JSON.stringify(GROUP + g.id)}),`).join('\n')
        return `export const index = ${JSON.stringify(index)}\nexport const loaders = {\n${loaders}\n}`
      }
      if (id.startsWith('\0' + GROUP)) {
        const gid = id.slice(GROUP.length + 1)
        const g = (await catalog()).find(x => x.id === gid)
        const names = g ? g.icons.map(e => e.name).filter(drawn) : []
        // (each module exports its component under its own name: take the one that's an icon)
        return [
          ...names.map((n, i) => `import * as m${i} from ${JSON.stringify(lib(`icons/${n}.ts`))}`),
          `const pick = m => Object.values(m).find(v => v && v.data)`,
          `export default [${names.map((_, i) => `pick(m${i})`).join(', ')}]`,
        ].join('\n')
      }
    },
  }
}

/**
 * `virtual:ikoons-hero`: a few hundred of the set's drawings picked at random (filled where there is one), as bare SVG
 * markup in currentColor — the banner's background (Hero.tsx) shuffles them again on every visit
 */
function hero(): Plugin {
  const ID = 'virtual:ikoons-hero'
  return {
    name: 'ikoons-hero',
    resolveId: id => (id === ID ? '\0' + id : undefined),
    load(id) {
      if (id !== '\0' + ID) return
      const names = readdirSync(`${root}icons/outline`).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4))
      const picked = names.sort(() => Math.random() - 0.5).slice(0, 320)
      const markup = picked.map(n => {
        const file = existsSync(`${root}icons/filled/${n}.svg`) ? `${root}icons/filled/${n}.svg` : `${root}icons/outline/${n}.svg`
        return readFileSync(file, 'utf8')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/^[\s\S]*?<svg[^>]*>/, '')
          .replace(/<\/svg>\s*$/, '')
          .replace(/\s(id|data-[\w-]+)="[^"]*"/g, '')
          .replace(/#EAEAE9/gi, 'currentColor')
          .replace(/\s+/g, ' ')
          .trim()
      })
      return `export default ${JSON.stringify(markup)}`
    },
  }
}

export default defineConfig({
  base: process.env.PREVIEW_BASE ?? '/',
  plugins: [react(), drawings(), groups(), hero()],
  resolve: {
    alias: [
      // (the site takes the core and single icons by path: the package's barrel would pull in every icon)
      { find: /^@lib\/(.*)$/, replacement: lib('$1') },
      { find: /^ikoons\/icons\/(.*)$/, replacement: lib('icons/$1.ts') },
      { find: /^ikoons\/all$/, replacement: lib('icons/all.ts') },
      { find: /^ikoons\/motion$/, replacement: lib('motion.ts') },
      { find: /^ikoons$/, replacement: lib('index.ts') },
    ],
  },
  build: { chunkSizeWarningLimit: 1500 },
  server: { port: 5198 },
  preview: { port: 4198 },
})
