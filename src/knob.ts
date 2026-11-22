// ミキサーのノブ（PC 幅）。値は同じ .ch の range が持ち、ノブは描画と上下ドラッグだけ。
// ドラッグは range に値を入れて input / change を出すので、音量の処理と保存は range のときと同じ
const A = 0.75 * Math.PI; // 0〜max を -135°〜+135° に割り当てる
const pt = (a: number, r: number) => `${34 + r*Math.sin(a)} ${34 - r*Math.cos(a)}`;
const arc = (a0: number, a1: number, r: number) => `M${pt(a0, r)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1, r)}`;
// 色は var() で持たせて、テーマが変わっても描き直さずに済ませる
function drawKnob(k: SVGSVGElement, r: HTMLInputElement){
  const max = Number(r.max), v = Number(r.value), a = -A + 2*A*v/max, u = -A + 2*A*Math.min(100, max)/max;
  k.innerHTML = `<path d="${arc(-A, A, 28)}" style="stroke:var(--line)" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + (v > 0 ? `<path d="${arc(-A, a, 28)}" style="stroke:var(--brass)" stroke-width="6" fill="none" stroke-linecap="round"/>` : '')
    + `<circle cx="34" cy="34" r="20" style="fill:var(--bg);stroke:var(--line)"/>`
    + `<path d="M${pt(a, 8)} L${pt(a, 18)}" style="stroke:var(--ink)" stroke-width="3" stroke-linecap="round"/>`
    + `<circle cx="${34 + 33*Math.sin(u)}" cy="${34 - 33*Math.cos(u)}" r="1.6" style="fill:var(--brass)"/>`; // 100% の印
}
export function initKnobs(){
  document.querySelectorAll<HTMLElement>('.mix .ch').forEach(ch => {
    const k = ch.querySelector('svg.knob') as SVGSVGElement, r = ch.querySelector('input[type=range]') as HTMLInputElement;
    const redraw = () => drawKnob(k, r);
    // range の input と、数値欄の change（writeVol が range も書き換える）の両方で描き直す
    ch.addEventListener('input', redraw); ch.addEventListener('change', redraw);
    let y0: number | null = null, v0 = 0;
    k.addEventListener('pointerdown', e => { y0 = e.clientY; v0 = Number(r.value); k.setPointerCapture(e.pointerId); });
    k.addEventListener('pointermove', e => {
      if (y0 === null) return;
      const v = String(Math.round(Math.min(Number(r.max), Math.max(0, v0 + (y0 - e.clientY) * Number(r.max) / 150)))); // 150px で端から端
      if (v !== r.value) { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    const end = () => { if (y0 === null) return; y0 = null; r.dispatchEvent(new Event('change', { bubbles: true })); }; // 離したときに保存
    k.addEventListener('pointerup', end); k.addEventListener('pointercancel', end);
    redraw();
  });
}
