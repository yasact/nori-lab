// 純粋な計算（DOM に触らない）。範囲は markup の入力欄が正なので、main.ts が DOM から読んで引数で渡す。テストは logic.test.ts

export const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---- 遅れ値・ハネ値のタグ ----
export const tameTag = (lag: number) => lag <= -0.02 ? '前ノリ' : lag < 0.04 ? 'ジャスト' : lag < 0.14 ? 'ちょい後ろ' : 'かなり後ろ';
export const haneTag = (dist: number) => dist < 54 ? 'まっすぐ' : dist < 62 ? '軽く跳ねる' : dist < 69 ? '3連くらい' : '強く跳ねる';

// ---- URL で共有（#21）: ?n=名前&bpm=&lag=&hane=&yd=&yu=&bl= ----
export type Shared = { name?: string; bpm?: number; lag?: number; dist?: number; yureD?: number; yureU?: number; bassLag?: number };
export type ShareField = Exclude<keyof Shared, 'name'>;
const SHARE_KEYS: [string, ShareField][] = [['bpm','bpm'], ['lag','lag'], ['hane','dist'], ['yd','yureD'], ['yu','yureU'], ['bl','bassLag']];
export const NAME_MAX = 40;
// URL は誰でも書き換えられるので信用しない: 数でないもの・空は無視、範囲外は clamp、名前は長さを切る（表示は textContent だけ）
export function fromQuery(q: URLSearchParams, range: Record<ShareField, [number, number]>): Shared | null {
  const v: Shared = {};
  for (const [k, f] of SHARE_KEYS) {
    const s = q.get(k), x = Number(s);
    if (s === null || s.trim() === '' || !isFinite(x)) continue;
    v[f] = clampTo(x, ...range[f]);
  }
  const n = q.get('n')?.trim().slice(0, NAME_MAX);
  if (n) v.name = n;
  return Object.keys(v).length ? v : null;
}
// 0 のゆらぎ・ベース位置は付けない（URL を短く）
export function toQuery(v: Required<Omit<Shared, 'name'>> & { name: string }){
  const q = new URLSearchParams();
  if (v.name) q.set('n', v.name.slice(0, NAME_MAX));
  q.set('bpm', String(v.bpm)); q.set('lag', String(+v.lag.toFixed(4))); q.set('hane', String(v.dist));
  if (v.yureD) q.set('yd', String(v.yureD));
  if (v.yureU) q.set('yu', String(v.yureU));
  if (v.bassLag) q.set('bl', String(+v.bassLag.toFixed(4)));
  return q.toString();
}

// ---- 円のドラッグ: つかんだ位置からの回転量（拍）で動かす。範囲はスライダーと同じ ----
export type Mode = 'down' | 'up' | 'needle';
export const frac = (x: number, y: number, g: { cx: number; cy: number }) => { const f = Math.atan2(x - g.cx, -(y - g.cy)) / (2*Math.PI); return f < 0 ? f + 1 : f; };
export const unwrap = (a: number, ref: number) => a + Math.round(ref - a);
const snap = (x: number, step: number) => +(Math.round(x / step) * step).toFixed(3);
// s は範囲内に収めた開始値、acc は累積回転量（拍）。表拍は裏拍値を保ち、裏拍はハネ値だけ、針は遅れ値だけ
export function dialValue(mode: Mode, s: { lag: number; dist: number }, acc: number){
  if (mode === 'up') return { lag: s.lag, dist: clampTo(snap(s.dist + acc*100, 0.5), 40, 80) };
  if (mode === 'needle') return { lag: clampTo(snap(s.lag + acc, 0.005), -0.15, 0.3), dist: s.dist };
  const ura = s.lag + s.dist/100;
  // 範囲で止めてから丸める（端の ura-0.8 などに浮動小数の端数が残らないように）
  const lag = snap(clampTo(s.lag + acc, Math.max(-0.15, ura - 0.8), Math.min(0.3, ura - 0.4)), 0.005);
  return { lag, dist: clampTo(snap((ura - lag)*100, 0.5), 40, 80) };
}

// ---- 音量の保存値 ----
export const VOL = ['all', 'horn', 'bass', 'drums'] as const;
export type VolKey = typeof VOL[number];
// spec は [min, max, 既定値]。Number(null) や Number('') は 0（無音）になるので typeof で弾く。全体 0 だけは復元しない（無音で始まると壊れて見える）
export const volFrom = (o: unknown, spec: Record<VolKey, [number, number, number]>) => Object.fromEntries(VOL.map(k => {
  const v = o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined, [lo, hi, def] = spec[k];
  if (typeof v !== 'number' || !isFinite(v)) return [k, def];
  const r = clampTo(Math.round(v), lo, hi);
  return [k, k === 'all' && r === 0 ? def : r];
})) as Record<VolKey, number>;
