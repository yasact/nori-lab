import { $, P } from './state';
import { buildProg } from './music';
import { ctx, out, hornBus, bassBus, drumBus, initAudio, playing, startScheduler, stopScheduler } from './audio';
import { dial, dialGeom, draw, loop, onDial, type Geom } from './draw';

// ---- 入力のひも付け ----
function sync(){
  const ms = Math.round(P.delay);
  $('bpm-r').value = String(P.bpm); $('bpm').value = String(P.bpm);
  $('delay-r').value = String(ms); $('delay').value = String(ms);
  $('lag-r').value = String(P.lag); $('lag').value = String(+P.lag.toFixed(3));
  $('dist-r').value = String(P.dist); $('dist').value = String(P.dist);
  update();
}
const num = (s: string) => { const v = Number(s); return isFinite(v) ? v : null; };
const on = (ids: string[][], fn: (v: number) => void) => ids.forEach(([id, ev]) => $(id).addEventListener(ev, e => { const v = num((e.target as HTMLInputElement).value); if (v !== null) { fn(v); sync(); } }));
on([['bpm-r','input'],['bpm','change']], v => { if (v > 0) P.bpm = v; });
on([['delay-r','input'],['delay','change']], v => { P.lag = v / (60000 / P.bpm); });
on([['lag-r','input'],['lag','change']], v => { P.lag = v; });
on([['dist-r','input'],['dist','change']], v => { P.dist = v; });

