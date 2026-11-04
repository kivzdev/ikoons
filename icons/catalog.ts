/**
 * Every icon the set is going to have, in the order of Kivz's list (ikon-listesi.md), and how each one moves.
 *
 * - `name` is the file name in icons/filled and icons/outline (kebab-case). Most match Phosphor's names, so they are easy
 *   to look up; `phosphor` says where Phosphor calls it something else (null: Phosphor has none).
 * - `star`: the first ones to draw (★ in the list).
 * - `motion`: the recipe it plays on hover / press / `cue`, with its settings — the recipes are in
 *   packages/icons/src/motion/recipes.ts. A recipe that names a `part` animates the layer of that name in the drawing
 *   (Figma layer name → id → part); without it the recipe falls back to a small pop of the whole icon.
 * - `idea`: Kivz's own note for the motion, where the list had one.
 * - `brand`: a logo — its hover colour, or null for one-colour marks (they only lift).
 *
 * Only names here can be drawn; the build stops on an SVG whose name isn't in this file.
 */

export type Recipe =
  | 'nudge' | 'exit' | 'swing' | 'open' | 'beat' | 'turn' | 'spin' | 'draw' | 'orbit' | 'hop' | 'lift' | 'twinkle'
  | 'pop' | 'jitter' | 'flip' | 'jelly' | 'waves' | 'blink' | 'drift' | 'grow' | 'spread' | 'combo' | 'brand'

export type Transition = 'swap' | 'morph' | 'sunrise' | 'unlock' | 'slash' | 'copied'

export type Motion = readonly [recipe: Recipe, params?: Readonly<Record<string, unknown>>]

export interface Entry {
  readonly name: string
  readonly motion: Motion
  readonly star?: boolean
  readonly phosphor?: string | null
  readonly idea?: string
  /** a logo: its own colour on hover (null: a one-colour mark, it only lifts) */
  readonly brand?: string | null
  /** its motion runs on and on by default (a spinner) */
  readonly loop?: boolean
}

export interface Group {
  readonly id: string
  readonly title: string
  readonly icons: readonly Entry[]
}

/** state changes between two icons, for `<Swap>`: [from, to, transition]. The way back plays it in reverse. */
export type Pair = readonly [from: string, to: string, transition: readonly [Transition, Readonly<Record<string, unknown>>?]]

const i = (name: string, motion: Motion, more: Omit<Entry, 'name' | 'motion'> = {}): Entry => ({ name, motion, ...more })
const S = { star: true } as const
const logo = (name: string, brand: string | null, more: Omit<Entry, 'name' | 'motion' | 'brand'> = {}): Entry =>
  ({ name, motion: ['brand'], brand, ...more })

