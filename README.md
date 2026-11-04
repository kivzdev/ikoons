<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/ikoons-dark.svg">
  <img src=".github/assets/ikoons-light.svg" width="52" height="52" alt="">
</picture>

# Ikoons

Kivz's icon set for React (`ikoons` on npm): **filled by default, outline at any line width, and every icon moves in its own way** — when
its button is hovered or pressed, when it fills in, or when it turns into another icon. One colour (`currentColor`),
drawn on a 24-unit grid, server-rendered, tree-shakeable, no dependencies.

> **Status:** the pipeline and the motions are in place; the drawings are on their way. Apart from Kivz's own two marks (`ikoons-logo`, `kivz-logo`), every
> icon in the package today is a **placeholder** — marked as one in its file, its component (`data.placeholder`) and the
> preview — and `npm publish` refuses to run while any are left. The set will have about 270 icons
> ([icons/catalog.ts](icons/catalog.ts)); the ★ ones come first. Nothing is published yet.

## Install

```sh
npm install ikoons
```

React 18 or later.

## Use

```tsx
import { Bell, Heart, Trash } from 'ikoons'

<button><Bell /> Notifications</button>       // the bell swings when the button is hovered
<Heart weight="outline" strokeWidth={1.5} />  // outline, thinner lines
<Trash size={14} color="var(--fg-2)" />
```

| prop | | default |
| --- | --- | --- |
| `size` | the box, any length (a number is px) | `1em`: as big as the text beside it |
| `weight` | `filled` or `outline` | `filled` |
| `strokeWidth` | the width of the lines, on the 24 grid (2 is 1.17 px at 14 px) | `2` |
| `animate` | `hover`, `press`, `loop` or `false` | `hover` (a spinner: `loop`) |
| `cue` | plays the motion whenever this value changes | — |
| `title` | a label for screen readers (otherwise the icon is `aria-hidden`) | — |

Any other SVG prop (`className`, `style`, `onClick`…) goes on the `<svg>`. The ref is the `<svg>` element. Every
icon is also exported as `<Name>Icon` (`LinkIcon`, `ImageIcon`) for files where the plain name is taken.

## Motion

Each icon has a motion of its own: a bell swings from its top and its clapper follows, a bin's lid opens on its hinge, a
heart beats twice, a gear turns by a tooth and settles, ↗ leaves through its corner and comes back from the other one, a
music note hops on gravity, the lines of a # are drawn again one after another. They move the way kivz.dev moves:
nothing in a straight line, a small breath the other way before going, a few percent past on arriving, a dying swing only
for things that really swing.

- **What sets it off** is the thing you'd point at: the button, link, tab or row it sits in — or anything marked
  `data-icon-trigger` — or the icon itself when it's in nothing you can press. Hover means a mouse or pen over it, or a
  keyboard focus ring on it; on touch, where there's no hover, a tap plays it.
- `animate="press"` plays it on a press instead; `animate={false}` never; `animate="loop"` on and on (a spinner's
  default — and stopped, it slows into a whole turn rather than stopping dead).
- `cue` plays it from state: `<Bell cue={unread} />` rings whenever `unread` changes. From outside React:
  `playIcon(svgElement)`.
- A motion is never cut short: hovering again while it plays doesn't start it over, and when it's done the drawing is
  exactly as drawn again.