// [名前, 遅れ値, ハネ値(%)]
const PRESETS: [string, number, number][] = [
  ['イーブン（ストレート）', 0, 50],
  ['3連', 0, 66.7],
  ['付点（ハネ強め）', 0, 75],
  ['軽めの跳ね', 0, 58],
  ['後ろノリの例', 0.1, 58],
  ['前ノリの例', -0.04, 64],
];
// 井上ほか（2017）表1 の中央値: [奏者, 曲, 録音年, 遅れ値, ハネ値(%), 録音テンポ]。Red Cross / Billie's Bounce は take1
const PAPER: [string, string, number, number, number, number][] = [
  ['チャーリー・パーカー', 'Red Cross', 1944, 0.2, 59, 200],
  ['チャーリー・パーカー', "Billie's Bounce", 1945, 0.19, 60, 168],
  ['チャーリー・パーカー', 'JATP Blues', 1946, 0.19, 60, 190],
  ['マイルス・デイヴィス', "Billie's Bounce", 1945, 0.16, 59, 168],
  ['レスター・ヤング', 'Way Down Yonder In New Orleans', 1938, 0.1, 58, 192],
  ['レスター・ヤング', 'JATP Blues', 1946, 0.1, 60, 190],
  ['コールマン・ホーキンス', 'Fine Dinner', 1939, 0, 64, 173],
  ['コールマン・ホーキンス', 'JATP Blues', 1946, 0, 66, 190],
  ['バディ・リッチ（ドラム）', 'JATP Blues', 1946, 0, 72, 190],
];
const tameTag = (lag: number) => lag <= -0.02 ? '前ノリ' : lag < 0.04 ? 'ジャスト' : lag < 0.14 ? 'ちょい後ろ' : 'かなり後ろ';
const haneTag = (dist: number) => dist < 54 ? 'まっすぐ' : dist < 62 ? '軽く跳ねる' : dist < 69 ? '3連くらい' : '強く跳ねる';
type Mine = { name: string; lag: number; dist: number };
const KEY = 'nori-lab-presets';
const loadMine = (): Mine[] => { try { return JSON.parse(localStorage.getItem(KEY) as string) || []; } catch { return []; } };
const saveMine = (a: Mine[]) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
const el = (tag: string, cls?: string | null, text?: string | null) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const opt = (v: string, text: string) => { const o = el('option', null, text) as HTMLOptionElement; o.value = v; return o; };
const grp = (label: string, opts: HTMLOptionElement[]) => { const g = el('optgroup') as HTMLOptGroupElement; g.label = label; g.append(...opts); return g; };
// 選択は #preset の value だけで持つ: '' =（自分で調整中）/ 'p'+i プレイヤー / 'b'+i 基本 / 'm'+i 保存したノリ
function renderOptions(v: string){
  const mine = loadMine();
  $('preset').replaceChildren(opt('', '（自分で調整中）'),
    grp('プレイヤー', PAPER.map((p, i) => opt('p' + i, `${p[0]} — ${p[1]} '${String(p[2]).slice(2)}`))),
    grp('基本', PRESETS.map((p, i) => opt('b' + i, p[0]))),
    ...(mine.length ? [grp('保存したノリ', mine.map((p, i) => opt('m' + i, p.name)))] : []));
  $('preset').value = v;
}
function refresh(){
  // タグは表示する丸めた値から決める（0.1399 が「ちょい後ろ 0.14」にならないように）
  const l = +P.lag.toFixed(2), h = +(P.dist / 100).toFixed(2), v = $('preset').value;
  $('pinfo').replaceChildren(el('span', 'tag tame', tameTag(l)), ' ', el('small', 'v', l.toFixed(2)), ' · ',
    el('span', 'tag hane', haneTag(h * 100)), ' ', el('small', 'v', h.toFixed(2)), ' · ', el('small', 'v', `${P.bpm}bpm`));
  $('pdel').hidden = !v.startsWith('m');
  if (v.startsWith('m')) $('pdel').setAttribute('aria-label', `${loadMine()[+v.slice(1)].name} を削除`);
}
$('preset').addEventListener('change', e => {
  const v = (e.target as HTMLSelectElement).value, i = +v.slice(1), m = v[0] === 'm' && loadMine()[i];
  const [lag, dist, bpm] = (v[0] === 'p' ? PAPER[i].slice(3) : v[0] === 'b' ? PRESETS[i].slice(1) : m ? [m.lag, m.dist] : []) as number[];
  if (v) { P.lag = lag; P.dist = dist; if (bpm) P.bpm = bpm; sync(); }
  refresh();
});
$('pdel').addEventListener('click', e => {
  const a = loadMine(); a.splice(+$('preset').value.slice(1), 1); saveMine(a);
  renderOptions(''); refresh();
  if (e.detail === 0) $('preset').focus(); // キーボード操作のときだけ。タップ後に focus すると iOS でピッカーが開くことがある
});
$('psave').addEventListener('click', () => {
  const name = $('pname').value.trim() || `保存 ${loadMine().length + 1}`;
  const a = loadMine(); a.push({ name, lag:+P.lag.toFixed(4), dist:P.dist }); saveMine(a);
  $('pname').value = '';
  const n = loadMine().length;
  renderOptions(n === a.length ? 'm' + (n - 1) : $('preset').value); // 保存に失敗したら（容量・プライベートモード）選択は動かさない
  refresh();
});
// on(...) より後に登録するので、P が更新されてから refresh が走る
[['delay-r','input'],['delay','change'],['lag-r','input'],['lag','change'],['dist-r','input'],['dist','change']]
  .forEach(([id, ev]) => $(id).addEventListener(ev, () => { $('preset').value = ''; refresh(); }));
[['bpm-r','input'],['bpm','change']].forEach(([id, ev]) => $(id).addEventListener(ev, refresh));
renderOptions(''); refresh();

function update(){
  const T = 60000 / P.bpm, hane = P.dist / 100;
  $('r-beat').textContent = T.toFixed(0) + ' ms';
  $('r-ratio').textContent = (hane / (1 - hane)).toFixed(2) + ' : 1';
  $('r-lag').textContent = (P.lag>0?'+':'') + P.lag.toFixed(3);
  $('r-hane').textContent = hane.toFixed(3);
  $('r-ura').textContent = (P.lag + hane).toFixed(3);
  draw();
}

buildProg($('prog').value); $('prog').addEventListener('change', () => buildProg($('prog').value));

// ---- 再生 ----
function start(){
  if (!ctx) { initAudio(); VOL.forEach(k => { volParam(k).value = gainOf(k); }); }
  startScheduler();
  $('play').setAttribute('aria-pressed','true'); $('play').textContent = '■ 停止';
  requestAnimationFrame(loop);
}
function stop(){
  stopScheduler();
  $('play').setAttribute('aria-pressed','false'); $('play').textContent = '▶ 再生';
  draw();
}
$('play').addEventListener('click', () => playing ? stop() : start());
document.addEventListener('keydown', e => {
  const t = e.target, skip = t instanceof HTMLSelectElement || t instanceof HTMLButtonElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== 'range');
  if (e.code === 'Space' && !skip) {
    e.preventDefault(); playing ? stop() : start();
  }
});