export const groups: readonly Group[] = [
  {
    id: 'navigation',
    title: 'Navigation and arrows',
    icons: [
      i('arrow-left', ['nudge', { to: [-2.5, 0] }], S),
      i('arrow-right', ['nudge', { to: [2.5, 0] }], S),
      i('arrow-up', ['nudge', { to: [0, -2.5] }]),
      i('arrow-down', ['nudge', { to: [0, 2.5] }]),
      i('arrow-up-right', ['exit', { to: [1, -1] }], { ...S, idea: 'köşeye doğru çıkıp geri gelir (dışarı gidiyor hissi)' }),
      i('arrow-u-up-left', ['nudge', { to: [-2.2, -0.6], r: -10, origin: [0.25, 0.5] }], { ...S, idea: 'geri kavis' }),
      i('caret-left', ['nudge', { to: [-2, 0] }], S),
      i('caret-right', ['nudge', { to: [2, 0] }], S),
      i('caret-up', ['nudge', { to: [0, -2] }]),
      i('caret-down', ['nudge', { to: [0, 2] }]),
      i('caret-double-left', ['nudge', { to: [-2, 0], part: 'chevron', stagger: 0.06 }]),
      i('caret-double-right', ['nudge', { to: [2, 0], part: 'chevron', stagger: 0.06 }]),
      i('arrows-out', ['beat', { scale: 0.12, beats: 1 }]),
      i('arrows-in', ['beat', { scale: -0.12, beats: 1 }]),
      i('arrow-counter-clockwise', ['turn', { angle: -360 }], S),
      i('arrow-clockwise', ['turn', { angle: 360 }]),
      i('arrows-clockwise', ['turn', { angle: 180 }]),
      i('sort-ascending', ['nudge', { to: [0, -2], part: 'arrow' }]),
      i('sort-descending', ['nudge', { to: [0, 2], part: 'arrow' }]),
      i('list', ['nudge', { to: [1.8, 0], part: 'line', stagger: 0.05 }], S),
      i('dots-three', ['hop', { h: 2.5, bounces: 1, part: 'dot', stagger: 0.07 }], S),
      i('dots-three-vertical', ['pop', { part: 'dot', stagger: 0.06 }]),
      i('x', ['draw', { from: 'center', stagger: 0.06 }], { ...S, idea: 'iki çizgi ortadan dışa doğru çizilir' }),
      i('house', ['lift', { part: 'roof', y: -2 }], { ...S, idea: 'çatı hafif kalkıp oturur' }),
      i('sidebar', ['nudge', { to: [-1.5, 0], part: 'panel' }]),
      i('layout', ['pop', { part: 'cell', stagger: 0.05 }]),
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    icons: [
      i('plus', ['turn', { angle: 90 }], S),
      i('minus', ['jelly', { axis: 'x', origin: [0.5, 0.5] }]),
      i('check', ['draw'], S),
      i('x-circle', ['draw', { part: 'x', from: 'center', stagger: 0.06 }]),
      i('pencil-simple', ['orbit', { r: 1.2, tilt: 8 }], S),
      i('trash', ['open', { part: 'lid', origin: [0, 1], angle: -22, rise: 0.8 }], { ...S, idea: 'kapak menteşeden açılıp kapanır' }),
      i('copy', ['spread', { parts: ['back', 'front'], dir: [-1, -1], dist: 1.3 }], { ...S, idea: 'copy → check: iki kâğıt üst üste kayar, sonra tik çizilir (çizgi uzunluğu animasyonu)' }),
      i('clipboard', ['lift', { part: 'clip', y: -1.5 }]),
      i('share-fat', ['nudge', { to: [2, -0.6], r: -8 }], S),
      i('share-network', ['pop', { part: 'node', stagger: 0.07 }]),
      i('export', ['nudge', { to: [0, -2], part: 'arrow' }]),
      i('download-simple', ['nudge', { to: [0, 2], part: 'arrow' }]),
      i('link', ['spread', { parts: ['link-a', 'link-b'], dir: [-1, 1], dist: 1.2 }], S),
      i('link-break', ['spread', { parts: ['link-a', 'link-b'], dir: [-1, 1], dist: 1.6 }]),
      i('magnifying-glass', ['orbit', { r: 1.6 }], { ...S, idea: 'küçük bir daire çizip durur (arıyor)' }),
      i('funnel', ['jelly', { origin: [0.5, 0], axis: 'y' }]),
      i('sliders', ['nudge', { to: [2, 0], part: 'knob', stagger: 0.06, alternate: true }]),
      i('gear-six', ['turn', { angle: 60 }], { ...S, idea: '60° döner, yay gibi oturur' }),
      i('lock', ['lift', { part: 'shackle', y: -1.5 }], { idea: 'lock ↔ lock-open: halka yukarı kalkıp döner' }),
      i('lock-open', ['lift', { part: 'shackle', y: -1.5 }]),
      i('eye', ['blink'], { idea: 'eye ↔ eye-slash: göz kırpar, sonra çizgi çizilir' }),
      i('eye-slash', ['draw', { part: 'slash' }]),
      i('star', ['twinkle', { rot: 18, glints: 'fx-glint' }], { ...S, idea: 'dolarken hafif döner, uçlarından parlar' }),
      i('heart', ['beat'], { idea: 'iki vuruş atar (büyü–küçül–büyü, elastik)' }),
      i('bookmark-simple', ['jelly', { origin: [0.5, 0] }], { idea: 'aşağı uzayıp yerine oturur (jöle)' }),
      i('flag', ['swing', { part: 'cloth', origin: [0, 0], angle: 8, f: 3 }]),
      i('push-pin', ['hop', { h: 3.5, bounces: 1, sink: 0.8 }], { idea: 'düşüp batar, hafif sekme' }),
      i('archive', ['lift', { part: 'lid', y: -1.6 }]),
      i('tray', ['jelly', { origin: [0.5, 1], axis: 'y' }]),
      i('paper-plane-tilt', ['exit', { to: [1, -0.7], arc: -2, tilt: -10 }], { idea: 'hafif kavisle uçup geri gelir' }),
      i('arrow-square-out', ['exit', { to: [1, -1], part: 'arrow' }]),
      i('sign-in', ['nudge', { to: [2, 0], part: 'arrow' }]),
      i('sign-out', ['nudge', { to: [2, 0], part: 'arrow' }]),
      i('power', ['pop']),
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    icons: [
      i('envelope', ['open', { part: 'flap', flip: true, origin: [0.5, 0], inner: 'fx-letter', rise: 2.5 }], { ...S, idea: 'kapak açılır, mektup biraz yükselir' }),
      i('chat-circle', ['jelly', { origin: [0.15, 1] }]),
      i('chats', ['pop', { part: 'bubble', stagger: 0.08 }]),
      i('phone', ['jitter', { angle: 12, f: 11, dur: 0.55 }]),
      i('bell', ['swing', { follow: 'clapper' }], { ...S, idea: 'üstünden asılı sallanır (2–3 sönümlü salınım)' }),
      i('bell-slash', ['draw', { part: 'slash' }]),
      i('at', ['turn', { angle: -360 }]),
      i('megaphone', ['beat', { scale: 0.1, beats: 1, origin: [0, 0.5] }]),
      i('video-camera', ['nudge', { to: [1.5, 0] }]),
      i('microphone', ['beat', { scale: 0.08, beats: 2 }]),
      i('microphone-slash', ['draw', { part: 'slash' }]),
    ],
  },
  {
    id: 'media',
    title: 'Media and playback',
    icons: [
      i('play', ['nudge', { to: [1.5, 0] }], { ...S, idea: 'play ↔ pause: üçgen iki çubuğa biçim değiştirir (morph)' }),
      i('pause', ['pop', { part: 'bar', stagger: 0.07 }], S),
      i('stop', ['pop']),
      i('skip-forward', ['nudge', { to: [2, 0] }]),
      i('skip-back', ['nudge', { to: [-2, 0] }]),
      i('rewind', ['nudge', { to: [-1.8, 0], part: 'triangle', stagger: 0.06 }]),
      i('fast-forward', ['nudge', { to: [1.8, 0], part: 'triangle', stagger: 0.06 }]),
      i('repeat', ['turn', { angle: 180 }]),
      i('shuffle', ['nudge', { to: [1.6, 0], part: 'arrow', stagger: 0.05 }]),
      i('speaker-high', ['waves', { part: 'wave', origin: [0.25, 0.5] }], { idea: 'dalgalar sırayla çıkar' }),
      i('speaker-low', ['waves', { part: 'wave', origin: [0.25, 0.5] }]),
      i('speaker-x', ['draw', { part: 'x', from: 'center', stagger: 0.06 }]),
      i('music-note', ['hop', { h: 3, bounces: 2 }], { ...S, idea: 'zıplar (iki sekme, yerçekimi eğrisi)' }),
      i('playlist', ['nudge', { to: [1.5, 0], part: 'line', stagger: 0.05 }]),
      i('headphones', ['beat', { scale: 0.07, beats: 2 }], S),
      i('waveform', ['grow', { part: 'bar', from: 'center', stagger: 0.04 }]),
      i('record', ['beat', { scale: 0.12, beats: 1 }]),
      i('image', ['pop']),
      i('images', ['spread', { parts: ['back', 'front'], dir: [-1, -1], dist: 1.2 }]),
      i('camera', ['pop', { s: 0.12 }]),
      i('film-strip', ['nudge', { to: [2, 0] }]),
    ],
  },
  {
    id: 'files',
    title: 'Files and content',
    icons: [
      i('file', ['jelly', { origin: [0.5, 1] }]),
      i('file-text', ['nudge', { to: [1.2, 0], part: 'line', stagger: 0.05 }]),
      i('files', ['spread', { parts: ['back', 'front'], dir: [-1, -1], dist: 1.2 }]),
      i('folder', ['jelly', { origin: [0.5, 1] }]),
      i('folder-open', ['jelly', { origin: [0.5, 1] }]),
      i('note', ['swing', { origin: [0.5, 0], angle: 6 }]),
      i('notebook', ['jelly', { origin: [0, 0.5], axis: 'x' }]),
      i('book', ['flip']),
      i('book-open', ['jelly', { part: 'page', origin: [0.5, 1] }]),
      i('newspaper', ['draw', { part: 'line', stagger: 0.06 }], S),
      i('article', ['draw', { part: 'line', stagger: 0.06 }]),
      i('code', ['spread', { parts: ['left', 'right'], dist: 1.5 }], S),
      i('terminal', ['blink', { part: 'cursor', opacity: true, times: 2 }]),
      i('brackets-curly', ['spread', { parts: ['left', 'right'], dist: 1.5 }]),
      i('hash', ['draw', { stagger: 0.07 }], { ...S, idea: 'çizgiler sırayla çizilir' }),
      i('tag', ['swing', { origin: [0.3, 0.3], angle: 12 }], { idea: 'ipinden sallanır' }),
      i('paperclip', ['jitter', { angle: 8, f: 6, dur: 0.6 }]),
      i('quotes', ['pop', { part: 'mark', stagger: 0.06 }]),
      i('text-aa', ['hop', { part: 'small', h: 2, bounces: 1 }]),
      i('paragraph', ['nudge', { to: [1.5, 0] }]),
      i('list-bullets', ['pop', { part: 'bullet', stagger: 0.06 }]),
      i('list-numbers', ['pop', { part: 'number', stagger: 0.06 }]),
      i('table', ['pop', { part: 'row', stagger: 0.05 }]),
      i('chart-bar', ['grow', { part: 'bar', from: 'bottom', stagger: 0.06 }]),
      i('chart-line', ['draw', { part: 'line' }]),
      i('chart-pie', ['nudge', { to: [1, -1], part: 'slice' }]),
      i('kanban', ['grow', { part: 'column', from: 'top', stagger: 0.06 }]),
    ],
  },
  {
    id: 'people',
    title: 'People',
    icons: [
      i('user', ['hop', { h: 1.5, bounces: 1 }], S),
      i('users', ['hop', { h: 1.5, bounces: 1, part: 'person', stagger: 0.08 }]),
      i('user-plus', ['turn', { angle: 90, part: 'plus' }], S),
      i('user-minus', ['jelly', { part: 'minus', axis: 'x', origin: [0.5, 0.5] }]),
      i('user-circle', ['pop']),
      i('identification-card', ['flip']),
      i('smiley', ['blink', { part: 'eye' }]),
      i('hand-waving', ['swing', { origin: [0.6, 1], angle: 16, f: 2.8 }]),
      i('crown', ['hop', { h: 2, bounces: 1, tilt: 6 }]),
    ],
  },
  {
    id: 'status',
    title: 'Status and feedback',
    icons: [
      i('info', ['hop', { part: 'dot', h: 2.5, bounces: 1 }], S),
      i('warning', ['jitter', { x: 1, f: 9, dur: 0.45 }], S),
      i('warning-circle', ['jitter', { x: 1, f: 9, dur: 0.45 }]),
      i('question', ['swing', { origin: [0.5, 1], angle: 10, f: 2 }]),
      i('check-circle', ['draw', { parts: ['circle', 'tick'], sequential: true }], { ...S, idea: 'daire çizilir, sonra tik (sırayla)' }),
      i('spinner', ['spin'], { ...S, loop: true, idea: 'ivmelenen dönüş (sabit hız değil)' }),
      i('circle-notch', ['spin'], { loop: true }),
      i('lightning', ['pop', { s: 0.14 }]),
      i('fire', ['jelly', { origin: [0.5, 1], axis: 'y' }]),
      i('sparkle', ['twinkle', { main: 'main', small: 'small' }], { ...S, idea: 'ölçeklenip parlar, küçük yıldızlar sırayla' }),
      i('seal-check', ['draw', { part: 'tick' }]),
      i('shield-check', ['draw', { part: 'tick' }]),
      i('bug', ['jitter', { angle: 6, f: 8, dur: 0.5 }]),
    ],
  },
  {
    id: 'time',
    title: 'Time and place',
    icons: [
      i('clock', ['turn', { part: 'hand', angle: 360, around: 'root', stagger: 0.05 }]),
      i('calendar', ['jelly', { origin: [0.5, 0] }], S),
      i('calendar-plus', ['turn', { part: 'plus', angle: 90 }]),
      i('timer', ['turn', { part: 'hand', angle: 360, around: 'root' }]),
      i('hourglass', ['turn', { angle: 180 }]),
      i('alarm', ['jitter', { angle: 10, f: 12, dur: 0.55 }]),
      i('map-pin', ['hop', { h: 3.5, bounces: 1, sink: 0.6 }], S),
      i('map-trifold', ['jelly', { axis: 'x', origin: [0.5, 0.5] }]),
      i('globe', ['flip', { part: 'meridian' }]),
      i('compass', ['swing', { part: 'needle', around: 'root', origin: [0.5, 0.5], angle: 25, f: 1.6 }]),
      i('navigation-arrow', ['nudge', { to: [1.5, -1.5] }]),
      i('airplane', ['exit', { to: [1, -1] }]),
      i('car', ['nudge', { to: [2, 0] }]),
      i('buildings', ['grow', { part: 'building', from: 'bottom', stagger: 0.07 }]),
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping and money',
    icons: [
      i('shopping-cart', ['nudge', { to: [2, 0], r: -4 }]),
      i('shopping-bag', ['hop', { h: 1.8, bounces: 1 }]),
      i('credit-card', ['flip']),
      i('wallet', ['lift', { part: 'card', y: -1.5 }]),
      i('receipt', ['jelly', { origin: [0.5, 0], axis: 'y' }], S),
      i('currency-dollar', ['flip']),
      i('currency-eur', ['flip']),
      i('currency-try', ['flip'], { phosphor: null, idea: '₺ — Phosphor’da yok, çizilmesi gerek' }),
      i('gift', ['lift', { part: 'lid', y: -1.8 }]),
      i('storefront', ['jelly', { part: 'awning', origin: [0.5, 0] }]),
      i('package', ['hop', { h: 2, bounces: 1 }]),
      i('truck', ['nudge', { to: [2, 0] }]),
    ],
  },
  {
    id: 'devices',
    title: 'Devices and tech',
    icons: [
      i('desktop', ['pop']),
      i('laptop', ['pop']),
      i('device-mobile', ['pop']),
      i('device-tablet', ['pop']),
      i('watch', ['pop']),
      i('keyboard', ['pop', { part: 'key', stagger: 0.03 }]),
      i('mouse', ['nudge', { to: [0, 1.2], part: 'wheel' }]),
      i('cursor', ['pop', { s: 0.14, origin: [0.25, 0.15] }], S),
      i('cursor-click', ['waves', { part: 'ray', origin: [0.3, 0.3] }]),
      i('hand-pointing', ['nudge', { to: [0, -1.5] }]),
      i('wifi-high', ['waves', { part: 'arc', origin: [0.5, 1] }]),
      i('bluetooth', ['beat', { beats: 1 }]),
      i('battery-full', ['grow', { part: 'level', from: 'left' }]),
      i('cpu', ['beat', { scale: 0.08, beats: 1 }]),
      i('database', ['hop', { part: 'disc', h: 1.2, bounces: 1, stagger: 0.06 }]),
      i('cloud', ['drift'], { ...S, idea: 'yavaşça süzülür' }),
      i('cloud-arrow-up', ['nudge', { to: [0, -2], part: 'arrow' }]),
      i('hard-drives', ['blink', { part: 'light', opacity: true, stagger: 0.08 }]),
      i('plug', ['nudge', { to: [1.5, -1.5] }]),
      i('robot', ['combo', { of: [['swing', { part: 'antenna', angle: 16 }], ['blink', { part: 'eye', delay: 0.25 }]] }], { ...S, idea: 'anteni sallanır, gözleri kırpar' }),
    ],
  },
  {
    id: 'games',
    title: 'Games and design',
    icons: [
      i('game-controller', ['jitter', { x: 0.5, angle: 4, f: 18, dur: 0.4 }], { ...S, idea: 'hafif titrer (titreşim)' }),
      i('joystick', ['swing', { part: 'stick', origin: [0.5, 1], angle: 18 }]),
      i('dice-five', ['turn', { angle: 90 }]),
      i('puzzle-piece', ['pop']),
      i('trophy', ['hop', { h: 1.5, bounces: 1 }]),
      i('medal', ['swing', { origin: [0.5, 0], angle: 10 }]),
      i('target', ['waves', { part: 'ring', origin: [0.5, 0.5] }]),
      i('sword', ['turn', { angle: -25, back: true, origin: [0.15, 0.85] }]),
      i('cube', ['flip'], { ...S, idea: '3D dönüp yerine oturur' }),
      i('magic-wand', ['combo', { of: [['turn', { angle: -14, back: true, origin: [0.1, 0.9] }], ['twinkle', { small: 'star' }]] }]),
      i('paint-brush', ['swing', { origin: [0.8, 0.2], angle: 10 }]),
      i('palette', ['turn', { angle: 30, back: true }], S),
      i('pen-nib', ['orbit', { r: 1 }]),
      i('eyedropper', ['jelly', { origin: [1, 0] }]),
      i('ruler', ['nudge', { to: [1.5, 0] }]),
      i('crop', ['spread', { parts: ['a', 'b'], dir: [-1, -1], dist: 1 }]),
      i('frame-corners', ['beat', { scale: 0.1, beats: 1 }]),
      i('selection', ['beat', { scale: 0.08, beats: 1 }]),
      i('stack', ['spread', { part: 'layer', axis: 'y', dist: 1.2 }]),
      i('shapes', ['pop', { part: 'shape', stagger: 0.07 }]),
      i('bezier-curve', ['swing', { part: 'handle', angle: 14 }]),
      i('grid-four', ['pop', { part: 'cell', stagger: 0.05 }]),
    ],
  },
  {
    id: 'nature',
    title: 'Theme and nature',
    icons: [
      i('sun', ['turn', { angle: 45 }], { ...S, idea: 'moon ↔ sun: ay dönerek güneşe açılır, ışınlar sırayla belirir' }),
      i('moon', ['turn', { angle: -20, back: true }], S),
      i('cloud-sun', ['lift', { part: 'sun', y: -1.5 }]),
      i('drop', ['jelly', { origin: [0.5, 1], axis: 'y' }]),
      i('snowflake', ['turn', { angle: 60 }]),
      i('leaf', ['swing', { origin: [0.1, 0.9], angle: 10 }]),
      i('lightbulb', ['twinkle', { small: 'ray' }]),
    ],
  },
  {
    // flat, one colour, filled only. Names end in -logo throughout (Phosphor's way), also where Phosphor has none.
    id: 'brands',
    title: 'Brands and social',
    icons: [
      logo('kivz-logo', '#fdd900', { star: true, phosphor: null, idea: 'Kivz işareti (kivz.dev’in logosu)' }),
      // (the set's own mark: a hand-drawn star, so it twinkles rather than taking a colour)
      i('ikoons-logo', ['twinkle', { rot: 24 }], { star: true, phosphor: null, idea: 'Ikoons’un işareti (Kivz çizdi, 2026-11-04)' }),
      logo('github-logo', null, S),
      logo('gitlab-logo', '#fc6d26'),
      logo('npm-logo', '#cb3837', { ...S, phosphor: null }),
      logo('vercel-logo', null, { phosphor: null }),
      logo('x-logo', null, S),
      logo('instagram-logo', '#ff0069', S),
      logo('threads-logo', null, S),
      logo('bluesky-logo', '#0285ff', { phosphor: null }),
      logo('mastodon-logo', '#6364ff'),
      logo('facebook-logo', '#0866ff'),
      logo('messenger-logo', '#00b2ff'),
      logo('youtube-logo', '#ff0000', S),
      logo('tiktok-logo', null, S),
      logo('twitch-logo', '#9146ff', S),
      logo('discord-logo', '#5865f2', S),
      logo('telegram-logo', '#26a5e4'),
      logo('whatsapp-logo', '#25d366'),
      logo('linkedin-logo', '#0a66c2', S),
      logo('reddit-logo', '#ff4500'),
      logo('pinterest-logo', '#e60023'),
      logo('snapchat-logo', '#fffc00'),
      logo('medium-logo', null),
      logo('dev-to-logo', null),
      logo('spotify-logo', '#1ed760', { ...S, idea: 'şu an çalan şarkı' }),
      logo('apple-music-logo', '#fa243c', { phosphor: null }),
      logo('soundcloud-logo', '#ff5500'),
      logo('apple-podcasts-logo', '#9933cc'),
      logo('steam-logo', null, S),
      logo('itch-io-logo', '#fa5c5c', { phosphor: null }),
      logo('roblox-logo', null, { phosphor: null }),
      logo('epic-games-logo', null, { phosphor: null }),
      logo('playstation-logo', '#0070d1', { phosphor: null }),
      logo('xbox-logo', '#107c10', { phosphor: null }),
      logo('nintendo-logo', '#e60012', { phosphor: null }),
      logo('figma-logo', '#f24e1e', S),
      logo('dribbble-logo', '#ea4c89'),
      logo('behance-logo', '#1769ff'),
      logo('framer-logo', '#0055ff'),
      logo('notion-logo', null),
      logo('slack-logo', '#e01e5a'),
      logo('apple-logo', null),
      logo('android-logo', '#3ddc84'),
      logo('google-logo', '#4285f4'),
      logo('app-store-logo', '#0d96f6'),
      logo('google-play-logo', '#01875f'),
      logo('windows-logo', '#0078d4'),
      logo('linux-logo', '#fcc624'),
      logo('paypal-logo', '#009cde'),
      logo('stripe-logo', '#635bff'),
      logo('open-ai-logo', null),
      logo('claude-logo', '#d97757', { phosphor: null }),
    ],
  },
]

export const pairs: readonly Pair[] = [
  ['play', 'pause', ['morph']],
  ['moon', 'sun', ['sunrise']],
  ['lock', 'lock-open', ['unlock']],
  ['eye', 'eye-slash', ['slash', { blink: true }]],
  ['bell', 'bell-slash', ['slash']],
  ['microphone', 'microphone-slash', ['slash']],
  ['copy', 'check', ['copied']],
  ['arrows-out', 'arrows-in', ['morph']],
]

/** every entry by name */
export const entries: ReadonlyMap<string, Entry & { group: string }> = new Map(
  groups.flatMap(g => g.icons.map(e => [e.name, { ...e, group: g.id }] as const)),
)
