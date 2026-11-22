import { $, P, SD_AVG, YURE_DEFAULT } from './state';
import { buildProg } from './music';
import { ctx, out, hornBus, bassBus, drumBus, initAudio, playing, startScheduler, stopScheduler } from './audio';
import { dial, dialGeom, draw, loop, onDial, type Geom } from './draw';
import { initKnobs } from './knob';
import { clampTo, dialValue, frac, fromQuery, haneTag, minesFrom, tameTag, toQuery, unwrap, VOL, volFrom, type Mine, type Mode, type Shared, type VolKey } from './logic';

const minmax = (id: string): [number, number] => [Number($(id).min), Number($(id).max)];

// ---- 入力のひも付け ----
function sync(){
  const ms = Math.round(P.delay);
  $('bpm-r').value = String(P.bpm); $('bpm').value = String(P.bpm);
  $('delay-r').value = String(ms); $('delay').value = String(ms);
  $('lag-r').value = String(P.lag); $('lag').value = String(+P.lag.toFixed(3));
  $('dist-r').value = String(P.dist); $('dist').value = String(P.dist);
  $('yd-r').value = String(P.yureD); $('yd').value = String(P.yureD);
  $('yu-r').value = String(P.yureU); $('yu').value = String(P.yureU);
  $('bl-r').value = String(P.bassLag); $('bl').value = String(+P.bassLag.toFixed(3));
  $('bl-ms').textContent = (P.bassLag > 0 ? '+' : '') + Math.round(P.bassLag * 60000 / P.bpm);
  update();
}
const num = (s: string) => { const v = Number(s); return s.trim() !== '' && isFinite(v) ? v : null; };
// 数値欄の max は手入力を止めないので、数値欄の min / max で clamp する（bpm 1e20 でスケジューラが止まらなくなる）。
// 数でない・空のときは P を変えず、sync() で欄を今の値に戻す
const on = (ids: string[][], fn: (v: number) => void) => ids.forEach(([id, ev]) => $(id).addEventListener(ev, e => { const v = num((e.target as HTMLInputElement).value); if (v !== null) fn(v); sync(); }));
on([['bpm-r','input'],['bpm','change']], v => { P.bpm = clampTo(v, ...minmax('bpm')); });
on([['delay-r','input'],['delay','change']], v => { P.lag = clampTo(v / (60000 / P.bpm), ...minmax('lag')); });
on([['lag-r','input'],['lag','change']], v => { P.lag = clampTo(v, ...minmax('lag')); });
on([['dist-r','input'],['dist','change']], v => { P.dist = clampTo(v, ...minmax('dist')); });
on([['yd-r','input'],['yd','change']], v => { P.yureD = clampTo(v, ...minmax('yd')); });
on([['yu-r','input'],['yu','change']], v => { P.yureU = clampTo(v, ...minmax('yu')); });
on([['bl-r','input'],['bl','change']], v => { P.bassLag = clampTo(v, ...minmax('bl')); }); // プリセットとは独立（選択も外さない）

// [名前, 遅れ値, ハネ値(%)]
const PRESETS: [string, number, number][] = [
  ['イーブン（ストレート）', 0, 50],
  ['3連', 0, 66.7],
  ['付点（ハネ強め）', 0, 75],
  ['軽めの跳ね', 0, 58],
  ['後ろノリの例', 0.1, 58],
  ['前ノリの例', -0.04, 64],
];
// 井上ほか（2017）表1: [奏者, 曲, 録音年, 遅れ値, ハネ値(%), 録音テンポ, 遅れ値 SD, 裏拍値 SD]。値は中央値。Red Cross / Billie's Bounce は take1
const PAPER: [string, string, number, number, number, number, number, number][] = [
  ['チャーリー・パーカー', 'Red Cross', 1944, 0.2, 59, 200, 0.08, 0.06],
  ['チャーリー・パーカー', "Billie's Bounce", 1945, 0.19, 60, 168, 0.07, 0.07],
  ['チャーリー・パーカー', 'JATP Blues', 1946, 0.19, 60, 190, 0.07, 0.07],
  ['マイルス・デイヴィス', "Billie's Bounce", 1945, 0.16, 59, 168, 0.05, 0.06],
  ['レスター・ヤング', 'Way Down Yonder In New Orleans', 1938, 0.1, 58, 192, 0.06, 0.08],
  ['レスター・ヤング', 'JATP Blues', 1946, 0.1, 60, 190, 0.06, 0.07],
  ['コールマン・ホーキンス', 'Fine Dinner', 1939, 0, 64, 173, 0.06, 0.06],
  ['コールマン・ホーキンス', 'JATP Blues', 1946, 0, 66, 190, 0.06, 0.06],
  ['バディ・リッチ（ドラム）', 'JATP Blues', 1946, 0, 72, 190, 0.02, 0.03],
];
// JATP Blues（1946・♩190）の奏者の PAPER の行。円の下の 3 人のボタンと起動時のパーカーで使う
const jatp = (name: string) => PAPER.findIndex(p => p[0] === name && p[1] === 'JATP Blues');
const KEY = 'nori-lab-presets';
const loadMine = (): Mine[] => { try { return minesFrom(JSON.parse(localStorage.getItem(KEY) as string), SHARE_RANGE); } catch { return []; } };
const saveMine = (a: Mine[]) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
const el = (tag: string, cls?: string | null, text?: string | null) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const opt = (v: string, text: string) => { const o = el('option', null, text) as HTMLOptionElement; o.value = v; return o; };
const grp = (label: string, opts: HTMLOptionElement[]) => { const g = el('optgroup') as HTMLOptGroupElement; g.label = label; g.append(...opts); return g; };
// ---- URL で共有（#21）。範囲は数値欄の min / max ----
const SHARE_RANGE = { bpm:minmax('bpm'), lag:minmax('lag'), dist:minmax('dist'), yureD:minmax('yd'), yureU:minmax('yu'), bassLag:minmax('bl') };
// URL で開いたノリ。あればプリセット欄に「共有されたノリ」として出す
const shared = fromQuery(new URLSearchParams(location.search), SHARE_RANGE);
// SD は平均（URL には入れない）。ゆらぎ・ベース位置は 0 のとき URL に載らないので、書かれていなければ既定値。ほかは今のまま
function applyShared(s: Shared){ const { name, ...vals } = s; Object.assign(P, { yureD:YURE_DEFAULT, yureU:YURE_DEFAULT, bassLag:0 }, vals, { sdLag:SD_AVG[0], sdUra:SD_AVG[1] }); sync(); }

