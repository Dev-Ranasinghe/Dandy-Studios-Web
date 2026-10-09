# Dandy Studios design guideline

The rules every section follows. The tokens live in `app/globals.css` (`:root`); use them by name
and never hard-code a value the scale already covers. When a new need appears, add a token
here and in `globals.css` first, then use it.

## Worlds

- **Opening hero (framed, house palette):** one rounded frame inset `--hero-pad` on an ink-lavender ground; the thin `--nav-h` site header sits inside it under the clock strip (`--header-top`, set by `html:has([data-hero])`). Field: ink tinted toward lavender on the left, through `--plasma`, to `--lavender` on the right with a lilac glow (phones: lavender to plasma, top to bottom); hairline grid with small squares at crossings; grain; the founder cutout multiplied into the lavender side (blurred, dominant, on phones). Type follows the editorial world: Libre Caslon Display headline ("More Dandyyy. / Less Ordinaryyy.") and role title, Work Sans for running text, caps micro-labels at `--text-caps` / `--tracking-caps`. `--bone` type, `--lilac` as the one accent (dot spotlight, switch-on states, sound bars). The headline sizes to its own row with container units, so it never climbs into the intro. Signature: the lilac dot matrix is revealed around the native pointer (square dots at rest, scan lines with speed); EXPERIENCE turns on the visitor's camera behind the type (mirrored; MediaPipe hand tracking in a Web Worker, `public/workers/hand-worker.js`), brightens the grid, draws viewfinder corners, and the index fingertip drives a hard-edged disc with orbiting streaks. The camera's way in and out is a lens (`components/sections/ExperienceGate.tsx`): a plasma veil with the grid, a lilac dot scanline, a reticle that tightens with progress and a Caslon percentage reading real progress (runtime, model download in MB, compile, camera permission). The tracker loads first and the camera is requested last, so its light only comes on when everything is ready; the lens then irises open. Closing freezes the camera's last frame under an iris that shuts, and waits for the page to settle (`lib/settle.ts`: smooth frames, then idle). While it runs, the first scroll, key, link or button outside the hero's switches is held: the camera and tracker stop, and only once the page has settled is the click replayed and scrolling released. SOUND is a Web Audio drone plus interface ticks (`lib/hero-sound.ts`).
- **Frame grid (below the hero):** night `--night` ground, paper `--paper` type, neon `--neon` as the one charged colour. Tanker display, Switzer text.
- **Editorial (statement → clients → plasma → closing CTA → footer):** everything below the hero. Bone ground, ink type, lavender as the only tint. This is the house style for new sections.

## Colour (editorial world)

| Token | Value | Use |
|---|---|---|
| `--bone` | `#f4f3f1` | Page ground. Footer frame starts on it so sections run in without a seam. |
| `--ink` | `#0e0d0c` | Type, buttons, the snake. |
| `--lavender` | `#4d3b78` | The only tint on bone: washes, hover tints, the footer frame's base. |
| `--lilac` | `#b8a9e8` | Accents on dark grounds (footer "Studios", stars, dither ground). |
| `--plasma` | `#1c0a2e` | Deepest plasma violet. |

Values above are the Violet theme; see Accent themes below.

### Accent themes

The visitor can re-theme the whole site from the header (`components/AccentSwitch.tsx`): **Lilac** (the house palette above, default) or one of six neon highlighter colours: **Green** `#10ff00`, **Cyan** `#00ffd9`, **Yellow** `#f8ff00`, **Red** `#ff0000`, **Pink** `#ff10f0`, **Violet** `#7f00ff`. A theme remaps the tinted tokens on `html[data-accent]` (`app/globals.css`); they are registered with `@property`, so the page eases between themes over 700ms. Canvas and WebGL pieces (menu shader, plasma field, heat glow, hero cursor dots) take the same values from `lib/accent-palette.ts` through `useAccent()`. The choice is saved in `localStorage` (`dandy-accent`) and applied in `<head>` before first paint.

