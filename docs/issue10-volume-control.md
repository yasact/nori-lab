# Issue #10: 音量を調整できるようにする

## Goal

Add four volume sliders (全体 / ホーン / ベース / ドラム) under the play bar. They change loudness immediately and smoothly while playing, 0 mutes, they work on phones, and the values survive a reload. At default values the sound is exactly as today; timing, synth sounds, presets and the existing part on/off checkboxes keep working as now.

## Context

- P1: All voices end in `master` (GainNode, fixed `gain.value = 0.8`) → `DynamicsCompressor` (default settings: threshold -24 dB, knee 30, ratio 12) → `ctx.destination` — evidence: `index.html:271-276`.
- P2: Per-voice connection points: horn `lp.connect(g).connect(master)` (`index.html:328`); bass `g.connect(master)` (`index.html:315`); ride VCA and ride stick go to `ridePan`, hi-hat to `hatPan` (`index.html:286`, `304`, `307`), and both pans are created by `pan = v => { ...; p.connect(master); ... }` (`index.html:281-282`). `noiseHit(t, freq, dur, vol, dest = master, ...)` has a default `dest = master` that no caller uses (all calls pass a pan) — evidence: `index.html:292`, `304`, `307`.
- P3: `ctx` is created lazily in `initAudio()` on the first `start()` (`index.html:272-273`, `433-435`). Before the first play there are no AudioParams to set.
- P4: Controls panel is `<section class="panel controls">` (`index.html:109-149`, CSS `.controls{display:flex;flex-direction:column;gap:18px}` at `index.html:42`). Rows use `.row` = `<label for=number-id>` + range with `aria-label` + `.num` number box (`index.html:110-129`; CSS `index.html:43-48`). The play bar `<div class="bar">` ends at `index.html:148`. Phone layout `@media (max-width:560px)` re-flows `.row` at `index.html:72-73`. `h2` has `margin:0 0 10px` (`index.html:60`).
- P5: localStorage is accessed with try/catch wrappers (`loadMine`/`saveMine`, `index.html:212-214`); key convention `nori-lab-*`.
- P6: Space toggles play unless focus is on a non-range input/select/button/textarea (`index.html:448-453`). New range inputs keep Space = play/stop; new number inputs keep native typing.
- P7: Measured in Chrome (2026-11-07, defaults, playing): compressor `reduction` median -3.4 dB with all parts; -1.2 dB without bass; -3.3 dB without drums; -1.2 dB horn only. So the mix is always above threshold, and bass drives most of the reduction. Gain before the compressor is compressed by ratio 12 above threshold (makeup gain is a fixed value from the curve parameters), so a global control placed before it does not scale output proportionally; one placed after it does.
- P8: Smooth, click-free change: `param.setTargetAtTime(target, ctx.currentTime, 0.015)`; ~15 ms feels immediate; assigning `.value` on every range `input` can crackle. `setTargetAtTime` accepts 0 as target — evidence: MDN setTargetAtTime; alemangui.github.io/ramp-to-value; alanwsmith tone generator.
- P9: Loudness is perceived roughly logarithmically; squaring the slider fraction spreads the audible change over the slider — research.
- P10: iOS ignores `HTMLMediaElement.volume`, but this app uses only oscillator/buffer sources into GainNodes, so GainNode volume works there — research (WebKit bug 151589 concerns MediaElementSource only).
- P11: Existing `num()` (`index.html:181-182`) is `Number(v)` + `isFinite`; `Number('') === 0` and `Number(null) === 0`, and `<input type=number>` reports `value === ''` for empty or non-numeric text. Reusing it would turn an emptied box or a stored `null` into 0 = mute.
- P12: `clampTo(x, lo, hi)` exists at `index.html:584` (const arrow). Code referencing it at load time must come after that line (TDZ). `ride()` itself calls `setTargetAtTime` every beat with targets 0.012 and 0 (`index.html:302-303`).

## Prerequisites

none

## Constraints

