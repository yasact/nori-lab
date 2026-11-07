# Issue #11: タイミング表示を円（1 周 = 1 拍）にして、ドットをつまんでノリを変えられるようにする

## Goal

Add a circular timing dial (1 turn = 1 beat, 12 o'clock = bass beat head) next to the existing 2-beat canvas. Its two dots (表拍 / 裏拍) and the needles joining them to the centre can be dragged with mouse or touch to change 遅れ値 / ハネ値; sliders, numbers, readout and sound follow immediately, and slider changes move the dots. The existing 2-beat canvas, audio, scheduler and presets keep working exactly as now.

## Context

- P1: Timing view is one `<canvas id="cv">` inside `section.panel.scope`, followed by `.legend` and `.readout` — evidence: `index.html:83-98`. CSS `canvas{display:block;width:100%;height:170px}` applies to every canvas — evidence: `index.html:30`.
- P2: `draw()` sizes the canvas from `clientWidth/clientHeight` × `devicePixelRatio`, and is called from 7 places: `update()` (every `sync()`), `loop()` (every animation frame while playing), `stop()`, `resize`, `matchMedia` theme change, `MutationObserver` on `data-theme`, `document.fonts.ready` — evidence: `index.html:249-257`, `432-436`, `448-524`. Anything drawn from inside `draw()` stays in sync with `P` and the playhead for free.
- P3: Playhead `head` is ms inside a 2-beat window (`(beatIdx % 2) * T + elapsed`), `null` when stopped; current chord `curChord` is drawn on `#cv` only — evidence: `index.html:395`, `502-517`.
- P4: State `P = { bpm, lag, dist }` (`index.html:159`); `sync()` writes all sliders/numbers from `P` then calls `update()` → `draw()` (`index.html:163-170`). The scheduler reads `P` on every tick, so changing `P` changes the sound with no audio code changes — evidence: `index.html:403-405`.
- P5: Preset selection is cleared by extra listeners that do `$('preset').value = ''; refresh();` on slider/number input — evidence: `index.html:243-245`. `refresh()` redraws the `#pinfo` tags from `P`. Range `input` events fire only when the value changes.
- P6: Slider ranges: `lag-r` -0.15..0.3 step 0.005, `dist-r` 40..80 step 0.5; `delay-r` is -80..120 ms (its lag range depends on bpm). Number inputs allow wider (lag ±0.5, dist 30..90) and `on()` accepts any finite value — evidence: `index.html:106-119`, `167-170`. So `P` can already be outside the lag/dist slider ranges (e.g. bpm 320 + delay 120 ms => lag 0.64). All `PAPER` / `PRESETS` values are inside the slider ranges (lag -0.04..0.2, dist 50..75) — evidence: `index.html:179-198`.
- P7: An identifier `near` already exists in the same IIFE (`const near = (cands, ref) => ...`, used by `bassBeat`) — evidence: `index.html:386`. Redeclaring it is a SyntaxError that stops the whole script.
- P8: `const cv = $('cv'), g2 = ...` is declared at `index.html:445`; the first `draw()` runs via `sync()` at `index.html:524`.
- P9: Space toggles play unless focus is on a non-range input / select / button / textarea — evidence: `index.html:437-442`. A canvas is not focusable, so the dial does not interact with it.
- P10: Phone width 375px leaves ~305px inside the panel (16px body gutter, 18px `.panel` padding, 1px border each side) — evidence: `index.html:22`, `28`. Phone layout breakpoint is `@media (max-width:560px)` — evidence: `index.html:68`.
- P11: Touch dragging on a canvas needs `touch-action: none`, otherwise the browser takes the gesture for scrolling and fires `pointercancel`; `setPointerCapture` keeps events flowing when the finger leaves the element and throws `NotFoundError` for an inactive pointer id — evidence: MDN setPointerCapture, javascript.info pointer events; issue #11 comment.
- P12: Contrast on `--panel`: `--line` is ~1.3:1 (dark) / ~1.5:1 (light), below the 3:1 non-text guideline; `#cv` draws structure with `--grid` — evidence: `index.html:10-20`, `463-467` (reviewer B).

## Prerequisites

none

## Constraints

- Do not change audio synth, scheduler (`tick`/`start`/`stop` logic), melody/bass generation (including `near` at `index.html:386`), `PRESETS`/`PAPER` data, localStorage handling, the existing `on(...)` slider lines, the Space handler, or the body of `draw()` that paints `#cv` (only append one call, D5) — because: the issue only adds a new view and input; the 2-beat view is kept as-is by user decision (D1).
- Do not touch `AGENTS.md` (untracked, outside this task) — because: orchestrator instruction; it is not part of the repo history.
- Single file, no libraries; external loads remain Google Fonts only — because: project rule (CLAUDE.md).
- Colors come from existing CSS tokens (`--down` 表拍, `--up` 裏拍, `--grid`, `--ink`, `--mute`) read via `css()` at draw time — because: light/dark themes must both work with the existing scheme.
- Drag hit targets are at least 44×44 CSS px (dot hit radius ≥ 22px) — because: issue requirement for phone touch.
- No horizontal scroll at 375px viewport width — because: phone target.
- Values written by dragging stay within the lag/dist slider ranges: lag -0.15..0.3, dist 40..80 — because: user decision (D2).
- New helper names must not collide with existing identifiers in the IIFE (notably `near`, `clamp` if added, `draw`, `head`) — because: P7.

## Decisions

### D1: Relation to the current 2-beat view

- use: show both. Wrap `#dial` (new) and `#cv` in one flex row: dial on the left, 2-beat canvas on the right taking the remaining width. At `max-width:560px` stack them vertically, dial first and centred.
- because: the circle is for touching and seeing the ratio; the 2-beat view keeps what only it shows (2 beats in a row, ms distance from the grid, current chord). Smallest change to existing behavior.
- by: user (grill Q1)
- rejected:
  - tab switching — because: cannot compare both at once, and adds tab UI plus remembered state.
  - circle only — because: loses the ms dimension line, the 2-beat sequence and requires moving the chord display.

### D2: Drag range

- use: clamp to the lag/dist slider ranges (lag -0.15..0.3, dist 40..80). A dot stops at the limit and stays pinned until the pointer comes back; it never jumps.
- because: the 遅れ値 and ハネ値 sliders share the same reachable range as the circle, so those two sliders never sit pinned while the dot keeps going (the ms slider `delay-r` can still pin, as it already does today, P6); dist ≥ 40 also makes it impossible for the 表拍 dot to pass the 裏拍 dot. All presets fit (P6).
- by: user (grill Q2)
- rejected:
  - number-input range (lag ±0.5, dist 30..90) — because: the lag/dist sliders pin at their ends while the dot moves on.
  - unlimited (only prevent overtaking) — because: allows meaningless values far outside the studied range.

### D3: Drag semantics (from the owner's issue comment)

- use:
  - 表拍 dot: changes lag AND dist so that 裏拍値 (`lag + dist/100`) stays constant — the 裏拍 dot does not move.
  - 裏拍 dot: changes dist only; lag unchanged.
  - needle (either one): changes lag only; dist unchanged — both dots rotate together.
  - hit priority: dot > needle.
- because: lets the user do both "keep 裏拍 position" (dot, issue option B) and "keep ハネ" (needle, issue option A) without a mode switch.
- by: user (issue #11 comment)
- rejected:
  - single behavior A or B only — because: the owner explicitly asked for both.

### D4: Value quantisation while dragging

- use: round lag to 0.005 and dist to 0.5 (the slider steps) with `+(Math.round(x / step) * step).toFixed(3)`, then clamp. For the 表拍 dot, the dist is derived from the rounded lag; when 裏拍値 at drag start is off the 0.005 grid (from `delay-r` ms input or a saved preset with 4 decimals), the 裏拍 dot may move by up to 0.0025 beat.
- because: the dot then represents exactly a value the sliders can show, so dragging and slider stay identical; `toFixed(3)` drops float tails like 0.07500000000000001 from `P` and saved presets. A sub-pixel 裏拍 shift (0.0025 beat ≈ 0.9°) is invisible and not worth a special case.
- by: research (agent), review
- rejected:
  - unrounded values — because: slider snaps to a different value than the dot shows, and saved presets carry noise.

### D5: Where the dial drawing hooks in

- use: new function `drawDial()` called as the last line of the existing `draw()`.
- because: `draw()` already runs on all 7 triggers (P2); one call gives the dial all of them. The body of `draw()` that paints `#cv` stays unchanged.
- by: research (agent)
- rejected:
  - separate rAF loop / separate call sites — because: duplicates the existing triggers.
  - draw only in rAF during drag (P update in pointermove, paint later) — because: browsers already deliver pointermove at most once per frame, so `sync()` per move costs one extra paint at most.

### D6: Keyboard / screen reader

- use: dial is pointer-only; canvas gets `role="img"` and an `aria-label`; the sliders remain the keyboard-accessible control for the same values.
- because: user confirmed "キーボードで円を操作する仕組みは作らない" in the scope check; sliders already provide the same input.
- by: user (scope check)
- rejected:
  - ARIA slider semantics on the dial — because: out of scope by user decision; duplicates the existing sliders.

### D7: Rendering technology

- use: `<canvas>` with point-to-circle / point-to-segment hit tests, same as `#cv`.
- because: the owner's issue comment specifies canvas + `touch-action:none` + point-to-segment hit test; one rendering approach in the file is easier to maintain.
- by: user (issue #11 comment)
- rejected:
  - inline SVG with transparent hit strokes — because: departs from the owner's implementation memo, and per-child `touch-action` support on SVG elements in iOS Safari is unverified, so the main benefit (scrolling on empty dial area) is not guaranteed.

### D8: Drag model — relative, cumulative angle

- use: all three modes use the same model. At pointerdown store the start values (clamped into the slider ranges) and the pointer fraction. On each move, unwrap the new pointer fraction against the previous one (`unwrap(a, prev)` = `a + k`, integer `k`, closest to `prev`), accumulate `acc = pointerFraction - startPointerFraction`, and compute the new value from `start + acc`, then clamp.
- because: an absolute "dot follows pointer" model makes the dot jump to the pointer on the first move (hit radius 22px ≈ ±15° on a 84px radius), and unwrapping against the clamped value makes a pinned dot warp to the opposite limit once the pointer passes half a turn beyond it. Relative cumulative angle fixes both with one code path.
- by: review (A2/A3, B3)
- rejected:
  - absolute angle with unwrap against the current value — because: warps across limits and jumps on grab (reasons above).

## Reuse

- existing: `css()`, `$()`, `sync()`, `refresh()`, `P`, `head`, the `devicePixelRatio` sizing pattern in `draw()` — `index.html`
- do not reuse the name `near` (P7); the new unwrap helper is named `unwrap`.

## Steps

### Step 1: Dial markup, layout and drawing

- run-by: agent
- files:
  - `index.html` (change) — markup, CSS, `dialGeom()`, `drawDial()`
- change:
  - Markup: in `section.panel.scope`, wrap the existing `<canvas id="cv" ...>` in `<div class="views">` and put `<canvas id="dial" role="img" aria-label="円のタイミング表示（1周＝1拍。丸と針をドラッグで調整）"></canvas>` before it. `#cv` keeps its attributes.
  - CSS: `.views{display:flex;gap:16px;align-items:center}`; `#dial{flex:none;width:220px;height:220px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}`; `#cv{flex:1 1 0;min-width:0}`. In the existing `@media (max-width:560px)` block: `.views{flex-direction:column;align-items:stretch}`, `#dial{align-self:center}`, `#cv{flex:none}` (keeps its 170px height in a column flex).
  - Declare `const dial = $('dial'), g3 = dial.getContext('2d');` right after `const cv = ...` at `index.html:445` — because: `draw()` runs from `sync()` at line 524; declaring later would hit the TDZ.
  - `dialGeom()`: returns `{W, H, cx, cy, R}` from `dial.clientWidth/clientHeight`, with `R = min(W,H)/2 - 26`. Used by both `drawDial()` and the pointer handlers — because: one geometry source keeps the hit test aligned with the drawing.
  - Angle convention: beat fraction `f` → clockwise from 12 o'clock, `x = cx + R*sin(2πf)`, `y = cy - R*cos(2πf)`.
  - `drawDial()`: resize the backing store only when `dial.width !== Math.round(W*dpr)` (same for height) — because: with non-integer DPR (1.25, 2.625, browser zoom) the unrounded comparison is always true and would reallocate every frame. Draw, in order:
    - rim circle in `--grid`, 1.5px — because: `--line` is below 3:1 contrast (P12)
    - thick tick at 12 o'clock in `--grid` with label `拍頭` placed inside the rim just below the tick; dashed tick at 6 o'clock in `--grid` at 45% alpha (ストレートの裏 = 0.5, matches the legend)
    - arc along the rim from 表拍 to 裏拍 (`f = P.lag` → `P.lag + P.dist/100`) in `--down` at 22% alpha, ~8px wide — because: shows which arc is the ハネ value and keeps the clockwise order readable when 裏拍値 > 1; matches the 22% bands in `#cv`
    - two needles from centre to each dot in `--mute`, 3px, round caps, joined at a small centre disc
    - 表拍 dot at `f = P.lag` in `--down`, 裏拍 dot at `f = P.lag + P.dist/100` in `--up`; visible dot radius 9px; labels `表` / `裏` outside the rim next to each dot
    - playhead: when `head !== null`, a 1.5px `--ink` line at 70% alpha from centre to the rim at `f = (head % T) / T` where `T = 60000 / P.bpm`
  - Append `drawDial();` as the last statement of `draw()`.
- behavior:
  - lag < 0 (前ノリ) => 表拍 dot sits left of 12 o'clock — because: angle is lag × 360° and negative goes counter-clockwise (issue).
  - lag 0 => 表 label outside the rim, 拍頭 label inside — they do not overlap — because: 7 of the 15 presets have lag 0.
  - Values outside slider range (typed in the number boxes or via `delay-r` at high bpm, e.g. lag 0.45) => dial still draws them at their true angle; only dragging is clamped — because: D2 limits dragging, not display.
  - Theme switch / resize => dial redraws with new colors/size via the existing `draw()` triggers — because: D5.
- verify:
  - lag 0, dist 50 => 表拍 dot at 12 o'clock, 裏拍 dot at 6 o'clock, labels not overlapping
  - lag 0.075, dist 60 (default) => 表拍 at 27°, 裏拍 at 243°
  - press play => thin playhead line rotates once per beat; stop => it disappears
  - 375px viewport => dial (220px) centred above the 2-beat canvas, `#cv` 170px tall, no horizontal scroll; 561px and ≥ 800px => side by side
  - dark and light theme => rim, needles, dots visible

### Step 2: Pointer dragging

- run-by: agent
- files:
  - `index.html` (change) — pointer handlers on `#dial`, drag math with a load-time self-check
- change:
  - Helpers: `frac(x, y, g)` = `atan2(x - g.cx, -(y - g.cy)) / 2π` normalised to [0,1); `unwrap(a, ref)` = `a + k` (integer k) closest to `ref`; `snap(x, step)` = `+(Math.round(x / step) * step).toFixed(3)`; a clamp helper (named so it does not collide, P7).
  - Pure function `dialValue(mode, s, acc)` → `{lag, dist}`, where `s = {lag, dist}` are the start values already clamped to slider ranges and `acc` is the cumulative pointer rotation in beats:
    - `down`: `ura = s.lag + s.dist/100`; `lag = clamp(snap(s.lag + acc, 0.005), lo, hi)` with `lo = max(-0.15, ura - 0.8)`, `hi = min(0.3, ura - 0.4)`; `dist = clamp(snap((ura - lag) * 100, 0.5), 40, 80)`. Because start values are clamped, `ura` is in [0.25, 1.1] and `lo ≤ hi` always holds.
    - `up`: `lag = s.lag`; `dist = clamp(snap(s.dist + acc * 100, 0.5), 40, 80)`.
    - `needle`: `dist = s.dist`; `lag = clamp(snap(s.lag + acc, 0.005), -0.15, 0.3)`.
  - Right after `dialValue`, a few `console.assert` lines that run once on load, covering: crossing 12 o'clock (`down` from s = {lag 0.02, dist 60} with acc -0.05 => lag -0.03, dist 65), overshooting a limit by more than half a turn (`up` from dist 60 with acc 0.9 => dist 80), `down` hitting the dist limit (default s = {0.075, 60}, acc -0.3 => lag -0.125, dist 80), and `needle` keeping dist — because: the clamp/unwrap/round logic is non-trivial and there is no test runner; asserts are silent when they pass.
  - Drag state `drag = null | {id, mode, s, a0, prev}`.
  - `pointerdown` on `#dial`: if `drag` is set, ignore (second finger). Compute `g = dialGeom()` and the pointer position in CSS px (relative to `dial.getBoundingClientRect()`). Hit test: 1) dots: distance to a dot centre ≤ 22 → `down` / `up` (nearest if both). 2) needles: only when distance from centre ≥ 0.3R, and point-to-segment distance (centre→dot) ≤ 22 → `needle`. 3) else return (no capture, no change). On hit: `preventDefault()`, `try { dial.setPointerCapture(e.pointerId) } catch {}`, set `drag = {id: e.pointerId, mode, s: {lag: clamp(P.lag, -0.15, 0.3), dist: clamp(P.dist, 40, 80)}, a0: frac(...), prev: a0}`.
  - `pointermove`: return unless `drag && e.pointerId === drag.id`. If the pointer is within 12px of the centre, return without updating `prev` — because: atan2 is unstable there. Else `a = unwrap(frac(...), drag.prev)`; `drag.prev = a`; `v = dialValue(drag.mode, drag.s, a - drag.a0)`. Only if `v.lag !== P.lag || v.dist !== P.dist`: `P.lag = v.lag; P.dist = v.dist; sync(); $('preset').value = ''; refresh();`.
  - `pointerup`, `pointercancel`, `lostpointercapture` with matching id => `drag = null`.