| Token | Role |
|---|---|
| `--highlight` | The raw neon. Fills only: marker swipes, the lit testimonial card, swatches, cursor dots, shader highlights. |
| `--on-highlight` | Text on a `--highlight` fill: ink, or bone on the dark Violet. |
| `--lilac` | The accent as text/icons on dark grounds; the neon, lifted where it would fail 5:1 (Red, Pink, Violet). |
| `--lavender` | The accent as text/tint on bone, a deep version of the neon (≥ 5.5:1). |
| `--plasma` | The accent's deepest dark. |

- Never hard-code a tinted colour: build it from these tokens (`color-mix`) so every theme gets it.
- Neon never sets text on bone (it fails contrast); it goes behind ink as a highlighter.
- **Highlighter marks** (global `.marker` / `.marker-under` in `globals.css`): section labels such as ( Clients ) and ( Testimonials ) sit on a felt-tip swipe of `--highlight`, askew by -1.5°; "*Take theirs" gets the lower stroke. Both wipe in left to right on scroll (scroll-driven; static elsewhere and with reduced motion).
- Supplied artwork with a baked colour (the footer's pixel print) is re-inked under a non-default theme: greyscale, then multiplied over the accent.
- **Liquid glass on every control:** buttons and button-links carry `components/ui/GlassLayer.tsx` as their first child plus the global `glass-host` class; the layer sits under the label and is tinted by the control's `--glass-tint` (never a plain `background`). Clear controls (header tiles, secondary buttons, the hero switch track, the Work sidebar's hovered/chosen discipline) use a translucent tint; keys that read as solid (bone "Let's talk" / "See all work" / "Start a project", ink "Get a custom quote") add `glass-solid`: full colour behind the label, clearing toward the rim so the page still bends at the edge. Hover changes `--glass-tint`, not `background`. Text links are not buttons and stay plain. **Performance:** a control refracts live only while hovered or keyboard-focused; at rest it gets a cheap 3px frost, and while the page scrolls (`html[data-scrolling]`) it drops its backdrop entirely. Only the nav bar refracts all the time. Never add an always-live refraction elsewhere: a dozen of them dropped 14 frames per scroll of the home page, and live testimonial cards took that section to ~33fps. Big panes that move or sit over motion use `glass-calm` (no backdrop at all until hovered).
- **The nav bar is exempt:** it is neutral smoke glass and takes no accent (the switcher's own dot is the only colour on it).
- The tray: a tile with the live accent dot opens a row of split swatches (tint | neon) on the same glass as the bar, as a radio group; arrows pick. It closes on Escape, any press or focus outside it, and the moment the page scrolls.

- Dark panels are ink tinted toward lavender: `color-mix(in oklab, var(--ink) 90%, var(--lavender))`.
- Muted text on bone is mixed from ink, never grey: `color-mix(in oklab, var(--ink) 48%, var(--bone))`.
- Joins between light and dark sections are never hard edges. The dark section's own motion (the plasma) bleeds into its neighbours under an eased mask; neighbours stay transparent over one shared bone ground. The mask follows a smoothstep curve (flat at both ends): a ramp that meets full strength at an angle leaves a visible line where it stops.

## Type

- **Display serif:** `var(--font-serif)` (Libre Caslon Display). Headlines, the statement, client names, footer links and services. Sentence case, `--tracking-display`.
- **Label face:** `var(--font-label)`, which now points at Tanker (`--font-display`; Work Sans stays loaded as `--font-worksans`). Labels, buttons, captions, lists and short running text. Tanker is an all-capitals face, so everything set in it reads as caps. Section labels read `( Label )` with the brackets `aria-hidden`.
- **Caps:** buttons and micro-labels are uppercase at `--text-caps` with `--tracking-caps`.
- Sizes: labels `--text-label`; statement `clamp(2.25rem, 5.4vw, 6rem)` (phones `clamp(2.5rem, 11vw, 3.5rem)`); closing headline `clamp(3rem, 9.5vw, 8.5rem)`.

## Leading

| Token | Value | Use |
|---|---|---|
| `--leading-display` | 1 | One- and two-line headlines |
| `--leading-statement` | 1.08 | Multi-line serif statements, wide screens |
| `--leading-statement-compact` | 1.2 | The same on phones |
| `--leading-body` | 1.5 | Running text |
| `--leading-label` | 1.3 | Labels and buttons |

## Spacing

One 8px-based scale: `--space-3xs` 4 · `2xs` 8 · `xs` 12 · `s` 16 · `m` 24 · `l` 32 · `xl` 48 · `2xl` 64 · `3xl` 96 · `4xl` 128.

Page rhythm — sections use only these for their outer spacing:

| Token | Value | Use |
|---|---|---|
| `--section-y` | `clamp(80px, 12vh, 144px)` | Space above and below a section's content |
| `--section-y-tight` | `clamp(40px, 6vh, 72px)` | Between two sections that read as one (statement → clients) |
| `--gutter` | `clamp(20px, 4vw, 64px)` | Side margin for full-width content |
| `--gutter-editorial` | `max(20px, 12vw)` | Deeper indent for long-form statements |
| `--stack-gap` | `clamp(24px, 3.5vh, 40px)` | Label → heading → action inside a section |

- Inside components: tight groups use `2xs`–`s`, separated groups `l`–`xl`. More space above a heading than below it.
- Buttons: `min-height: 48px`, padding `0.95em 1.4em`, radius 10px.

## Motion

- Ease: `--ease-out` (exponential out). One authored moment per section, not a generic entrance on everything.
- Scroll-linked pieces (the snake) pin their section and must be fully off screen before the next section can appear.
- Everything has a `prefers-reduced-motion` path: final state, no transforms, no pin.
- Scrolling is native (no smooth-scroll library). `components/ScrollState.tsx` marks `html[data-scrolling]` while the page moves and fires `scrollsettle` when it stops.
- Performance rules: animation loops run only while their section is on screen and write to the DOM only when a value changed; hover effects that resize layout or start media follow the pointer's position and hold still while `html[data-scrolling]` is set, re-checking on the `scrollsettle` event (never block the pointer with `pointer-events: none`, which loses hovers); timers that tick (clocks) live in their own tiny component. Target: 60fps (≤17ms p95 frames) while scrolling every section.

## Signature pieces

- **Snake** (`components/sections/SnakeTrail.tsx`): the logo's snake crawls head first up the pinned statement, under the text; words invert where they cross it (white + `mix-blend-mode: difference`). Same shape at every size: swing 3.9× apart, body 0.45 of the swing, 2.2 turns long.
- **Sun** (`components/ui/orb-shader.tsx`, the Shader Builder's "Orb"): only the orb, no ground, rising from the statement stage's top-left corner and cropped by the page's edges there; its body (radius `--sun-r`, 165–340px, 20.5vw) covers the corner up to the first line and reaches behind "Dandy", which inverts over it. The pan (u_offset) pins its centre near the canvas's top-left and the zoom sets the body size, so the canvas only spans what can show and the halo fades to clear inside it. Alpha comes from the orb's own level; colours follow the accent (deep tint → tint → highlight → pale core). Runs only while on screen.
- **Buried print** (footer `Pit` in `components/Footer.tsx`): the founder's 1-bit pixel portrait (`public/images/portrait-pixel.png`, supplied artwork) lies at the floor of a real 3D shaft sunk into the footer panel: four perspective walls lit from above, the rim's shadow across the print, the viewpoint following the mouse. It must fit the footer's existing height (desktop: one screen; phone ≈ 975px) and never overlap text. `components/ui/DitherImage.tsx` can generate this 1-bit look from any photo if a new one is needed.
- **Plasma** (`components/ui/plasma-shader.tsx`): the only moving colour field; bleeds into neighbours rather than meeting them at an edge.

## Content rules

- Never invent clients, numbers or locations (see PRODUCT.md). The client marquee is placeholder until real names arrive.
- **Menu ground:** the full-screen menu's background is the warp-stripe WebGL shader (`components/ui/shader-anima.tsx`) in the site palette: day plasma → lavender → lilac → pale lilac, night ink-violet → lilac. Pointer interaction is off and it renders at most 600k pixels (scaled up), mounted only while the menu is open.
- **Testimonials, then the crowd:** (the cards are light liquid glass, `GlassLayer look="pane"` with the `glass-calm` host: 74% bone and no backdrop filter at rest (live glass on the drifting row over the beans halved the frame rate), live refraction only on the hovered card while the row is stopped, no colour split, ink text. Behind the row, **Metaballs** beans only, no ground (`components/ui/metaballs-shader.tsx`, adapted from Paper Shaders, Apache-2.0): up to twelve beans (fewer on small screens) roaming the whole row, coloured from the accent (plasma → lavender rim → highlight → pale body), each ending on its crisp rim; the shader keeps every bean whole. Hover never fills a card: the text is "selected" in `--highlight`, sweeping line by line like a drag-select. Avatars are neon discs, roles in `--lavender`) `components/sections/Testimonials.tsx`, followed by the walking Open Peeps crowd (`components/sections/CrowdSection.tsx` via `components/ui/skiper39.tsx`, sprite at `public/images/open-peeps-crowd.png`). Header: `( Testimonials )` caps label, a Caslon "Don't take our word for it" with a lavender asterisk, `*Take theirs` in lavender caps. Cards: ink-lavender panels (the footer's), radius 12px, Work Sans quote, initials avatar (or photo), caps role/company, a faint Caslon closing quote in the corner, set at staggered heights (a repeating five-step rhythm). The row drifts left on every device (76px/s, looping over a hidden copy): with a mouse it eases to a stop under the pointer or focus; on touch a finger holds it, dragging throws it, and it drifts on 1.4s after letting go. Only reduced motion gets a native swipe row snapping card by card. The staggered heights (`--rise`, 40–64px) are the same at every width; on phones the resting glass is clearer (60% bone) and the beans get more room around the row. Order at the page's close: testimonials → the walking crowd (its own band, fading into the paper at its foot) → the closing CTA → footer. The bone wrapper around these tucks under the footer's clear top band (`--footer-lip`), so the tab rises out of paper. Content lives in `components/testimonials.ts`: placeholders until real, permitted quotes arrive.
- **Nav bar (every page):** a floating rounded bar (`components/SiteHeader.tsx`), 56px (`--nav-h`), radius 14px, liquid glass (`@samasante/liquid-glass`, material mode: the page refracts through it with a colour-split rim in Chrome/Edge, frost and a bright rim elsewhere) under a neutral ink smoke tint that never takes the accent theme: the stacked DANDY/STUDIOS mark left, caps links in pure white centred (current page underlined), over a 60% ink smoke so they hold ~5:1 over the bone pages, the accent switcher, a bone-tinted menu tile and a bone "Let's talk →" key right. Links fold into the full-screen menu under 900px. It floats 10–28px from the viewport edges, inside the hero frame on the home page, and hides while scrolling down.
- **Work page (`/work`):** bone ground throughout. Hero: one Caslon statement centred with a Work Sans lede; the work's stills trail the cursor across the first screen (`components/ui/image-trail.tsx`, native cursor kept, no trail on touch). Bento: two ink-lavender panels (radius 12px; media and buttons 8px, pills 4px) on bone. A sidebar of disciplines (lucide icons, lilac for the chosen one, "Coming soon" pills) holds sticky a gap from the top, one screen tall and never scrolling itself, beside a two-column grid of pieces that runs its full length with the page; the two finish level. Each piece's clip plays on hover. Phones fold the sidebar to an icon rail. Content lives in `components/work.ts` (stand-ins until real projects arrive). Same footer as the home page.
- **Featured work (home, after the video grid):** `components/sections/FeaturedWorkSection.tsx`. Follows the accent theme: ground mixed from `--plasma` and ink, the footer's contour lines masked in at 16% `--lilac` as a faint map; a thermal glow under the pointer (`components/ui/heat-field.tsx`: low-res heat grid, cools each frame, ramp plasma → lavender → lilac → bone, CSS-blurred; an idle wanderer keeps it alive on touch). Tanker statement "Work that speaks louder than words." in outline only (transparent fill, bone stroke; letters near the pointer stretch and their outline warms to `--lilac`). A tilted orbit of 16 work cards (`components/ui/orbit-flip-slider.tsx`, tilt mode, cards flip on hover, pause off screen) crosses its last line on desktop and takes its own band under 1100px. Every card and "See all work" go to `/work`; "Get in touch" goes to `/contact`.