// ---- 円のドラッグ: つかんだ位置からの回転量（拍）で動かす。範囲はスライダーと同じ ----
type Mode = 'down' | 'up' | 'needle';
const frac = (x: number, y: number, g: Geom) => { const f = Math.atan2(x - g.cx, -(y - g.cy)) / (2*Math.PI); return f < 0 ? f + 1 : f; };
const unwrap = (a: number, ref: number) => a + Math.round(ref - a);
const snap = (x: number, step: number) => +(Math.round(x / step) * step).toFixed(3);
const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, t = clampTo(((x - ax)*dx + (y - ay)*dy) / (dx*dx + dy*dy), 0, 1);
  return Math.hypot(x - ax - t*dx, y - ay - t*dy);
};
// s は範囲内に収めた開始値、acc は累積回転量（拍）。表拍は裏拍値を保ち、裏拍はハネ値だけ、針は遅れ値だけ
function dialValue(mode: Mode, s: { lag: number; dist: number }, acc: number){
  if (mode === 'up') return { lag: s.lag, dist: clampTo(snap(s.dist + acc*100, 0.5), 40, 80) };
  if (mode === 'needle') return { lag: clampTo(snap(s.lag + acc, 0.005), -0.15, 0.3), dist: s.dist };
  const ura = s.lag + s.dist/100;
  // 範囲で止めてから丸める（端の ura-0.8 などに浮動小数の端数が残らないように）
  const lag = snap(clampTo(s.lag + acc, Math.max(-0.15, ura - 0.8), Math.min(0.3, ura - 0.4)), 0.005);
  return { lag, dist: clampTo(snap((ura - lag)*100, 0.5), 40, 80) };
}
{
  const eq = (v: { lag: number; dist: number }, lag: number, dist: number) => v.lag === lag && v.dist === dist;
  console.assert(eq(dialValue('down', {lag:0.02, dist:60}, -0.05), -0.03, 65), 'dial: down across 12 o\'clock');
  console.assert(eq(dialValue('up', {lag:0.075, dist:60}, 0.9), 0.075, 80), 'dial: up overshoot pins at 80');
  console.assert(eq(dialValue('down', {lag:0.075, dist:60}, -0.3), -0.125, 80), 'dial: down hits dist limit');
  console.assert(eq(dialValue('down', {lag:0.075, dist:60}, 1.2), 0.275, 40), 'dial: down hits dist 40');
  console.assert(eq(dialValue('needle', {lag:0.075, dist:60}, 0.1), 0.175, 60), 'dial: needle keeps dist');
  console.assert(eq(dialValue('needle', {lag:0.075, dist:60}, -0.7), -0.15, 60), 'dial: needle pins at -0.15');
  console.assert(Math.abs(unwrap(0.02, 0.98) - 1.02) < 1e-9 && Math.abs(unwrap(0.97, 0.01) + 0.03) < 1e-9, 'dial: unwrap');
}
let drag: { id: number; mode: Mode; s: { lag: number; dist: number }; a0: number; prev: number } | null = null;
const ptr = (e: PointerEvent) => { const r = dial.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
dial.addEventListener('pointerdown', e => {
  if (drag) return; // 2本目の指は無視
  const g = dialGeom(), [x, y] = ptr(e), fs: Record<string, number> = { down:P.lag, up:P.lag + P.dist/100 };
  let mode: Mode | null = null, best = 22;
  for (const k in fs) { const [px, py] = onDial(fs[k], g.R, g), d = Math.hypot(x - px, y - py); if (d <= best) { best = d; mode = k as Mode; } }
  if (!mode && Math.hypot(x - g.cx, y - g.cy) >= 0.3*g.R
      && Object.values(fs).some(f => segDist(x, y, g.cx, g.cy, ...onDial(f, g.R, g)) <= 22)) mode = 'needle';
  if (!mode) return;
  e.preventDefault();
  try { dial.setPointerCapture(e.pointerId); } catch {}
  const a0 = frac(x, y, g);
  drag = { id:e.pointerId, mode, s:{ lag:clampTo(P.lag, -0.15, 0.3), dist:clampTo(P.dist, 40, 80) }, a0, prev:a0 };
});
dial.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const g = dialGeom(), [x, y] = ptr(e);
  if (Math.hypot(x - g.cx, y - g.cy) < 12) return; // 中心付近は角度が暴れる
  const a = unwrap(frac(x, y, g), drag.prev); drag.prev = a;
  const v = dialValue(drag.mode, drag.s, a - drag.a0);
  if (v.lag === P.lag && v.dist === P.dist) return; // 値が変わらない操作ではプリセット選択を残す
  P.lag = v.lag; P.dist = v.dist; sync(); $('preset').value = ''; refresh();
});
(['pointerup', 'pointercancel', 'lostpointercapture'] as const).forEach(t => dial.addEventListener(t, e => { if (drag && e.pointerId === drag.id) drag = null; }));
['m-t8', 'm-t3'].forEach(id => $(id).addEventListener('change', draw)); // 停止中も描き直す