- behavior:
  - Drag a dot or needle => sliders, number boxes, readout, both canvases and the next scheduled notes change on the same move — because: `sync()` writes everything from `P` and the scheduler reads `P` each tick (P4).
  - A move that changes lag or dist => 「誰風で吹く？」 shows 「（自分で調整中）」 and `#pinfo` updates — because: issue says dragging behaves like the sliders, and range sliders only fire on value change (P5). Touch/press without a value change (tap, jitter, pinned at a limit) => preset selection and values unchanged.
  - Grab a dot off-centre => the dot does not jump to the pointer; it moves by the pointer's rotation — because: D8.
  - 表拍 drag would push dist outside 40..80 or lag outside -0.15..0.3 => 表拍 dot stops at the limit and the 裏拍 dot does not move; keep turning past the limit, even more than half a turn => dot stays pinned, moves again only when the pointer comes back — because: D2, D3, D8.
  - Needle drag past lag limits => both dots stop together — because: D2.
  - Drag starts while lag/dist are outside the slider ranges (number box or `delay-r` at high bpm) => on the first value-changing move, lag and dist are clamped into the ranges (in `up` mode lag is clamped too; in `needle` mode dist is clamped too) — because: D2; clamping the start values also guarantees the `down` range is non-empty.
  - Press near the centre (< 0.3R, not on a dot) => nothing happens; pointer passes within 12px of the centre during a drag => that move is ignored — because: angle is unstable near the centre.
  - Second finger while dragging => ignored; only the first pointer drives the drag — because: two pointers writing `P` alternately would make values jitter.
  - Touch on the dial area (including empty parts) => the page does not scroll there; touch on `#cv` and elsewhere still scrolls — because: `touch-action:none` on `#dial` is required for touch drag (P11); this is intended.
  - Empty area pointerdown => no capture, no change — because: no accidental changes.
