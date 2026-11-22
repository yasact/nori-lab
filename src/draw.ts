import { $, P } from './state';
import { ctx, playing, beatLog } from './audio';

// ---- 描画 ----
const cv = $<HTMLCanvasElement>('cv'), g2 = cv.getContext('2d')!;
export const dial = $<HTMLCanvasElement>('dial');
const g3 = dial.getContext('2d')!;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let head: number | null = null;
let curChord = '';
export function draw(){
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W*dpr || cv.height !== H*dpr) { cv.width = W*dpr; cv.height = H*dpr; }
  g2.setTransform(dpr,0,0,dpr,0,0); g2.clearRect(0,0,W,H);
  const T = 60000 / P.bpm, padL = 8, padR = 8, top = 22, bot = H - 26;
  const span = 2*T, x0 = padL, x1 = W - padR;
  const xOf = (ms: number) => x0 + (ms / span) * (x1 - x0);
  const ink = css('--ink'), mute = css('--mute'), grid = css('--grid');
  g2.font = '11px "DM Mono", ui-monospace, monospace'; g2.textBaseline = 'alphabetic';

  // グリッド
  for (let b = 0; b <= 2; b++) {
    const x = xOf(b*T);
    g2.strokeStyle = grid; g2.lineWidth = 2;
    g2.beginPath(); g2.moveTo(x, top-6); g2.lineTo(x, bot); g2.stroke();
    if (b < 2) {
      g2.fillStyle = mute; g2.textAlign = b===0 ? 'left' : 'center';
      g2.fillText(`beat ${b+1}`, b===0 ? x+4 : x, H-8);
      const xh = xOf(b*T + T/2);
      g2.globalAlpha = .45; g2.setLineDash([3,4]); g2.lineWidth = 1;
      g2.beginPath(); g2.moveTo(xh, top); g2.lineTo(xh, bot); g2.stroke();
      g2.setLineDash([]); g2.globalAlpha = 1;
    }
  }
  // 音符（2拍分＋はみ出し分）
  const s = P.dist/100;
  const laneY = (top + bot)/2 - 10, h = 26;
  for (let b = -1; b <= 2; b++) {
    const tD = b*T + P.delay, tU = tD + s*T;
    ([[tD, s*T, css('--down'), '表'], [tU, (1-s)*T, css('--up'), '裏']] as [number, number, string, string][]).forEach(([t0, len, col, lab]) => {
      const a = Math.max(t0, 0), z = Math.min(t0 + len*0.92, span);
      if (z <= 0 || a >= span) return;
      g2.fillStyle = col; g2.globalAlpha = .22;
      g2.fillRect(xOf(a), laneY, xOf(z)-xOf(a), h);
      g2.globalAlpha = 1;
      if (t0 >= 0 && t0 <= span) {
        g2.fillRect(xOf(t0)-1.5, laneY-8, 3, h+16);
        g2.fillStyle = col; g2.textAlign = 'left';
        g2.fillText(lab, xOf(t0)+5, laneY-2);
      }
    });
  }
  // 遅れの寸法線（beat1）
  if (Math.abs(P.delay) >= 1) {
    const y = bot - 8, xa = xOf(0), xb = xOf(P.delay);
    if (xb >= x0) {
      g2.strokeStyle = css('--brass'); g2.lineWidth = 1.5;
      g2.beginPath(); g2.moveTo(xa, y); g2.lineTo(xb, y); g2.stroke();
      g2.fillStyle = css('--brass'); g2.textAlign = 'left';
      g2.fillText(`${P.delay>0?'+':''}${Math.round(P.delay)}ms`, Math.max(xa, xb)+4, y+4);
    }
  }
  // 再生ヘッド＋いまのコード
  if (head !== null && curChord) {
    g2.fillStyle = ink; g2.textAlign = 'right';
    g2.font = '500 15px "DM Mono", ui-monospace, monospace';
    g2.fillText(curChord, x1, 14);
  }
  if (head !== null) {
    g2.strokeStyle = ink; g2.globalAlpha = .7; g2.lineWidth = 1.5;
    const x = xOf(head);
    g2.beginPath(); g2.moveTo(x, top-10); g2.lineTo(x, bot+4); g2.stroke(); g2.globalAlpha = 1;
  }
  drawDial();
}