// 選択は #preset の value だけで持つ: '' =（自分で調整中）/ 's' 共有されたノリ / 'p'+i プレイヤー / 'b'+i 基本 / 'm'+i 保存したノリ
function renderOptions(v: string){
  const mine = loadMine();
  $('preset').replaceChildren(opt('', '（自分で調整中）'),
    ...(shared ? [opt('s', `共有されたノリ${shared.name ? ': ' + shared.name : ''}`)] : []),
    grp('プレイヤー', PAPER.map((p, i) => opt('p' + i, `${p[0]} — ${p[1]} '${String(p[2]).slice(2)}`))),
    grp('基本', PRESETS.map((p, i) => opt('b' + i, p[0]))),
    ...(mine.length ? [grp('保存したノリ', mine.map((p, i) => opt('m' + i, p.name)))] : []));
  $('preset').value = v;
}
function refresh(){
  // タグは表示する丸めた値から決める（0.1399 が「ちょい後ろ 0.14」にならないように）
  const l = +P.lag.toFixed(2), h = +(P.dist / 100).toFixed(2), v = $('preset').value;
  $('pinfo').replaceChildren(el('span', 'tag tame', tameTag(l)), ' ', el('small', 'v', l.toFixed(2)), ' · ',
    el('span', 'tag hane', haneTag(h * 100)), ' ', el('small', 'v', h.toFixed(2)));
  // 円の下の 3 人: いま選んでいるプリセットの人だけ点灯
  document.querySelectorAll<HTMLButtonElement>('.trio button').forEach(b => b.setAttribute('aria-pressed', String(v === 'p' + jatp(b.dataset.player!))));
  $('pdel').hidden = !v.startsWith('m');
  if (v.startsWith('m')) $('pdel').setAttribute('aria-label', `${loadMine()[+v.slice(1)].name} を削除`);
}
$('preset').addEventListener('change', e => {
  const v = (e.target as HTMLSelectElement).value, i = +v.slice(1), m = v[0] === 'm' && loadMine()[i];
  if (v === 's' && shared) { applyShared(shared); refresh(); return; }
  const [lag, dist, bpm, sdLag = SD_AVG[0], sdUra = SD_AVG[1]] = (v[0] === 'p' ? PAPER[i].slice(3) : v[0] === 'b' ? PRESETS[i].slice(1) : m ? [m.lag, m.dist] : []) as number[];
  if (v) {
    P.lag = lag; P.dist = dist; if (bpm) P.bpm = bpm; P.sdLag = sdLag; P.sdUra = sdUra;
    // ゆらぎの % は保存したノリだけが持つ。壊れた値は既定値に戻す
    const yure = (x: unknown) => typeof x === 'number' && isFinite(x) ? clampTo(x, 0, 150) : YURE_DEFAULT;
    if (m) { P.yureD = yure(m.yureD); P.yureU = yure(m.yureU); }
    sync();
  }
  refresh();
});
// 円の下の 3 人 = 「誰風で吹く？」でその奏者を選んだのと同じ（鳴らし始めはしない）
document.querySelectorAll<HTMLButtonElement>('.trio button').forEach(b => b.addEventListener('click', () => {
  $('preset').value = 'p' + jatp(b.dataset.player!); $('preset').dispatchEvent(new Event('change'));
}));
// 別のタブで保存・削除されたら一覧を作り直す（古い番号のまま読んだり消したりしないように）。保存したノリを選んでいたら選択は外す
window.addEventListener('storage', e => {
  if (e.key !== KEY && e.key !== null) return;
  const v = $('preset').value; renderOptions(v.startsWith('m') ? '' : v); refresh();
});
$('pdel').addEventListener('click', e => {
  const a = loadMine(); a.splice(+$('preset').value.slice(1), 1); saveMine(a);
  renderOptions(''); refresh();
  if (e.detail === 0) $('preset').focus(); // キーボード操作のときだけ。タップ後に focus すると iOS でピッカーが開くことがある
});
$('psave').addEventListener('click', () => {
  const name = $('pname').value.trim() || `保存 ${loadMine().length + 1}`;
  const a = loadMine(); a.push({ name, lag:+P.lag.toFixed(4), dist:P.dist, yureD:P.yureD, yureU:P.yureU }); saveMine(a);
  $('pname').value = '';
  const n = loadMine().length;
  renderOptions(n === a.length ? 'm' + (n - 1) : $('preset').value); // 保存に失敗したら（容量・プライベートモード）選択は動かさない
  refresh();
});
$('pshare').addEventListener('click', async () => {
  const sel = $<HTMLSelectElement>('preset'), v = sel.value;
  // 名前: 入力欄 → 選んでいるプリセットの名前 → なし
  const name = $('pname').value.trim() || (v === 's' ? shared?.name ?? '' : v ? sel.selectedOptions[0].textContent ?? '' : '');
  const url = `${location.origin}${location.pathname}?${toQuery({ name, bpm:P.bpm, lag:P.lag, dist:P.dist, yureD:P.yureD, yureU:P.yureU, bassLag:P.bassLag })}`;
  const msg = (t: string) => { $('pmsg').textContent = t; };
  if (navigator.share) {
    try { await navigator.share({ title: 'ノリ・ラボ', text: name || 'ノリ・ラボのノリ', url }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; } // 閉じただけなら何もしない。それ以外はコピーに回す
  }
  try { await navigator.clipboard.writeText(url); msg('リンクをコピーした'); }
  catch { msg(url); } // コピーもできないときは URL をそのまま見せる
});
// on(...) より後に登録するので、P が更新されてから refresh が走る
[['delay-r','input'],['delay','change'],['lag-r','input'],['lag','change'],['dist-r','input'],['dist','change']]
  .forEach(([id, ev]) => $(id).addEventListener(ev, () => { $('preset').value = ''; refresh(); }));
[['bpm-r','input'],['bpm','change']].forEach(([id, ev]) => $(id).addEventListener(ev, refresh));
// 起動時: URL で共有されたノリがあればそれ（名前は保存欄に入れておく）。なければパーカー — JATP Blues
// （同じ録音・同じテンポ 190 でヤング・ホーキンスと聴き比べられる）。どちらも選んだときと同じ処理を通す
renderOptions(shared ? 's' : 'p' + jatp('チャーリー・パーカー'));
if (shared?.name) $('pname').value = shared.name;
$('preset').dispatchEvent(new Event('change'));

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
// 「タップして聴く」は初回だけ。どの方法で鳴らしても、鳴らした時点で消して覚える
const SEEN = 'nori-lab-seen';
$('tapstart').hidden = (() => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } })();
$('tapstart').addEventListener('click', () => start());
function start(){
  $('tapstart').hidden = true; try { localStorage.setItem(SEEN, '1'); } catch {}
  if (!ctx) { initAudio(); VOL.forEach(k => { volParam(k).value = gainOf(k); }); }
  startScheduler();
  $('play').setAttribute('aria-pressed','true'); $('play').textContent = '停止'; // 三角・四角は CSS（::before）
  requestAnimationFrame(loop);
}
function stop(){
  stopScheduler();
  $('play').setAttribute('aria-pressed','false'); $('play').textContent = '再生';
  draw();
}
$('play').addEventListener('click', () => playing ? stop() : start());
document.addEventListener('keydown', e => {
  const t = e.target, skip = t instanceof HTMLSelectElement || t instanceof HTMLButtonElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.localName === 'summary') || (t instanceof HTMLInputElement && t.type !== 'range');
  if (e.code === 'Space' && !skip) {
    e.preventDefault(); playing ? stop() : start();
  }
});

// ---- 円のドラッグ（値の計算は logic.ts の dialValue） ----
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, t = clampTo(((x - ax)*dx + (y - ay)*dy) / (dx*dx + dy*dy), 0, 1);
  return Math.hypot(x - ax - t*dx, y - ay - t*dy);
};
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
$('twobeat').addEventListener('toggle', draw); // 閉じている間は幅 0 なので、開いたら描き直す

// ---- 音量: 範囲と既定値は markup の range が正。表示 % はつまみ位置で、gain = (位置/100)^2 ----
const rng = (k: VolKey) => $('vol-' + k + '-r');
const lim = (k: VolKey) => minmax('vol-' + k + '-r');
const VKEY = 'nori-lab-volume';
const VSPEC = Object.fromEntries(VOL.map(k => [k, [...lim(k), Number(rng(k).defaultValue)]])) as Record<VolKey, [number, number, number]>;
const loadVol = () => { try { return volFrom(JSON.parse(localStorage.getItem(VKEY) as string), VSPEC); } catch { return volFrom(null, VSPEC); } };
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
initKnobs(); // 音量の初期値（writeVol）を入れた後に描く