// ---- 音量: 範囲と既定値は markup の range が正。表示 % はつまみ位置で、gain = (位置/100)^2 ----
const VOL = ['all', 'horn', 'bass', 'drums'] as const;
type VolKey = typeof VOL[number];
const rng = (k: VolKey) => $('vol-' + k + '-r');
const lim = (k: VolKey): [number, number] => [Number(rng(k).min), Number(rng(k).max)];
const VKEY = 'nori-lab-volume';
const volDefault = (k: VolKey) => Number(rng(k).defaultValue);
// 保存値の検証。Number(null) や Number('') は 0（無音）になるので typeof で弾く。全体 0 だけは復元しない（無音で始まると壊れて見える）
const volFrom = (o: unknown) => Object.fromEntries(VOL.map(k => {
  const v = o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined;
  if (typeof v !== 'number' || !isFinite(v)) return [k, volDefault(k)];
  const r = clampTo(Math.round(v), ...lim(k));
  return [k, k === 'all' && r === 0 ? volDefault(k) : r];
})) as Record<VolKey, number>;
{
  const eq = (o: unknown, want: Partial<Record<VolKey, number>>) => { const v = volFrom(o); return VOL.every(k => v[k] === (want[k] ?? 100)); };
  console.assert(eq({all:'x'}, {}), 'vol: string');
  console.assert(eq({all:null}, {}), 'vol: null');
  console.assert(eq({all:999, bass:999}, {bass:150}), 'vol: clamp max');
  console.assert(eq({horn:-5}, {horn:0}), 'vol: clamp min');
  console.assert(eq({drums:40.7}, {drums:41}), 'vol: round');
  console.assert(eq({all:0, bass:0}, {bass:0}), 'vol: all 0 not restored');
  console.assert(eq(null, {}) && eq(5, {}), 'vol: non-object');
}
const loadVol = () => { try { return volFrom(JSON.parse(localStorage.getItem(VKEY) as string)); } catch { return volFrom(null); } };
const saveVol = () => { try { localStorage.setItem(VKEY, JSON.stringify(V)); } catch {} };
const V = loadVol();
const writeVol = (k: VolKey) => { rng(k).value = String(V[k]); $('vol-' + k).value = String(V[k]); };
const gainOf = (k: VolKey) => (V[k] / 100) ** 2;
const volParam = (k: VolKey) => ({ all: out, horn: hornBus, bass: bassBus, drums: drumBus })[k].gain;
const applyVol = (k: VolKey) => { if (ctx) volParam(k).setTargetAtTime(gainOf(k), ctx.currentTime, 0.015); };
VOL.forEach(k => {
  writeVol(k); // Firefox はリロード時にフォームの値を復元するので、実際の gain と表示を揃える
  const set = (e: Event) => {
    const v = (e.target as HTMLInputElement).valueAsNumber;
    if (!isFinite(v)) { writeVol(k); return; } // 空欄・非数を 0（無音）にしない
    V[k] = clampTo(Math.round(v), ...lim(k)); writeVol(k); applyVol(k);
  };
  rng(k).addEventListener('input', set);
  $('vol-' + k).addEventListener('change', e => { set(e); saveVol(); });
  rng(k).addEventListener('change', saveVol); // ドラッグ中は毎回書かず、離したときだけ保存
});
window.addEventListener('resize', draw);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
new MutationObserver(draw).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
document.fonts?.ready.then(draw);
sync();