- verify (Chrome via claude-in-chrome; real mouse drags with `left_click_drag`, or by hand):
  - page load => no `console.assert` failures in the console
  - default (lag 0.075, dist 60, `#r-ura` 0.675): drag 表拍 dot clockwise ~20° => `#lag` rises, `#dist` falls, `#r-ura` stays 0.675, `#preset` shows 「（自分で調整中）」
  - drag 表拍 dot far counter-clockwise => lag stops at -0.125 with dist 80 (`#r-ura` 0.675); keep turning a full extra turn => no jump
  - drag 裏拍 dot => only `#dist` changes
  - drag a needle midway => both dots rotate, `#dist` unchanged
  - select a preset, click a dot without moving => preset stays selected
  - type lag 0.45 in the number box, drag 表拍 dot => lag lands at ≤ 0.3
  - move `lag-r` slider => dots move
  - while playing, drag => playhead keeps rotating, sound timing follows

### Step 3: Update CLAUDE.md

- run-by: agent
- files:
  - `CLAUDE.md` (change) — 構成 section
- change: in `## 構成`, change the 描画 bullet to say the 2-beat canvas is `#cv` and add one bullet: `円の表示 #dial`: 1周=1拍、12時=拍頭、表拍の丸=遅れ値、裏拍の丸=裏拍値。丸ドラッグ=その丸だけ（表拍は裏拍値を保つ）、針ドラッグ=ハネ値を保って両方回る。範囲はスライダーと同じ。ドラッグはつかんだ位置からの回転量で動く。`drawDial()` は `draw()` の最後で呼ぶ。`near` はベース用の既存名。
- behavior:
  - none (docs only)