- Do not change synth voice code beyond the node each voice connects to (P2), the scheduler, melody/bass generation, presets/`PAPER`/`PRESETS`, the `nori-lab-presets` storage, the Space handler, or drawing — because: the issue only adds volume.
- At default slider values, output loudness and balance are exactly as today (`master` stays 0.8, buses and `out` = 1) — because: user agreed defaults keep today's sound (grill Q6).
- Existing checkboxes `m-ride` / `m-hh` / `m-bass` stay with their meaning (unchecked = not scheduled) — because: user decision; slider 0 = scheduled but silent.
- Single file, no libraries — because: project rule (CLAUDE.md).
- Do not touch `AGENTS.md` (untracked, unrelated) — because: orchestrator instruction.
- Phone: no horizontal scroll at 375px; sliders usable by touch — because: issue 完了条件.
- Slider ranges and defaults are defined once, in the markup (`min` / `max` / `value` of each range input); JS reads them from the range element — because: avoids three copies (HTML, input clamp, load validation) drifting apart.

## Decisions

### D1: Which sliders

- use: four sliders: 全体, ホーン, ベース, ドラム (ドラム = ride + hi-hat together).
- because: lets the user raise bass to hear beat heads or lower the rhythm section; the issue groups the parts as ホーン / ベース / ドラム.
- by: user (grill Q1 = B)
- rejected:
  - global only — because: cannot raise one part relative to the others.
  - parts only — because: turning everything down means moving three sliders.

### D2: Persist values

- use: localStorage key `nori-lab-volume`, JSON `{"all":n,"horn":n,"bass":n,"drums":n}` (percent). Load rule per field: not `typeof === 'number'` or not finite => default; otherwise `Math.round` then clamp to that field's range. Exception: loaded `all === 0` => default (100) — part values of 0 are kept.
- because: avoids blasting at full level after the user turned it down on a phone. Strict type check because `Number(null)` / `Number('')` is 0 (P11) and would mute the app. `all` 0 is not restored because on phones the volume rows are far below the play button, so a muted start looks like a broken app; a part at 0 still leaves sound, so it is kept.
- by: user (grill Q2 = A, Q5 = A)
- rejected:
  - no persistence — because: resets to full level on every open.
  - restore `all` 0 as-is — because: silent start with the cause off-screen (Q5).
  - restore 0 and show 「（無音）」 on the play button — because: more UI for the same problem (Q5).

### D3: Placement

- use: inside `section.panel.controls`, after the `.bar` div: `<div class="vol" role="group" aria-labelledby="vol-h">` containing `<h2 id="vol-h">音量</h2>` and four `.row`s. CSS `.vol{display:flex;flex-direction:column;gap:18px}` and `.vol h2{margin:0}`.
- because: right under the play button, and the 遅れ/ハネ rows keep their position (Q3). The group wrapper gives the heading a use (accessible group name) and avoids 18px gap + 10px h2 margin stacking under the heading. Reusing `.row` gives the phone layout for free (P4).
- by: user (grill Q3 = B); wrapper by review
- rejected:
  - top of the controls panel — because: pushes the timing controls down by four rows.
  - new panel below 誰風で吹く？ — because: farthest from play, most scrolling on phones.

### D4: Audio graph

- use: `hornBus`, `bassBus`, `drumBus` (GainNodes) → `master` (unchanged, 0.8) → compressor → new `out` GainNode → `destination`. Horn `g` → `hornBus`, bass `g` → `bassBus`, `pan()` → `drumBus`. Remove the unused default from `noiseHit` (`dest` becomes a required parameter).
- because: part buses before the compressor keep today's compressor input at defaults (Constraint); the global control after the compressor scales output proportionally (P7). Removing the `dest = master` default stops a future voice from silently bypassing the part sliders.
- by: research (agent); `noiseHit` by review
- rejected:
  - drive `master.gain` from the global slider — because: compressor partly cancels it (P7).
  - one gain per note scaled by a volume factor — because: only affects notes scheduled after the change, not ringing ones, and touches every voice.