// ---- 円の表示: 1周=1拍、12時=拍頭、時計回り。f は拍の割合 ----
// 描画と当たり判定で同じ寸法を使う
export type Geom = { W: number; H: number; cx: number; cy: number; R: number };
export const dialGeom = (): Geom => { const W = dial.clientWidth, H = dial.clientHeight; return { W, H, cx:W/2, cy:H/2, R:Math.min(W, H)/2 - 26 }; };
export const onDial = (f: number, r: number, g: Geom): [number, number] => [g.cx + r*Math.sin(2*Math.PI*f), g.cy - r*Math.cos(2*Math.PI*f)];
function drawDial(){
  const dpr = window.devicePixelRatio || 1, g = dialGeom(), { W, H, cx, cy, R } = g;
  if (R <= 0) return; // 非表示・未レイアウト（幅 0）だと arc が例外を投げ、draw() の呼び元（再生ループ）まで止まる
  // 非整数の dpr で毎フレーム確保し直さないよう丸めて比べる
  const bw = Math.round(W*dpr), bh = Math.round(H*dpr);
  if (dial.width !== bw || dial.height !== bh) { dial.width = bw; dial.height = bh; }
  g3.setTransform(dpr,0,0,dpr,0,0); g3.clearRect(0,0,W,H);
  const grid = css('--grid'), mute = css('--mute');
  const fD = P.lag, fU = P.lag + P.dist/100, ang = (f: number) => 2*Math.PI*f - Math.PI/2;
  const ray = (f: number, r0: number, r1: number) => { g3.beginPath(); g3.moveTo(...onDial(f, r0, g)); g3.lineTo(...onDial(f, r1, g)); g3.stroke(); };
  // 縁・拍頭
  g3.lineCap = 'butt'; g3.strokeStyle = grid; g3.lineWidth = 1.5;
  g3.beginPath(); g3.arc(cx, cy, R, 0, 2*Math.PI); g3.stroke();
  g3.lineWidth = 3; ray(0, R - 10, R + 6);
  // 目盛り（拍頭基準 = 裏拍値の位置）: 8分 = 1/2、3連 = 1/3・2/3。ラベルは縁の内側（外側は表/裏のラベルが通る）
  g3.font = '10px "Zen Kaku Gothic New", sans-serif'; g3.textAlign = 'center'; g3.textBaseline = 'middle';
  ([['m-t8', [1/2], grid, [3,4], '8分'], ['m-t3', [1/3, 2/3], css('--brass'), [], '3連']] as [string, number[], string, number[], string][]).forEach(([id, fs, col, dash, lab]) => {
    if (!$(id).checked) return;
    g3.strokeStyle = g3.fillStyle = col; g3.globalAlpha = .6; g3.lineWidth = 1.5;
    fs.forEach(f => { g3.setLineDash(dash); ray(f, R - 10, R + 6); g3.setLineDash([]); g3.fillText(lab, ...onDial(f, R - 20, g)); });
    g3.globalAlpha = 1;
  });
  // 表→裏 の弧（ハネ値）
  g3.strokeStyle = css('--down'); g3.globalAlpha = .22; g3.lineWidth = 8;
  g3.beginPath(); g3.arc(cx, cy, R, ang(fD), ang(fU)); g3.stroke(); g3.globalAlpha = 1;
  // 針
  g3.strokeStyle = mute; g3.lineWidth = 3; g3.lineCap = 'round';
  ray(fD, 0, R); ray(fU, 0, R);
  g3.fillStyle = mute; g3.beginPath(); g3.arc(cx, cy, 5, 0, 2*Math.PI); g3.fill();
  // 拍頭ラベルは針の後に下地つきで描く（lag 0 で針が文字に重なるため）
  g3.font = '11px "Zen Kaku Gothic New", sans-serif'; g3.textAlign = 'center'; g3.textBaseline = 'top';
  const lw = g3.measureText('拍頭').width + 4;
  g3.fillStyle = css('--panel'); g3.fillRect(cx - lw/2, cy - R + 13, lw, 14);
  g3.fillStyle = mute; g3.fillText('拍頭', cx, cy - R + 14);
  // 丸とラベル（ラベルは縁の外）
  g3.font = '700 13px "Zen Kaku Gothic New", sans-serif'; g3.textBaseline = 'middle';
  ([[fD, css('--down'), '表'], [fU, css('--up'), '裏']] as [number, string, string][]).forEach(([f, col, lab]) => {
    g3.fillStyle = col;
    g3.beginPath(); g3.arc(...onDial(f, R, g), 9, 0, 2*Math.PI); g3.fill();
    g3.fillText(lab, ...onDial(f, R + 17, g));
  });
  // 再生ヘッド
  if (head !== null) {
    const T = 60000 / P.bpm;
    g3.strokeStyle = css('--ink'); g3.globalAlpha = .7; g3.lineWidth = 1.5; g3.lineCap = 'butt';
    ray((head % T) / T, 0, R); g3.globalAlpha = 1;
  }
}

export function loop(){
  if (!playing) { head = null; draw(); return; }
  const now = ctx.currentTime; let cur: [number, number, string] | null = null;
  for (const e of beatLog) if (e[0] <= now) cur = e;
  if (cur) { head = ((cur[1] % 2) * (60/P.bpm) + (now - cur[0])) * 1000; curChord = cur[2]; } else head = null;
  draw(); requestAnimationFrame(loop);
}