- verify:
  - `CLAUDE.md` mentions `#dial`, drag semantics, range and the `near` name note

## Risks

- Phone height: the scope panel becomes ~560px tall (220 dial + 170 `#cv` + legend + readout), so on a 667px-tall phone the play button and sliders are below the fold => the user scrolls between them — mitigation: accept; the dial itself shows the value change, and dragging changes the sound while playing — because: user chose stacked layout (D1); shrinking the 2-beat view is out of scope.
- Narrow widths 561px–700px leave `#cv` ~255–390px wide => 2-beat labels may crowd — mitigation: accept; `#cv` already scales by width — because: no new layout rule is worth it for a short width band.

## Final verification

- Open `index.html` in Chrome (file URL; if the extension cannot open file URLs, serve with `python3 -m http.server` from the repo root and open `http://localhost:8000/`) at desktop width and at 375px width; check layout, light and dark — run-by: agent
- Run all Step 1 and Step 2 verify items — run-by: agent
- No console errors or assert failures on load, during playback and while dragging — run-by: agent
- Real phone touch drag (scroll is blocked only on the dial) — run-by: user
- typecheck / lint / test / build: n/a (no tooling in this repo)

## References

- issue #11 and its owner comment (operation proposal)
- MDN Element.setPointerCapture: https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
- javascript.info Pointer events (touch-action): https://javascript.info/pointer-events
- Benadon, circular plot for rhythm: https://www.mtosmt.org/issues/mto.07.13.3/mto.07.13.3.benadon.php