### D5: Parts are not fully independent

- use: keep the compressor as is. Changing one part shifts the others slightly: bass 0 => horn and drums about +2 dB louder (P7: -3.4 → -1.2 dB reduction); bass 150 % => horn and drums a few dB softer, possibly dipping on each bass note.
- because: the effect is small for practice, and keeping the compressor keeps today's sound at defaults.
- by: user (grill Q4 = A)
- rejected:
  - parts capped at 125 % — because: less room to raise bass; user kept 150 %.
  - limiter-style compressor (high threshold, knee 0) — because: changes today's default sound (~3 dB louder, more transient).

### D6: Slider ranges, defaults and curve

- use:
  - 全体: 0–100 %, default 100 %, `out.gain = (v/100)^2`. 100 % = today's loudness.
  - ホーン / ベース / ドラム: 0–150 %, default 100 %, `bus.gain = (v/100)^2` (150 % = 2.25×, about +7 dB).
  - integer steps. The shown % is the slider position, not the gain factor (50 % = 0.25× = -12 dB).
- because: squared curve spreads audible change over the slider (P9) and gives exact 0 at 0. Showing slider position keeps a simple 0–100 scale like other volume controls. 全体 stops at 100 % because above 1.0 after the compressor can clip. Parts may exceed 100 % for "raise bass"; they sit before the compressor.
- by: user (grill Q6 = A); curve by research
- rejected:
  - 全体 with today = 80 % and headroom to 100 % — because: clipping risk after the compressor (Q6).
  - linear mapping — because: most change in the first third of the slider (P9).

### D7: Applying a change

- use: `applyVol()` — when `ctx` exists, `setTargetAtTime(gain, ctx.currentTime, 0.015)` on the four params. `initAudio()` sets the initial `.value`s from `V` directly.
- because: 15 ms is click-free and immediate (P8); before the first play there is no `ctx` (P3).
- by: research (agent)

### D8: When to save

- use: save on range `change` (pointer released / key step) and number `change`; not on every range `input`.
- because: avoids synchronous localStorage writes many times per second during a drag while the draw loop runs.
- by: review

## Reuse

- existing: `$()`, `clampTo` (`index.html:584`), `.row` / `.num` markup and CSS, the try/catch pattern of `loadMine`/`saveMine`, `h2` style — `index.html`
- not reused: `num()` — because: returns 0 for an empty box (P11). `on()` / `sync()` — because: they write `P`, redraw, and the preset-clear listeners; volume is not part of `P`.

## Steps

### Step 1: Audio graph, markup and wiring

- run-by: agent
- files:
  - `index.html` (change) — CSS, markup, buses + `out` in `initAudio()`, voice destinations, `noiseHit` default, volume state and wiring
