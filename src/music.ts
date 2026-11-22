// ---- コード進行 ----
type Quality = { t: number[]; s: number[] };
type Chord = { root: number; q: Quality; name: string };
type Beat = { ch: Chord; seg: number; first: boolean; last: boolean };

const PC: Record<string, number> = {C:0,Db:1,D:2,Eb:3,E:4,F:5,Gb:6,G:7,Ab:8,A:9,Bb:10,B:11};
const Q: Record<string, Quality> = {
  '7':   {t:[0,4,7,10], s:[0,2,4,5,7,9,10]},
  'm7':  {t:[0,3,7,10], s:[0,2,3,5,7,9,10]},
  '6':   {t:[0,4,7,9],  s:[0,2,4,5,7,9,11]},
  'maj7':{t:[0,4,7,11], s:[0,2,4,5,7,9,11]},
  'dim7':{t:[0,3,6,9],  s:[0,2,3,5,6,8,9,11]},
};
const PROGS: Record<string, [string, string, number][]> = {
  blues: [['Bb','7',4],['Eb','7',4],['Bb','7',4],['F','m7',2],['Bb','7',2],['Eb','7',4],['E','dim7',4],
          ['Bb','7',4],['G','7',4],['C','m7',4],['F','7',4],['Bb','7',2],['G','7',2],['C','m7',2],['F','7',2]],
  rhythm:[['Bb','6',2],['G','7',2],['C','m7',2],['F','7',2],['Bb','6',2],['G','7',2],['C','m7',2],['F','7',2],
          ['F','m7',2],['Bb','7',2],['Eb','6',2],['E','dim7',2],['D','m7',2],['G','7',2],['C','m7',2],['F','7',2]],
  iivi:  [['C','m7',4],['F','7',4],['Bb','maj7',8]],
  one:   [['Bb','7',4]],
};
let BEATS: Beat[] = [];
export function buildProg(prog: string){
  BEATS = []; let seg = 0;
  for (const [r, q, n] of PROGS[prog]) {
    const ch = { root:PC[r], q:Q[q], name: r.replace('b','♭') + (q === 'dim7' ? '°7' : q) };
    for (let i = 0; i < n; i++) BEATS.push({ ch, seg, first: i === 0, last: i === n - 1 });
    seg++;
  }
}
export const beatAt = (i: number) => BEATS[((i % BEATS.length) + BEATS.length) % BEATS.length];
const pcs = (ch: Chord, key: 't' | 's') => ch.q[key].map(x => (x + ch.root) % 12);
const inRange = (pcList: number[], lo: number, hi: number) => { const a: number[] = []; for (let m = lo; m <= hi; m++) if (pcList.includes(m % 12)) a.push(m); return a; };
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---- メロディ生成：拍頭にコードトーン、裏拍は経過音／半音アプローチ ----
const LO = 58, HI = 82;
const mel: { cur: number | null; dir: number } = { cur:null, dir:1 };
export function melodyBeat(i: number): [number, number] {
  const ch = beatAt(i).ch, nx = beatAt(i + 1).ch;
  if (mel.cur === null) { const c = inRange(pcs(ch,'t'), 66, 74); mel.cur = pick(c); }
  const down = mel.cur;
  if (Math.random() < 0.18) mel.dir *= -1;
  if (down >= HI - 4) mel.dir = -1; if (down <= LO + 4) mel.dir = 1;
  const tones = inRange(pcs(nx,'t'), LO, HI);
  const leap = Math.random() < 0.1;
  const want = (m: number) => { const d = (m - down) * mel.dir; return leap ? d >= 6 && d <= 9 : d >= 1 && d <= 5; };
  let c = tones.filter(want);
  if (!c.length) { mel.dir *= -1; c = tones.filter(want); }
  if (!c.length) c = tones.filter(m => m !== down && Math.abs(m - down) <= 7);
  const target = c.length ? pick(c) : down;
  const diff = target - down, sg = Math.sign(diff) || 1;
  let up: number;
  const between = inRange(pcs(ch,'s'), Math.min(down,target) + 1, Math.max(down,target) - 1);
  if (Math.abs(diff) >= 3 && between.length && Math.random() < 0.7) {
    up = between.reduce((a, b) => Math.abs(b - (down+target)/2) < Math.abs(a - (down+target)/2) ? b : a);
  } else if (Math.random() < 0.5 && target - sg !== down) {
    up = target - sg;              // 半音下（上）から入る
  } else {
    up = target + sg;              // いったん越えてから戻る
    if (up === down) up = target - sg;
  }
  mel.cur = target;
  return [down, Math.max(LO - 2, Math.min(HI + 2, up))];
}

// ---- ウォーキングベース ----
let bcur = 46;
const near = (cands: number[], ref: number) => !cands.length ? ref : cands.reduce((a, b) => Math.abs(b - ref) < Math.abs(a - ref) ? b : a);
export function bassBeat(i: number){
  const b = beatAt(i), nb = beatAt(i + 1);
  let n: number;
  if (b.first) n = near(inRange([b.ch.root], 36, 50), bcur);
  else if (b.last) { const r = near(inRange([nb.ch.root], 36, 52), bcur); n = r + (Math.random() < 0.5 ? 1 : -1); }
  else n = near(inRange(pcs(b.ch,'t').filter(p => p !== b.ch.root), 36, 52).filter(m => m !== bcur), bcur + (Math.random() < 0.5 ? 3 : -3));
  bcur = n; return n;
}

// 再生開始ごとにメロディとベースの位置を戻す
export function resetMusic(){ mel.cur = null; mel.dir = 1; bcur = 46; }