## Review log

- grill: run (2 open decisions: layout Q1, drag range Q2; both answered A) + scope check confirmed by user
- self-check: no gaps
- depth: standard (2 files)
- constructive: renamed helper to avoid `near` collision; relative cumulative-angle drag model (D8); centre dead zone; update only on value change; clamp start values; pointer id / second finger / lostpointercapture / try-catch capture; `dialGeom()` shared; const placement for TDZ; `Math.round(W*dpr)`; `#cv{flex:none}` on phone; label placement; `user-select:none`; numeric verify + load-time asserts; http.server fallback; line numbers fixed
- adversarial: same collision / warp / centre / multi-touch / tap-clears-preset findings (merged with constructive); `delay-r` added to P6 and D2 because; rim in `--grid` (contrast); 表→裏 arc; phone height risk recorded
- not applied: update AGENTS.md (untracked, out of task per orchestrator instruction); inline SVG (rejected in D7); selective touchstart preventDefault for scroll on empty dial area (unverified on iOS, owner memo specifies `touch-action:none`); rAF-only paint during drag (D5 rejected)
- codex: not run (standard depth)
- pending (user decision): none

## Routing

- risky: no — because: none (no auth, no DB, no permissions; single static page)
- tier: light — because: one screen, one new component inside one file, no new external system; logic is geometric but self-contained
- implementer: `claude --model opus`
- confidence: 0.6

## 判断サマリー（人間向け）

- 円は今の 2 拍表示の横に並べる（スマホでは円が上）。2 拍表示はそのまま残る（Q1）
- 丸と針で動かせる範囲はスライダーと同じ（遅れ値 -0.15〜0.30、ハネ値 40〜80%）。端で止まって、行き過ぎても跳ばない（Q2）
- 表拍の丸 = 遅れが変わる（裏拍の丸はその場に残って、その分ハネが変わる）。裏拍の丸 = ハネだけ。針 = 間隔を保って両方回る
- 円はマウス・タッチ専用。キーボードはスライダーで操作する。スマホでは円の上だけ画面スクロールが効かない
