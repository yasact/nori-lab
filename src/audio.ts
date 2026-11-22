import { $, P } from './state';
import { beatAt, bassBeat, melodyBeat, resetMusic } from './music';

// ---- 音 ----
// initAudio() までは undefined（最初の再生で作る）。それより前は `if (ctx)` で確かめてから触る
export let ctx!: AudioContext;
export let hornBus: GainNode, bassBus: GainNode, drumBus: GainNode, out: GainNode;
let master: GainNode, noiseBuf: AudioBuffer;
export function initAudio(){
  ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  // パート別の音量はコンプの前（既定値で今の音を保つ）、全体はコンプの後（比例して効く）
  [hornBus, bassBus, drumBus] = [0, 0, 0].map(() => { const g = ctx.createGain(); g.connect(master); return g; });
  out = ctx.createGain();
  master.connect(comp).connect(out).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  // ライド右・ハット左に振って、同じ高域でも聞き分けられるようにする
  const pan = (v: number) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(drumBus); return p; };
  ridePan = pan(0.35); hatPan = pan(-0.35);
  // ライド: 808式の非整数比 square 6本を鳴らしっぱなしにして、VCA だけ叩くたびに開く
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  rideVca = ctx.createGain(); rideVca.gain.value = 0;
  hp.connect(rideVca).connect(ridePan);
  [205.3, 304.4, 369.6, 522.7, 540, 800].forEach(f => {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * 1.4; o.connect(hp); o.start();
  });
}
let ridePan: StereoPannerNode, hatPan: StereoPannerNode, rideVca: GainNode;
function noiseHit(t: number, freq: number, dur: number, vol: number, dest: AudioNode, type: BiquadFilterType = 'highpass'){
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + dur + 0.02);
}
function ride(t: number){
  const g = rideVca.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(0.05, t);
  g.setTargetAtTime(0.012, t, 0.04);       // アタック直後にすっと落ちて
  g.setTargetAtTime(0, t + 0.12, 0.5);     // 長めの余韻（wash）
  noiseHit(t, 7000, 0.03, 0.12, ridePan);  // スティックの当たり
}
// フットのハイハット「チッ」。ライドと帯域を分けるため bandpass
const hihat = (t: number) => noiseHit(t, 6000, 0.06, 0.45, hatPan, 'bandpass');
function bass(t: number, midi: number, len: number){
  const f = 440 * Math.pow(2, (midi-69)/12);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42, t+0.008);
  g.gain.exponentialRampToValueAtTime(0.12, t+0.12); g.gain.exponentialRampToValueAtTime(0.001, t+len);
  o.connect(g); o2.connect(g); g.connect(bassBus);
  o.start(t); o2.start(t); o.stop(t+len+0.02); o2.stop(t+len+0.02);
}
function horn(t: number, midi: number, len: number, vol: number){
  const f = 440 * Math.pow(2, (midi-69)/12);
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 1.003;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t+0.025);
  lp.frequency.exponentialRampToValueAtTime(1300, t+Math.max(0.05,len));
  const g = ctx.createGain(); const m = ctx.createGain(); m.gain.value = 0.5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+0.012);
  g.gain.setValueAtTime(vol*0.8, t+Math.max(0.02,len*0.6)); g.gain.linearRampToValueAtTime(0, t+len);
  o1.connect(lp); o2.connect(m).connect(lp); lp.connect(g).connect(hornBus);
  o1.start(t); o2.start(t); o1.stop(t+len+0.02); o2.stop(t+len+0.02);
}

// ---- ゆらぎ ----
// 標準正規分布（Box-Muller）。1 - random は (0, 1] なので log は有限
export const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
export const GAP = 0.05; // 裏拍と前後の表拍の最小間隔（拍）。dist の入力範囲（30〜90%）なら、ゆらぎ 0% でかかることはない
// 1 拍分の [表, 裏, 次の表] の時刻。jD / jU / jN は表・裏・次の表のずれ（拍）。裏は表と次の表のあいだに収め、表を追い越さないことを優先する
export function swing(bt: number, T: number, d: number, s: number, jD: number, jU: number, jN: number): [number, number, number] {
  const tD = bt + d + jD*T, tN = bt + T + d + jN*T;
  return [tD, Math.max(Math.min(bt + d + s*T + jU*T, tN - GAP*T), tD + GAP*T), tN];
}

// ---- スケジューラ ----
export let playing = false;
let timer: ReturnType<typeof setInterval> | undefined, nextBeat = 0, beatIdx = 0, noteIdx = 0;
let zNext = 0; // 次の拍の表のずれ（標準正規）。裏が次の表を越えないよう 1 拍先に引いておく
export const beatLog: [number, number, string][] = []; // [time, idx, chord]
const LOOK = 0.15;
function tick(){
  const now = ctx.currentTime;
  while (nextBeat < now + LOOK) {
    const T = 60 / P.bpm, d = P.delay/1000, s = P.dist/100;
    const bt = nextBeat;
    beatLog.push([bt, beatIdx, beatAt(beatIdx).ch.name]); if (beatLog.length > 16) beatLog.shift();
    if ($('m-ride').checked) ride(bt);
    if ($('m-hh').checked && beatIdx % 2 === 1) hihat(bt);
    const bn = bassBeat(beatIdx);
    if ($('m-bass').checked) bass(bt + P.bassLag*T, bn, T*0.92); // ホーンは動かさない（グリッド基準）
    const mono = $('m-mono').checked, acc = $('m-acc').checked;
    // ゆらぎはホーンだけ。リズム隊はグリッドのまま
    const sdD = P.sdLag * P.yureD/100, sdU = P.sdUra * P.yureU/100, zN = gauss();
    const [tD0, tUp, tN] = swing(bt, T, d, s, zNext*sdD, gauss()*sdU, zN*sdD); zNext = zN;
    const tDown = Math.max(tD0, now + 0.005);
    const [md, mu] = melodyBeat(beatIdx);
    const pDown = mono ? 74 : md;
    const pUp = mono ? 74 : mu;
    if ($('m-horn').checked) {
      horn(tDown, pDown, (tUp - tD0)*0.92, acc ? 0.16 : 0.2);
      horn(tUp, pUp, (tN - tUp)*0.92, acc ? 0.27 : 0.2);
    }
    noteIdx += 2; beatIdx++; nextBeat += T;
  }
}
// initAudio() の後に呼ぶ
export function startScheduler(){
  if (ctx.state === 'suspended') ctx.resume();
  nextBeat = ctx.currentTime + 0.12 + Math.max(0, -P.delay/1000, -P.bassLag*60/P.bpm);
  beatIdx = 0; noteIdx = 0; beatLog.length = 0; resetMusic(); zNext = gauss();
  timer = setInterval(tick, 25); tick();
  playing = true;
}
export function stopScheduler(){ clearInterval(timer); playing = false; }
