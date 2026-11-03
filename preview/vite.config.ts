import react from '@vitejs/plugin-react'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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
    name: 'kivz-icons-drawings',
    async configureServer(server) {
      const log = (s: string) => s && server.config.logger.info(s, { timestamp: true })
      server.watcher.add(`${root}icons`)
      server.watcher.on('all', (_, file) => {
        if (file.startsWith(`${root}icons`) && (file.endsWith('.svg') || file.endsWith('catalog.ts'))) void gen(log)
      })
    },
  }
}

export default defineConfig({
  base: process.env.PREVIEW_BASE ?? '/',
  plugins: [react(), drawings()],
  resolve: {
    alias: [
      { find: /^@kivzdev\/icons\/all$/, replacement: lib('icons/all.ts') },
      { find: /^@kivzdev\/icons\/motion$/, replacement: lib('motion.ts') },
      { find: /^@kivzdev\/icons$/, replacement: lib('index.ts') },
    ],
  },
  server: { port: 5198 },
  preview: { port: 4198 },
})