- change:
  - CSS: `.vol{display:flex;flex-direction:column;gap:18px}` and `.vol h2{margin:0}` next to `.controls`.
  - Markup after the `.bar` div (before `</section>` at `index.html:149`), the D3 wrapper with four rows, same shape as the tempo row:
    - `<label for="vol-all">全体<em>0 で無音</em></label>` + `<input type="range" id="vol-all-r" min="0" max="100" step="1" value="100" aria-label="音量（全体）">` + `.num` with `<input type="number" id="vol-all" min="0" max="100" step="1" value="100"><span>%</span>`
    - `ホーン` — `vol-horn-r` / `vol-horn`, 0–150, value 100, aria-label `音量（ホーン）`
    - `ベース` — `vol-bass-r` / `vol-bass`, 0–150, value 100, aria-label `音量（ベース）`
    - `ドラム<em>ライド＋ハイハット</em>` — `vol-drums-r` / `vol-drums`, 0–150, value 100, aria-label `音量（ドラム）`
  - Audio: declare `hornBus, bassBus, drumBus, out` alongside `master`. In `initAudio()`: create the buses → `master`; `master.connect(comp).connect(out).connect(ctx.destination)`; set initial `.value`s from `V` (D7). `pan()` connects to `drumBus`. `bass()`: `g.connect(bassBus)`. `horn()`: `lp.connect(g).connect(hornBus)`. `noiseHit`: drop `= master` from `dest`.
  - Volume block `// ---- 音量 ----` placed after the `dialValue` assert block and pointer handlers, just before `window.addEventListener('resize', draw);` (`index.html:640`) — because: it uses `clampTo` at load time (P12).
    - `VOL = ['all','horn','bass','drums']`; `rng = k => $('vol-' + k + '-r')`; range/default from `rng(k).min`, `.max`, `.defaultValue` (Constraint).
    - `V` = state object, initialised from defaults (Step 2 replaces this with `loadVol()`).
    - `writeVol(k)`: writes `V[k]` to both the range and the number input. Called for all four at load — because: Firefox restores form values on reload, which would show stale positions that differ from the real gain.
    - `gainOf(k) = (V[k]/100)**2`; `applyVol()` as D7, mapping `all`→`out`, `horn`→`hornBus`, `bass`→`bassBus`, `drums`→`drumBus`.
    - range `input` and number `change` handlers: read `e.target.valueAsNumber`; not finite => `writeVol(k)` (restore) and stop; otherwise `V[k] = clampTo(Math.round(v), min, max)`, `writeVol(k)`, `applyVol()`.
- behavior:
  - slider moved while playing => that bus (or output) changes within ~50 ms with no click — because: P8.
  - 全体 = 0 => silent while the scheduler keeps running; raising it resumes sound in time — because: issue「0 でミュート」; stopping would lose the beat position.
  - a part = 0 => that part silent; other parts may get ~2 dB louder (D5); its checkbox stays checked.
  - moved before first play => only inputs and `V` change; first play starts at those levels (D7).
  - number box emptied or non-numeric => restored to the current value, no gain change — because: P11, must not mute.
  - number box out of range (e.g. 300 in ベース) => 150 shown and applied.
  - Space on a volume slider => play/stop; on a volume number box => native typing (P6).
- verify (Chrome via claude-in-chrome on `http://127.0.0.1:<port>/index.html` served by `python3 -m http.server`; click ▶ with the computer tool, not JS `.click()`, so the AudioContext gets a user gesture):
  - no console errors or failed asserts at load; inputs show 100 / 100 / 100 / 100.
  - before playing, wrap `AudioNode.prototype.connect` to record `(src, dst)` pairs and `AudioParam.prototype.setTargetAtTime` to record `(this, target)` only when `timeConstant === 0.015`. After play: DynamicsCompressor → Gain → `destination`; three distinct GainNodes connect to the gain-0.8 node; a StereoPanner connects to one of them, a lowpass-fed Gain to another; buses and `out` start at 1, master 0.8.
  - move ベース to 150 => one log entry, target 2.25, on the param of the bus that the bass voice gains connect to; 全体 to 0 => target 0 on the post-compressor Gain; four sliders hit four distinct params.
  - empty `vol-bass` and blur => previous value back, no log entry; type 300 => 150.

### Step 2: Persistence

- run-by: agent
- files:
  - `index.html` (change) — `loadVol()` / save
- change:
  - `loadVol()` in the volume block: read `nori-lab-volume` in try/catch, apply the D2 rule per field, return the object. `V = loadVol()` replaces the default init, then `writeVol` for all four.
  - Save `V` as JSON in try/catch (ignore failure) in range `change` and number `change` handlers (D8).
  - Load-time `console.assert` self-check of the validation (a pure helper taking the parsed object): `{all:'x'}` → 100; `{all:null}` → 100; `{all:999, bass:999}` → all 100, bass 150; `{horn:-5}` → 0; `{drums:40.7}` → 41; `{all:0, bass:0}` → all 100, bass 0; non-object (`null`, `5`) → all defaults.
