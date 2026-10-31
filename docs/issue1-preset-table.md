# Issue #1: プリセット選択を「誰風で吹く？」の表にする（演奏者向け・スマホ）

## Goal

> Revision 2 (issue #1 comment 「改訂 2」, 2026-10-31): Steps 1–3 are implemented (commits 8b3eb77..643a4fd). The section `## Revision 2` below supersedes the Goal's placement / row-table / selection sentences, D1, D5, D6 (placement only; heading stays), the row/selection parts of D7 and of Step 2, and D4's rejected item "show numbers alongside tags" (R-D3 now adds small numbers). Implement only Step 4, Step 5 and Step 6. The issue addendum 「改訂 2 への追加: Space キー」 overrides the Constraint "Space play/stop behavior stays exactly as now" and the fixed footnote text (see R-D7). Everything else in this plan (other Constraints, D2, D3, D4, save input/button, Final verification) still applies.

Replace the preset area of `index.html` with a vertical table of tappable rows (one row = one preset) grouped as 「プレイヤー」「基本」「保存したノリ」, readable by jazz players on a phone. Everything outside the preset section (timing canvas, readout, sliders and their existing `on(...)` handlers, playback, Space handler, audio, scheduler) stays byte-for-byte the same, except that the preset section moves to directly below the timing panel. Selection clearing is done by extra listeners added inside the preset JS (Step 2), not by editing existing handlers.

## Context

- P1: The preset UI today is four blocks in one panel at the bottom of the page: `#presets` (basic + user presets as wrapped pill buttons), `#paper` (paper medians), save input `#pname` + `#psave`, and a long `.note` paragraph — evidence: `index.html:136-146`
- P2: Presets are rendered by `renderPresets()` with an inner `mk()` that builds `<button>` via `innerHTML`; the delete "×" is a `<span class="del">` nested inside the row button and detected by `e.target.classList` — evidence: `index.html:197-214`. A nested span is not keyboard/screen-reader operable.
- P3: `PRESETS` is `[name, lag, dist%]`; `PAPER` is `[label, lag, dist%, bpm]` with English labels like `"Parker — Billie's Bounce take1 ('45)"` — evidence: `index.html:172-192`
- P4: Slider/number handlers are wired with `on([[id, ev], ...], fn)`; `fn` mutates `P`, then `sync()` runs — evidence: `index.html:166-170`. Preset clicks also call `sync()`, so clearing selection inside `sync()` would wrongly clear it on preset click.
- P5: User presets live in localStorage `nori-lab-presets` as `[{name, lag, dist}]`, read/written by `loadMine()` / `saveMine()`; `saveMine()` swallows exceptions (quota, private mode) — evidence: `index.html:193-195`
- P6: Color tokens `--down` (表拍) / `--up` (裏拍) / `--brass` / `--line` / `--panel` / `--mute` exist for light and dark — evidence: `index.html:9-20`. Global `button` style is a pill (`border-radius:999px`) — evidence: `index.html:50`
- P7: Space toggles play/stop via a document `keydown` handler that skips only `input[type=number]` and calls `preventDefault()` — evidence: `index.html:410-414`. So Space on a focused row button plays/stops instead of activating it; rows are activated by tap or Enter.
- P8: iOS Safari zooms the page when a focused text input renders under 16px; current `#pname` is `.9rem` — evidence: `index.html:34`; research (West Wind, specification.website). Apple/WCAG AAA touch target is 44×44 px.
- P9: Tag thresholds (from issue): タメ by lag: `≤ -0.02` 前ノリ / `< 0.04` ジャスト / `< 0.14` ちょい後ろ / else かなり後ろ. ハネ by hane value (= dist/100): `< 0.54` まっすぐ / `< 0.62` 軽く跳ねる / `< 0.69` 3連くらい / else 強く跳ねる.
- P10: Light-mode contrast (reviewer B): `--up` #b5482f on `--panel` #f7f8f9 is 5.02:1, but on a brass-tinted background (`color-mix(... 14%)` = #ece5da) it drops to 4.27:1, below AA 4.5:1 for small text.

## Prerequisites

none

## Constraints

- Only the preset section changes (markup and position, its CSS, `PRESETS`/`PAPER` data shape, preset render/selection JS, new listeners for selection clearing). Do not touch canvas drawing, readout, slider markup/ranges, the existing `on(...)` lines, the Space `keydown` handler, playback, audio synth, scheduler, melody/bass generation — because: the issue limits scope to the preset area, and a previous attempt that rebuilt the whole screen was discarded.
- No new visualizations (no graphs, scatter plots, maps) and no extra UI beyond what the issue lists — because: issue says so explicitly; users are players, not researchers.
- `PAPER` numbers (lag, dist, bpm) are unchanged; only its array shape/order may change — because: values are paper Table 1 medians and must not drift.
- localStorage key `nori-lab-presets` and item shape `{name, lag, dist}` stay compatible (read old data unchanged, write same shape) — because: existing users' saved presets must keep working.
- Single file, no libraries; external loads remain Google Fonts only — because: project rule (CLAUDE.md).
- Light and dark both work using the existing CSS tokens only — because: existing theming scheme.
- No horizontal scroll at 375px viewport width — because: phone target.
- Space play/stop behavior stays exactly as now — because: issue constraint.
- User-provided preset names are inserted with `textContent`, never `innerHTML` — because: names come from localStorage (user input) and the current regex strip is fragile.
- Do not use the old group wording that the issue update replaced with 「プレイヤー」 in `index.html` or `CLAUDE.md`; the only group headings are 「プレイヤー」「基本」「保存したノリ」 — because: the issue was updated by the owner. This plan file is not part of that check.

## Decisions

### D1: Row element structure

- use: each row is `<div class="prow">` containing one `<button class="pick" data-k="<key>">` (name/sub-line on the left, two tags on the right; the selected row has `aria-current="true"`, other rows have no `aria-current` attribute), plus — for 保存したノリ rows only — a sibling `<button class="del" aria-label="<name> を削除">×</button>`.
- because: a whole-row button gives the ≥44px tap target and native keyboard/screen-reader activation; `aria-current` says "this is the current one" without toggle semantics; a sibling (not nested) delete button is required because interactive elements cannot nest inside `<button>`.
- by: research + review (A5, B5)
- rejected:
  - `<table>` with `<tr>` click handlers — because: rows would not be focusable/operable by keyboard without extra ARIA work; the issue's 「表」 means vertical rows, not a data table.
  - keep the nested `<span class="del">` — because: not focusable and not announced (P2).
  - radio-group (`role=radiogroup` / `<input type=radio>`) — because: "no option selected" is a normal state (slider moves clear it), and it adds markup for no visible gain.
  - `aria-pressed` — because: announces a toggle, implying a re-tap un-selects, which is not the behavior (Step 2).

### D2: Data shape for 「プレイヤー」

- use: `PAPER = [[player, song, year, lag, dist, bpm], ...]` with `player` in katakana exactly as the issue lists, `song` without "take1", `year` as 4-digit number. Ordered by player in the issue's order (チャーリー・パーカー, マイルス・デイヴィス, レスター・ヤング, コールマン・ホーキンス, バディ・リッチ（ドラム）), then by year ascending within a player. Keep a one-line comment that Red Cross / Billie's Bounce are take1 and the source is 井上ほか（2017）表1.
- because: the issue's sub-line example is `Billie's Bounce · 1945 · 168bpm` (no take number, 4-digit year); grouping by player is required; year order reads as each player's chronology.
- by: research (issue text)
- rejected:
  - keep English labels and map to katakana at render time — because: two sources of truth for one display string.
  - keep the original PAPER order — because: it interleaves players, violating 「同じ奏者の行はまとめて並べる」.

Exact data (values copied from current `PAPER`, unchanged):

```
['チャーリー・パーカー', 'Red Cross', 1944, 0.2, 59, 200],
['チャーリー・パーカー', "Billie's Bounce", 1945, 0.19, 60, 168],
['チャーリー・パーカー', 'JATP Blues', 1946, 0.19, 60, 190],
['マイルス・デイヴィス', "Billie's Bounce", 1945, 0.16, 59, 168],
['レスター・ヤング', 'Way Down Yonder In New Orleans', 1938, 0.1, 58, 192],
['レスター・ヤング', 'JATP Blues', 1946, 0.1, 60, 190],
['コールマン・ホーキンス', 'Fine Dinner', 1939, 0, 64, 173],
['コールマン・ホーキンス', 'JATP Blues', 1946, 0, 66, 190],
['バディ・リッチ（ドラム）', 'JATP Blues', 1946, 0, 72, 190],
```

### D3: 「基本」 names

- use: rename `PRESETS` names only, same order and values: `イーブン（ストレート）` (0,50) / `3連` (0,66.7) / `付点（ハネ強め）` (0,75) / `軽めの跳ね` (0,58) / `後ろノリの例` (0.1,58) / `前ノリの例` (-0.04,64). 基本 rows do not change bpm (as now). 基本 rows have no sub-line.
- because: issue lists these names; values must stay so the sound is unchanged.
- by: research (issue text)
- rejected: none

### D4: Tag computation

- use: two pure one-line arrow functions, each on its own line, starting exactly `const tameTag = lag =>` and `const haneTag = dist =>`, implementing P9. `haneTag` compares `dist` in percent against `54 / 62 / 69` (`dist < 54` etc.), equivalent to the issue's `hane < 0.54` rule.
- because: `P.dist`, the sliders and localStorage all hold hane in percent, so comparing without conversion is simplest; the one-line form lets Final verification grep them into node and assert the boundaries (the functions live inside the IIFE, so the browser console cannot call them).
- by: research + review (A4, A6)
- rejected:
  - show numbers alongside tags — because: issue says tags are shown "instead of numbers"; the numeric readout already exists above.

### D5: Selection state

- use: one variable `sel` holding a row key string: `'p'+i` (プレイヤー index in `PAPER`), `'b'+i` (基本 index), `'m'+i` (保存したノリ index), or `null`. A helper `mark()` sets `aria-current="true"` on the `#presets .pick` whose `dataset.k === sel` and removes the attribute from all others. Selection changes call `mark()` only. `renderPresets()` (full rebuild, then `mark()`) runs only at startup, after save, and after delete.
- because: one source of truth; rebuilding on every tap would remove the focused button from the DOM and drop keyboard/screen-reader focus to `body` (A1, B1).
- by: research + review
- rejected:
  - derive selection by comparing current `P.lag/P.dist` to each preset — because: several presets share values (「後ろノリの例」 and レスター・ヤング Way Down… are both 0.1/58; two Parker rows share 0.19/60) so it would highlight multiple rows.
  - rebuild the list on every selection change — because: loses focus (see because above).
- No persistence of `sel` across reloads — because: not asked; initial `P` (0.075/60) matches no preset, so nothing is selected at load.

### D6: Placement and heading

- use: move the preset `<section class="panel">` to directly after `<section class="panel scope">` (before `.controls`). Section heading `<h2>誰風で吹く？</h2>` using existing `h2` style; group headings `<h3>` with a small muted style: `プレイヤー`, `基本`, `保存したノリ`.
- because: issue specifies heading text and position; reusing `h2` keeps the panel look consistent.
- by: research (issue text)
- rejected: none

### D7: Mobile sizing and selected-row look

- use: `#pname` font-size `1rem` (16px); `.pick` `min-height:44px`; `.del` hit area `44×44px` with a small glyph; `#psave` `min-height:44px`. Selected row: `border-color:var(--brass)` + `box-shadow: inset 4px 0 0 var(--brass)` (left band) + bold name; no background tint. Tags have their own `background:var(--panel)`. Tags stack vertically at the right with tight line-height so a one-line row stays near 44px.
- because: P8 — sub-16px inputs trigger iOS zoom on focus; 44px is the issue's row floor and the common touch-target floor, applied to × too so it is hard to miss on a phone. The left band is visible at a glance on a phone without mixing colors, and keeping tags on `--panel` keeps `--up` text at 5.02:1 (P10). Vertical tags leave the name column wide enough at 375px.
- by: research + review (B2)
- rejected:
  - `maximum-scale=1` in viewport meta — because: disables pinch zoom (WCAG 1.4.4) and changes a file-wide setting outside the preset section.
  - brass-tinted background via `color-mix` — because: drops `--up` tag contrast below AA in light mode (P10).
  - tags side by side to shorten the panel (B4) — because: at 375px the remaining name column (~110px) wraps names like コールマン・ホーキンス onto two lines, which makes rows taller anyway; the panel position itself is fixed by the issue.

## Reuse

- existing: `loadMine()` / `saveMine()` / `KEY` (`index.html:193-195`) — unchanged storage I/O
- existing: `P`, `sync()` (`index.html:153-164`) — apply a preset with `P.lag = …; P.dist = …; if (bpm) P.bpm = bpm; sync();` as now
- existing: CSS tokens `--down --up --brass --line --panel --mute --ink --bg` (`index.html:9-20`)
- existing: `.custom` / `.note` styles (`index.html:33-34,63`) — keep, adjust only as D7
- drop: `.presets` flex/pill styles, `.presets .mine`, `.presets .del`, `.presets button b` (`index.html:35-36,60-62`), the `#paper` container and its `<h2>`, the `fmt()` helper, and the long `.note` paragraph — because: replaced by the row table and the short footnote.

## Steps

### Step 1: Data and tag helpers

- run-by: agent
- files:
  - `index.html` (change) — `PRESETS`, `PAPER`, new `tameTag` / `haneTag`
- change: rewrite `PRESETS` names per D3, `PAPER` per D2 (exact rows above), add `tameTag` / `haneTag` per D4 (one line each). Update the comments above both arrays to describe the new shapes (`[名前, 遅れ値, ハネ値(%)]` and `[奏者, 曲, 録音年, 遅れ値, ハネ値(%), 録音テンポ]`). `fmt` is removed in Step 2, not here. The old `renderPresets()` still reads old PAPER indexes, so between Step 1 and Step 2 the preset list renders wrongly; verify Step 1 with node only.
- behavior:
  - `tameTag`: `lag <= -0.02` => `前ノリ`; `lag < 0.04` => `ジャスト`; `lag < 0.14` => `ちょい後ろ`; else `かなり後ろ`
  - `haneTag`: `dist < 54` => `まっすぐ`; `dist < 62` => `軽く跳ねる`; `dist < 69` => `3連くらい`; else `強く跳ねる`
- verify:
  - every numeric triple (lag, dist, bpm) in new `PAPER` matches a row of the old `PAPER` (`git diff main -- index.html` review), 9 rows total
  - the tag self-check command in Final verification passes
  - expected tags (タメ / ハネ) for UI check in Step 2: イーブン ジャスト/まっすぐ; 3連 ジャスト/3連くらい; 付点 ジャスト/強く跳ねる; 軽めの跳ね ジャスト/軽く跳ねる; 後ろノリの例 ちょい後ろ/軽く跳ねる; 前ノリの例 前ノリ/3連くらい; パーカー×3 かなり後ろ/軽く跳ねる; デイヴィス かなり後ろ/軽く跳ねる; ヤング×2 ちょい後ろ/軽く跳ねる; ホーキンス×2 ジャスト/3連くらい; リッチ ジャスト/強く跳ねる

### Step 2: Preset section markup, CSS, render and selection

- run-by: agent
- files:
  - `index.html` (change) — preset `<section>` markup and position, preset CSS, `renderPresets()` + `mark()`, save/delete handlers, new selection-clearing listeners, remove `fmt`
- change:
  - Markup (moved to right after the `.scope` section):
    - `<h2>誰風で吹く？</h2>`
    - `<div id="presets"></div>` (all groups rendered into it; remove `#paper`)
    - `.custom` row: `<input type="text" id="pname" placeholder="名前（例：自分のノリ）" aria-label="プリセット名">` + `<button id="psave">今のノリを保存</button>`
    - footnote `<p class="note">`: `プレイヤーの値は、録音を 1 音ずつ測った研究（井上裕章ほか, 音楽知覚認知研究 23(1), 2017）の中央値。押すと録音のテンポになる。バディ・リッチはドラム（ハイハット）の値。保存したノリはこのブラウザにだけ残る。` (exact text; the old long note is deleted)
  - Render (`renderPresets()` rebuilds `#presets`, then calls `mark()`): for each group in order プレイヤー (PAPER) → 基本 (PRESETS) → 保存したノリ (`loadMine()`), append `<h3>` group heading then rows (D1). Row content: name (`textContent`), optional sub-line `<small>` = `` `${song} · ${year} · ${bpm}bpm` `` (U+00B7 middle dots) for プレイヤー rows only, tags `<span class="tag tame">` (tameTag) and `<span class="tag hane">` (haneTag).
  - CSS (replace dropped `.presets` rules): `.prow` `display:flex`; `.pick` `flex:1 1 auto; min-width:0; min-height:44px; border-radius:8px` (override pill), left-aligned, flex with name block `min-width:0; overflow-wrap:anywhere` and tags block `flex:none` stacked vertically at the right (`white-space:nowrap`); `.pick[aria-current="true"]` per D7; `.tag` small font (~.75rem), `background:var(--panel)`, 1px border; `.tag.tame` text/border `var(--down)`, `.tag.hane` text/border `var(--up)`; `.del` `flex:none` 44×44, no border, `color:var(--mute)`; `h3` small muted; `#pname` `font-size:1rem`; `#psave` `min-height:44px`.
  - Selection clearing: inside the preset JS, add listeners (do not edit the existing `on(...)` lines): `[['delay-r','input'],['delay','change'],['lag-r','input'],['lag','change'],['dist-r','input'],['dist','change']]` each => `if (sel !== null) { sel = null; mark(); }`. No listener on `bpm-r` / `bpm`.
- behavior:
  - tap/Enter on プレイヤー row i => `P.lag`, `P.dist`, `P.bpm` set from the row, `sync()` (canvas, readout, sliders update), `sel = 'p'+i`, `mark()`; focus stays on that button — because: issue says pressing sets the recording tempo; focus must survive for keyboard users.
  - tap/Enter on 基本 row i => `P.lag`, `P.dist` set, bpm unchanged, `sync()`, `sel = 'b'+i`, `mark()`
  - tap/Enter on 保存したノリ row i => `P.lag`, `P.dist` set, bpm unchanged, `sync()`, `sel = 'm'+i`, `mark()`
  - tap the already-selected row => values re-applied, `sel` unchanged (stays selected) — because: the sound still is that preset, so there is no reason to clear it.
  - move/edit 遅れ (ms) or 遅れ値 or ハネ値 (slider or number input) => `sel = null`, `mark()`, no row selected — because: the shown preset no longer matches the sound. Number inputs count too because they change the same values.
  - move/edit テンポ only => selection unchanged — because: issue says tempo moves keep it (lag is tempo-independent).
  - press 「今のノリを保存」 => append `{name, lag:+P.lag.toFixed(4), dist:P.dist}` to localStorage (same as now; empty name falls back to `保存 N` as now), clear input, then re-read `loadMine()`: if its length grew => `sel = 'm'+(length-1)`; else (save failed silently, P5) => `sel` unchanged; `renderPresets()`. The 保存したノリ group appears if it was hidden and the new row is selected — because: `sel` must never point at a row that was not stored.
  - press × on 保存したノリ row i => remove item i from localStorage, then: `sel === 'm'+i` => `sel = null`; `sel` is `'m'+j` with `j > i` => `sel = 'm'+(j-1)`; other `sel` unchanged; `renderPresets()`; then focus the × of the row now at index i, else the × at i-1, else `#pname` — because: the pressed button is removed, and focus must not fall to `body`. Sound/sliders unchanged. No confirm dialog (as now).
  - 保存したノリ empty (no key, `[]`, or unparsable JSON → `loadMine()` returns `[]`) => no 「保存したノリ」 heading and no rows — because: issue says hide the heading when nothing is saved.
  - old saved items `{name, lag, dist}` => render with tags computed from their lag/dist; names via `textContent` (any `<`, `&` shown literally).
  - Space while a row or × is focused => play/stop (existing P7 handler), not row activation — because: Space handler is unchanged by constraint.
- verify:
  - `node --check` (Final verification)
  - browser at 375px width, light and dark: no horizontal scroll, checked on the バディ・リッチ（ドラム） row, the `Way Down Yonder In New Orleans · 1938 · 192bpm` row (wraps inside the row), and a saved row with a long name; rows ≥44px tall; selected row shows the brass left band
  - tap a プレイヤー row => tempo field shows the recording bpm and the row is selected; tap it again => still selected; move テンポ slider => still selected; move ハネ slider => no row selected
  - save with name `<b>x` => row shows `<b>x` literally and is selected; reload => row still listed, nothing selected; × => row removed, focus on the next ×/`#pname`; heading disappears when the list becomes empty
  - Tab to a row, Enter => preset applied; Tab again => focus moves to the next row (not page top); × reachable by Tab, announced as `<name> を削除`
  - `grep -c 'プレイヤー' index.html` ≥ 2 (heading + footnote) and the old group wording returns no match in `index.html`

### Step 3: Update CLAUDE.md

- run-by: agent
- files:
  - `CLAUDE.md` (change) — preset description and `PAPER` shape
- change:
  - "ユーザープリセット" line: keep key and `{name, lag, dist}`; mention UI group name 「保存したノリ」.
  - Add a short line describing the preset UI: section 「誰風で吹く？」 below the timing panel, groups プレイヤー (`PAPER`) / 基本 (`PRESETS`) / 保存したノリ, rows show タメ/ハネ tags from `tameTag`/`haneTag` (thresholds as P9), selection held in `sel`.
  - TODO line about `PAPER`: describe the new shape `[奏者, 曲, 録音年, 遅れ値, ハネ値(%), 録音テンポ]` (katakana player names) instead of "(Hawkins/Young/Parker/Rich/Davis、録音テンポつき)"; keep the rest of that TODO (book-only types not supported, no guessed values).
- behavior:
  - none (docs only)
- verify:
  - `git diff main -- CLAUDE.md` touches only the preset-related lines

## Revision 2

Source: issue #1 comment 「改訂 2（実物を見てのフィードバック）」. Only what that comment says changes; no other design changes.

### R-Context

- RP1: After Steps 1–3 the preset `<section class="panel">` sits between `.scope` and `.controls`, renders rows (`.prow` / `.pick` / `.tags` / `.del`, `#presets h3`) via `renderPresets()`, tracks `sel` + `mark()`, and clears `sel` via listeners on delay/lag/dist inputs — evidence: `index.html` (current branch HEAD)
- RP2: Existing global `select` style is a pill with `font-size:.9rem`, `max-width:100%` — evidence: `index.html:51`. iOS Safari zooms on focus for selects under 16px too (same research as P8).
- RP3: `update()` (outside the preset section) refreshes readout on every slider/number change; the preset section must refresh its own summary line through its own listeners, because Constraints forbid editing `update()` / `on(...)`.

### R-D1: Preset picker is one native `<select id="preset">`

- use: one `<select id="preset">` labelled by the section heading (`<h2 id="preset-h">誰風で吹く？</h2>` + `aria-labelledby="preset-h"`). Options in order:
  1. `<option value="">（自分で調整中）</option>`
  2. `<optgroup label="プレイヤー">` — one option per `PAPER` row, `value="p<i>"`, text `` `${player} — ${song} '${String(year).slice(2)}` `` (U+2014 em dash with spaces, ASCII apostrophe), e.g. `チャーリー・パーカー — Billie's Bounce '45`
  3. `<optgroup label="基本">` — `value="b<i>"`, text = name only
  4. `<optgroup label="保存したノリ">` — `value="m<i>"`, text = saved name (via `textContent`); this optgroup is omitted when `loadMine()` is empty
- The select's `value` is the single source of truth for the selection; the `sel` variable and `mark()` are removed.
- because: issue 改訂 2 asks for one compact native select (OS wheel on phones), grouped by optgroup, with these exact option texts.
- by: user (issue 改訂 2)
- rejected:
  - keep the row table — because: user saw it and asked for a compact select.
  - a separate apply button — because: issue says apply on selection.

### R-D2: Behavior of the select

- `change` to a `p`/`b`/`m` value => apply that preset exactly as before (`P.lag`, `P.dist`, and `P.bpm` only for プレイヤー; then `sync()`), then refresh the summary line (R-D3) and the delete button (R-D4) — because: issue says apply at the moment of choosing.
- `change` to `""` (user picks 「（自分で調整中）」 manually) => no change to `P`; refresh summary line and hide delete button — because: nothing to apply; the current slider values stay.
- slider/number input on 遅れ(ms) / 遅れ値 / ハネ値 => `#preset.value = ""` (「（自分で調整中）」), hide delete button, refresh summary line — because: issue says moving 遅れ/ハネ selects 「（自分で調整中）」.
- slider/number input on テンポ => select value unchanged; summary line refreshed (bpm part changes) — because: issue says tempo-only moves don't change the selection, and the line shows the current bpm.
- Initial load => value `""`, summary line shows current `P` (e.g. `ちょい後ろ 0.07 · 軽く跳ねる 0.60 · 180bpm` for the default 0.075/60/180 — exact rounding per R-D3).
- Re-rendering the options (after save/delete) keeps the given value — because: the select is rebuilt and must not jump back to the top option by accident.
- Re-choosing the option that is already selected => nothing happens (native `select` fires no `change`). Do not add workaround code (no resetting value after apply, no option `click` handlers) — because: resetting would hide the selection the issue wants shown, and option clicks do not fire on iOS. Accepted limit, see Risks.
- One function `refresh()` does all view updates: rebuild `#pinfo` from `P` (R-D3), set `#pdel.hidden = !#preset.value.startsWith('m')`, and set `#pdel`'s `aria-label` to `` `${name} を削除` `` of the selected saved item. Called at init, on select `change`, after save, after delete, and from the two listener groups below — because: spreading hidden/aria-label updates over several handlers lets the label go stale (e.g. switching saved A → B leaves 「A を削除」).
- Listener groups, added inside the preset JS after the existing `on(...)` lines (same-element listeners run in registration order, and `on` must update `P` before `refresh()` reads it):
  - 遅れ/ハネ: `[['delay-r','input'],['delay','change'],['lag-r','input'],['lag','change'],['dist-r','input'],['dist','change']]` => `#preset.value = ''` then `refresh()`
  - テンポ: `[['bpm-r','input'],['bpm','change']]` => `refresh()` only

### R-D3: Summary line under the select

- use: one `<p id="pinfo">` under the select, rebuilt from the current `P` every refresh (not from the preset data), so it is correct both for presets and for 「（自分で調整中）」. Content, in order:
  - `<span class="tag tame">` = `tameTag(P.lag)` then `<small class="v">` = `P.lag.toFixed(2)`
  - ` · `
  - `<span class="tag hane">` = `haneTag(P.dist)` then `<small class="v">` = `(P.dist/100).toFixed(2)`
  - ` · ` then `<small class="v">` = `` `${P.bpm}bpm` ``
  - Example from the issue: `かなり後ろ 0.19 · 軽く跳ねる 0.60 · 168bpm`
- a text space `' '` between each tag span and its number, so it reads `かなり後ろ 0.19` like the issue example.
- the tag word is computed from the rounded values shown: `const l = +P.lag.toFixed(2), h = +(P.dist/100).toFixed(2)`; tags = `tameTag(l)` and `haneTag(h*100)`, numbers = `l.toFixed(2)` / `h.toFixed(2)` — because: otherwise e.g. lag 0.1399 shows 「ちょい後ろ 0.14」 although 0.14 is the かなり後ろ threshold. Thresholds unchanged; PAPER/PRESETS values are 2-digit so preset results do not change.
- style: keep the existing `.tag` / `.tag.tame` (`--down`) / `.tag.hane` (`--up`) rules; `#pinfo{margin:8px 0 0; font-size:.75rem; color:var(--mute)}` (so the ` · ` separators are small and muted); `.v{font-family:var(--f-num); font-size:.9em; color:var(--mute)}` (numbers one step smaller than the words).
- because: issue keeps the tag words, adds small monospace numbers in a muted color, and wants the line also for 「（自分で調整中）」; building from `P` covers every case with one code path.
- rejected:
  - build the line from the selected preset's stored values — because: wrong for 「（自分で調整中）」 and duplicates `P`.

### R-D4: Delete button for 保存したノリ

- use: `<button id="pdel" hidden>削除</button>` next to the select (same row, flex-wrap). Shown only when `#preset.value` starts with `m`; `aria-label` = `` `${name} を削除` `` for the selected item.
- click => remove that item from localStorage (`loadMine` / `splice` / `saveMine`), rebuild options from a fresh `loadMine()` (so UI matches storage even if the save failed silently) with value `""` (「（自分で調整中）」), `refresh()`; move focus to `#preset` only when the click came from the keyboard (`e.detail === 0`) — because: when the button hides, keyboard focus must not fall to `body`, but calling `focus()` on a select after a tap may pop the iOS picker unexpectedly. `P` / sliders / sound unchanged. No confirm dialog (as before).
  - because: the deleted preset no longer exists, and the sound is now just "the current values"; focus must not fall to `body` when the button hides.
- by: user (issue 改訂 2) for the button; research for the after-delete behavior.

### R-D5: Save

- Input `#pname`, button `#psave`, fallback name `保存 N`, `{name, lag, dist}` shape, and footnote stay as they are now.
- after save => rebuild options; if `loadMine().length` grew => `#preset.value = 'm'+(length-1)` and show the delete button; else (save silently failed) => keep the previous value — because: the new item should be the selected one (as in the original issue), and the select must never point at an item that was not stored.

### R-D6: Placement, sizing, cleanup

- Placement: move the preset `<section class="panel">` back to after `<section class="panel controls">` (order: `.scope` → `.controls` → preset section) — because: issue 改訂 2.
- Row wrapper: `display:flex; gap:8px; align-items:center` (no wrap). `#preset`: `font-size:1rem` (16px), `min-height:44px`, `flex:1 1 0; min-width:0` — because: same iOS-zoom/touch reasons as D7; with `flex-basis:auto` the select takes the width of its longest option (`レスター・ヤング — Way Down Yonder In New Orleans '38`, ~430px) and pushes `#pdel` onto the next line at 375px (measured by reviewer in Chromium); basis 0 keeps both on one row and the native select truncates its text. Keep the global `select` pill look otherwise.
- `#pdel`: `flex:none; min-height:44px`, no `display` rule — because: a `display` value would override the `hidden` attribute.
- Remove all row-table code: CSS `#presets h3`, `.prow`, `.pick*`, `.info`, `.tags`, `.del`; JS `sel`, `mark`, the row `group()` rendering, the `.del` focus logic, `#presets` container. Keep `el()` only if still used. Keep `tameTag` / `haneTag`, `PAPER`, `PRESETS`, `loadMine` / `saveMine`.
- because: issue says not to leave unused code.

### R-D7: Space key (issue comment 「改訂 2 への追加: Space キー」)

- use: change only the condition of the existing document `keydown` handler (`index.html`, `e.code === 'Space'` block) so that it does nothing (no `preventDefault`, no play/stop) when `e.target` is a `HTMLSelectElement`, a `HTMLButtonElement`, a `HTMLTextAreaElement`, or a `HTMLInputElement` whose `type` is not `range`. Otherwise (page body, range sliders, any other element) it keeps `preventDefault(); playing ? stop() : start();`. One condition line, e.g. `const t = e.target, skip = t instanceof HTMLSelectElement || t instanceof HTMLButtonElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== 'range');`.
- because: the addendum says Space must keep the native behavior on text inputs (name), select, button and checkbox, and keep play/stop elsewhere including sliders. "input except range" covers text, number (already skipped today) and checkbox in one rule.
- behavior:
  - focus in `#pname` + Space => a space character is typed; playback unchanged (also during IME conversion) — because: native behavior.
  - focus on `#preset` + Space => browser's native select behavior; playback unchanged.
  - focus on a checkbox + Space => checkbox toggles; playback unchanged.
  - focus on `#play` + Space => native button activation fires `click` => play/stop toggles once (via the existing click handler, not twice) — because: the handler skips buttons, so only the native click runs.
  - focus on `#psave` / `#pdel` + Space => that button's click (save / delete); playback unchanged.
  - focus on a range slider, or on the page body (nothing focused) + Space => play/stop as now; page does not scroll (`preventDefault`).
- by: user (issue addendum)
- footnote: append `スペースキーで再生／停止。` to the end of the existing footnote `<p class="note">` text (same paragraph, same small style). Final text: `プレイヤーの値は、録音を 1 音ずつ測った研究（井上裕章ほか, 音楽知覚認知研究 23(1), 2017）の中央値。押すと録音のテンポになる。バディ・リッチはドラム（ハイハット）の値。保存したノリはこのブラウザにだけ残る。スペースキーで再生／停止。` — because: the addendum restores the hint.

### Step 4: Replace the row table with the select (Revision 2)

- run-by: agent
- files:
  - `index.html` (change) — preset section markup + position, preset CSS, preset JS
- change: implement R-D1 … R-D6. Markup of the section: `<h2 id="preset-h">誰風で吹く？</h2>`, a flex-wrap row with `#preset` + `#pdel`, `<p id="pinfo">`, then the existing `.custom` save row and footnote unchanged. Listeners for R-D2 are added inside the preset JS (do not edit `on(...)`, `update()`, `sync()`, the Space handler).
- behavior: as R-D2, R-D4, R-D5 (each `=>` line there is the spec).
- verify:
  - `node --check` and the tag self-check (Final verification) pass — run-by: agent
  - leftover check returns 0 lines — run-by: agent: `grep -nE "prow|\.pick|'pick'|\.info|'info'|\.tags|'tags'|\.del\b|'del'|\.nm\b|'nm'|mark\(|\bsel\b|id=\"presets\"|\\\$\('presets'\)|group\(" index.html` (does not hit melody `pick(` or `'nori-lab-presets'`; `.tag*` rules are kept on purpose)
  - section order in markup: `.scope`, `.controls`, then the preset section — run-by: agent
  - browser checks — run-by: agent where a headless browser is available, else user:
    - initial line `ちょい後ろ 0.07 · 軽く跳ねる 0.60 · 180bpm`, select at 「（自分で調整中）」
    - choose `チャーリー・パーカー — Billie's Bounce '45` => tempo 168, line `かなり後ろ 0.19 · 軽く跳ねる 0.60 · 168bpm`; move テンポ => select unchanged, bpm in the line updates
    - move ハネ slider => 「（自分で調整中）」, line shows slider values; same for the 遅れ(ms) slider; type 70 into the ハネ値 number field + Enter => same
    - choose `3連` => tempo unchanged, line `ジャスト 0.00 · 3連くらい 0.67 · <current>bpm`; choose 「（自分で調整中）」 manually => `P` unchanged
    - with no saved items: no 保存したノリ optgroup; save `<b>x` => optgroup appears, `<b>x` (literal) selected, 削除 visible on the same row as the select with aria-label `<b>x を削除`; save a second item `y`, then choose `<b>x` => aria-label `<b>x を削除`; 削除 => item gone after reload too, select at 「（自分で調整中）」
    - 375px: no horizontal scroll with the longest option selected; 削除 on the same row as the select
  - user-only: light/dark look, phone OS picker opens, tapping 削除 on iPhone does not pop the picker — run-by: user

### Step 5: Space key and footnote (Revision 2 addendum)

- run-by: agent
- files:
  - `index.html` (change) — the Space `keydown` handler condition, footnote text
- change: implement R-D7 (condition + footnote). Do not change anything else in the handler or the play/stop functions.
- behavior: as R-D7 (each `=>` line there is the spec).
- verify:
  - `node --check` passes
  - `git diff 643a4fd -- index.html` shows, outside the preset section, only the `keydown` condition change
  - browser: type `a b` in the name field => text is `a b`, no playback toggle; Space with focus on a slider => toggles; Space with nothing focused => toggles, page does not scroll; Space on ▶ 再生 => toggles exactly once; Space on a checkbox => checkbox toggles only
  - footnote ends with `スペースキーで再生／停止。`

### Step 6: Update CLAUDE.md (Revision 2)

- run-by: agent
- files:
  - `CLAUDE.md` (change) — preset UI line
- change: rewrite the 「誰風で吹く？」 line: below the controls; one native `<select id="preset">` with 「（自分で調整中）」 + optgroups プレイヤー (`PAPER`) / 基本 (`PRESETS`) / 保存したノリ; applies on change; slider moves of 遅れ/ハネ select 「（自分で調整中）」; `#pinfo` shows tag words (`tameTag` / `haneTag`, thresholds unchanged) + small numbers + bpm; `#pdel` only for 保存したノリ. Remove the mention of `sel`. Add one short note: Space toggles play/stop except when focus is on a text/number/checkbox input, select, button or textarea.
- behavior: none (docs only)
- verify: `git diff 643a4fd -- CLAUDE.md` touches only that line

## Risks

- (Revision 2) Re-choosing the already-selected option (e.g. to return to the recording tempo after moving テンポ) does nothing, because native `select` fires no `change` => user must pick another option and back — mitigation: none (accepted, R-D2) — because: workarounds either hide the selection or do not work on iOS.
- (Revision 2: resolved by R-D7) Space while typing in `#pname` (including IME conversion Space on desktop) toggles playback and swallows the space (existing behavior, P7) => names with spaces are hard to type on desktop — mitigation: none in this issue; reported to the orchestrator as a candidate follow-up — because: the Space handler is outside the preset section and the issue says to keep Space as is.
- (Revision 2: resolved by R-D7 footnote) The long note held the only on-page hint 「スペースキーでも再生／停止できる」; the issue's footnote text drops it => the Space shortcut becomes undiscoverable — mitigation: none (footnote text is fixed by the issue); reported to the orchestrator — because: adding text beyond the issue's footnote widens scope.
- (Revision 2: obsolete — the panel moves back below the controls) Moving the preset panel above the controls pushes ▶ 再生 down by roughly the panel height (~1000px at 375px) => more scrolling on phones — mitigation: compact rows (D7) — because: the position is fixed by the issue.

## Final verification

- `sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > "$TMPDIR/x.js" && node --check "$TMPDIR/x.js"` passes — run-by: agent
- tag self-check passes (command below, run from repo root) — run-by: agent

```
grep -E 'const (tameTag|haneTag) =' index.html | sed 's/^ *//' > "$TMPDIR/t.js" && cat >> "$TMPDIR/t.js" <<'E'
const a=require('assert');
a.equal(tameTag(-0.04),'前ノリ');a.equal(tameTag(-0.02),'前ノリ');a.equal(tameTag(0),'ジャスト');a.equal(tameTag(0.04),'ちょい後ろ');a.equal(tameTag(0.1),'ちょい後ろ');a.equal(tameTag(0.14),'かなり後ろ');a.equal(tameTag(0.19),'かなり後ろ');
a.equal(haneTag(50),'まっすぐ');a.equal(haneTag(54),'軽く跳ねる');a.equal(haneTag(60),'軽く跳ねる');a.equal(haneTag(62),'3連くらい');a.equal(haneTag(66.7),'3連くらい');a.equal(haneTag(69),'強く跳ねる');a.equal(haneTag(75),'強く跳ねる');
console.log('tags ok');
E
node "$TMPDIR/t.js"
```

- `git diff main --stat` shows only `index.html`, `CLAUDE.md`, and this plan — run-by: agent
- `git diff main -- index.html` shows no change in the slider `on(...)` lines, Space `keydown` handler, audio / scheduler / melody / bass / draw code — run-by: agent
- typecheck / lint / test / build: n/a (no package.json, single HTML) — run-by: agent
- Browser manual check at 375px in light and dark (Step 4 and Step 5 verify lists; the Step 2 list is obsolete) — run-by: user

## References

- https://github.com/yasact/nori-lab/issues/1
- 井上裕章ほか「スウィングジャズからビバップへの変遷期における8分音符タイミングの変化」音楽知覚認知研究 23(1) https://doi.org/10.32199/jsmpc.23.1_3
- iOS input zoom under 16px: https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing , https://specification.website/spec/accessibility/mobile-form-inputs/
- Touch target 44px: https://frontendchecklist.io/rules/accessibility/touch-targets

## Review log

- revision 2: see the end of this section

- grill: skipped (`--no-grill`)
- self-check: added P4 (why clearing cannot live in `sync()`), P5 save-failure note, exact PAPER rows, expected tags per row
- depth: standard (files: 2 — `index.html`, `CLAUDE.md`)
- constructive: focus loss on rebuild → `mark()` + rebuild only on save/delete + focus target after delete (A1, also B1); selection clearing moved to new listeners so Goal's byte-for-byte holds (A2); `fmt` removal moved to Step 2 and Step 1 verified by node only (A3); one-line tag functions + node assert command (A4); re-tap keeps selection (A5); D4 because corrected (A6); Space-on-row behavior documented (A7); `sel` after failed save (A8); `.pick` `flex:1 1 auto; min-width:0` (A9); P1 count, D5 rejected reason, wording-check scope fixed (A10)
- adversarial: focus loss (B1, merged with A1); selected-row tint replaced by left band + tags on `--panel` for AA contrast (B2); `aria-current` instead of `aria-pressed` (B5); Space-in-name-input IME issue (B3) and lost Space hint (B6) kept out of scope but moved to Risks and reported, because the issue fixes Space behavior and footnote text; side-by-side tags (B4) rejected in D7
- codex: not run (standard depth)
- pending (user decision): none

- revision 2 review (standard, files 2): applied — `#preset` `flex:1 1 0` + no-wrap row so 削除 stays beside the select at 375px (both reviewers); single `refresh()` + explicit listener groups and registration order (A); re-select limit documented, no workaround (both); stricter leftover grep (both); stale Goal/D4/Final-verification references overridden (both); `#pinfo` spacing/size (A); reload after delete (A); keyboard-only focus after delete (A); tags from rounded values (A). Not applied: `loadMine` non-array guard (A10) — because: existing behavior unchanged since the first commit and outside Revision 2. R-D7 (Space addendum) arrived after the reviewers started; self-checked only.

## Routing

- risky: no — because: none (UI only; no auth, permission, or data-destructive change; localStorage shape unchanged)
- tier: light — because: one screen section in one file (plus a docs line), no new tables, endpoints, jobs, or external systems
- implementer: `claude --model opus`
- confidence: 0.8

## 判断サマリー（人間向け）

改訂 2: Space は文字入力・select・button・checkbox では本来の動作に任せ、脚注に「スペースキーで再生／停止。」を戻す。プリセットは native の select 1 個（先頭が「（自分で調整中）」）にして、コントロールの下へ戻す。select の下に「タグの言葉＋小さい数字＋bpm」の 1 行を出す。削除ボタンは保存したノリを選んでいるときだけ出る。縦の行のコードは消す。

初版:

- プリセット欄だけを「誰風で吹く？」の縦の表にして、タイミング表示のすぐ下へ移す。音・スライダー・描画・Space キーの処理は触らない
- グループは プレイヤー（論文値・押すと録音テンポ）/ 基本 / 保存したノリ（空なら見出しごと非表示）
- 各行の右にタメ・ハネの言葉タグ。選択中は左端の真鍮色の帯で示す。遅れ・ハネを動かすと選択が外れ、テンポだけなら残る
- 名前入力欄は 16px にして iPhone でズームしないようにした
- 脚注の差し替えで「スペースキーで再生」の案内が消える点と、名前入力中の Space で再生が切り替わる既存挙動は、範囲外として据え置き