- **Reduced motion** (the visitor's setting): nothing moves on hover or press, changes only fade, a spinner breathes
  instead of turning. `<IconProvider reducedMotion="always">` forces it, `"never"` ignores it (for a showcase).

## Filling in, and one icon becoming another

Changing `weight` is a change of state: outline → filled grows the fill out of the middle of the outline, and the icon
plays its motion as it lands (a heart beats as it fills, a star turns); filled → outline shrinks it away.

`Swap` shows one icon at a time and goes from one to the next:

```tsx
import { Pause, Play, Swap } from 'ikoons'

<button onClick={toggle}><Swap icon={playing ? Pause : Play} /></button>
```

Some pairs have a change of their own; any other pair blurs out and in where it stands (never a slide):

| from → to | how |
| --- | --- |
| play → pause | the triangle splits into the two bars (a morph) |
| moon → sun | the crescent turns as its bite closes into a full disc, which settles into the sun as its rays come out one by one |
| lock → lock-open | the shackle rises as it changes shape and comes down open |
| eye → eye-slash | the eye shuts — and while it's shut becomes the other drawing — opens, and the line is drawn across it |
| bell → bell-slash, microphone → microphone-slash | the line is drawn across it |
| copy → check | the two sheets slide into one, it goes, the tick is drawn |
| arrows-out → arrows-in | a morph |

The way back plays the same change in reverse. **A change under way is never cut short or snapped to its end:** what's
asked for meanwhile waits, and once it's done the icon goes straight to the last thing asked for, skipping the rest;
going back to the icon it's leaving turns the change round where it is.

## Defaults for a part of the page

```tsx
import { IconProvider } from 'ikoons'

<IconProvider size={14} weight="outline" strokeWidth={1.5} animate="press">…</IconProvider>
```

## On a server

Icons render to plain SVG on the server (Next.js, Remix, Astro…) and hydrate without a difference. Each module is a
client module (`'use client'`); nothing touches the browser until something moves. Only the icons you import end up in
your bundle — one ES module per icon, no side effects — along with just the motions they use.

## Icons of your own

The motions are a toolkit: `createIcon(name, { filled, outline }, { motion })` makes an icon component from a drawing,
and `ikoons/motion` has the recipes (`swing`, `nudge`, `hop`, `draw`, `twinkle`…), the changes (`morph`,
`swap`…), the curves (`ease.spring`, `ease.glide`…) and `setClock`, to drive time yourself in a test.

## Drawing the set

The source is a folder of SVGs: `icons/filled/<name>.svg` and `icons/outline/<name>.svg`, one per icon and weight,
named after [icons/catalog.ts](icons/catalog.ts) (most names are Phosphor's, so they're easy to look up). `npm run gen`
turns them into the package's modules, and tells you what's missing.

- **The frame:** 24 × 24, nothing in it but the drawing (no background, no clip). **One colour** — details are cut out of
  shapes, never painted in another colour; the build stops on two colours, gradients, masks or text.
- **Lines** are 2 wide (that's 1.17 px at 14 px, like kivz.dev's rail icons), centred on the path, not outlined, round
  caps and joins; their width follows `strokeWidth`, a thinner detail keeps its share of it. **Filled** shapes are solid.
- **Name the layers the motion moves** (the preview says which, for each icon): a bell's `clapper`, a bin's `lid`, a
  house's `roof`, an envelope's `flap`, the `ray`s of a sun. Repeated names (Figma's `ray_2`, `ray_3`) are one part.
  A layer named `fx-…` only shows while the icon moves (a star's `fx-glint`s). Without the layer it needs, an icon
  simply pops.
- **Export from Figma** with *Include “id” attribute* on: frames named `filled/bell` and `outline/bell` export straight
  into the two folders.
- A stand-in drawing is marked `data-placeholder="true"` on its `<svg>` (or with a comment saying placeholder).

```sh
npm install
npm run dev        # the preview, at localhost:5198 — it picks up a drawing as you save it
npm test           # the build and the package
npm run build      # the package, into packages/icons/dist
```

## The repo

| | |
| --- | --- |
| `icons/` | the drawings and the catalog (names, groups, ★, each icon's motion) |
| `scripts/` | the build: `generate.ts` (drawings → modules), `svg.ts` (reads and normalises a drawing), `release-check.ts` |
| `packages/icons/` | the package: `src/core` (the components, the change queue), `src/motion` (clock, recipes, changes, curves, morph) |
| `preview/` | the preview page (Vite), in kivz.dev's style |

Logos in the set are trademarks of their owners, drawn flat in one colour for links to them.

## License

[MIT](LICENSE) © Kivz