- behavior:
  - stored JSON broken / key absent => defaults, no error — because: D2.
  - localStorage unavailable (private mode) => sliders work, values not kept — because: same as presets.
  - revert of this feature => the `nori-lab-volume` key stays but nothing reads it; harmless.
- verify:
  - 全体 40, ドラム 0, reload => 40 / 100 / 100 / 0.
  - 全体 0, reload => 全体 100.
  - `localStorage.setItem('nori-lab-volume','{"all":null,"bass":999}')`, reload => all 100, bass 150, no console error.

### Step 3: Update CLAUDE.md

- run-by: agent
- files:
  - `CLAUDE.md` (change) — 構成
- change:
  - 音 bullet: graph now reads voices → `hornBus` / `bassBus` / `drumBus` → `master`(0.8) → compressor → `out` → destination, plus one line: new voices must connect to one of the buses, never directly to `master`.
  - new bullet 音量: 4 sliders under the play bar (全体 0–100 % on `out`, ホーン/ベース/ドラム 0–150 % on the buses), gain = (位置/100)^2 (shown % is slider position, not gain), `setTargetAtTime` 0.015, ranges read from the markup, localStorage `nori-lab-volume` (全体 0 is not restored), parts interact slightly through the compressor.
- behavior: n/a
- verify: CLAUDE.md matches the graph the code builds.

## Risks

- Bass at 150 % => horn and drums dip on each bass note (compressor pumping) — mitigation: accepted by user (D5); if it proves annoying, lower the parts' `max` in the markup (single source) — because: user chose to keep 150 %.

## Final verification

- typecheck / lint / test / build: n/a (no tooling in this repo).
- Chrome: no console errors; at 375px viewport no horizontal scroll and the four rows wrap like the tempo row — run-by: agent
- Step 1 connect/param logger checks and Step 2 reload checks — run-by: agent
- listen while playing: each slider changes mainly its own part (others shift slightly, D5), no clicks, 全体 0 mutes; bass 150 % pumping acceptable; dragging works on a phone — run-by: user

## References

- https://github.com/yasact/nori-lab/issues/10
- https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
- https://alemangui.github.io/ramp-to-value
- https://www.alanwsmith.com/en/2u/lj/wu/zp/
- https://bugs.webkit.org/show_bug.cgi?id=151589

## Review log

- grill: run (3 open decisions in round 1–2; 3 more from review in round 3: Q4–Q6)
- self-check: no gaps
- depth: standard (2 files, no promotion trigger)
- constructive: P11 empty/null => 0 guard; verify by connect-graph + param identity, not target values; `clampTo` reuse and TDZ placement; D2 rule made unambiguous with concrete asserts; `writeVol` at load (form restoration); P4 line numbers fixed; label `for` / group wrapper / h2 spacing; % = slider position; `noiseHit` default; revert note
- adversarial: compressor coupling (measured, P7, user Q4); `all` 0 restore (user Q5); ranges single-sourced in markup; P7 makeup-gain wording; save on `change`; CLAUDE.md "connect new voices to a bus"
- codex: not run (standard depth)
- pending (user decision): none

## Routing

- risky: no — because: none (no auth, no DB, no permissions; single static page)
- tier: standard — because: one feature across three layers (audio graph, UI rows, localStorage persistence) in one file; no new external system; between light and standard, so the heavier side per the rule
- implementer: `claude --model opus`
- confidence: 0.6

## 判断サマリー（人間向け）

- 音量のつまみは 全体・ホーン・ベース・ドラム の 4 本。再生ボタンとチェックボックスの下に「音量」として並ぶ（Q1・Q3）
- 全体は 0〜100%（100% が今の大きさ）、パート別は 0〜150%（Q6）
- 4 本とも次に開いたときまで覚えておく。ただし全体 0 だけは 100% に戻す（Q2・Q5）
- ベースを下げるとほかが約 2dB 大きくなるなど、パートどうしが少し影響しあうのは受け入れる（Q4）
