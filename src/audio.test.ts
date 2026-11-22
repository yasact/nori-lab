import { describe, expect, it } from 'vitest';
import { GAP, gauss, swing } from './audio';
import { bassBeat, buildProg, melodyBeat, resetMusic } from './music';

const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m)**2, 0) / a.length); };

describe('swing（ゆらぎ）', () => {
  it('4000 サンプルで SD が指定どおり', () => {
    const ds: number[] = [], us: number[] = [];
    for (let i = 0; i < 4000; i++) { const [tD, tU] = swing(0, 1, 0.1, 0.6, gauss()*0.07, gauss()*0.07, gauss()*0.07); ds.push(tD); us.push(tU); }
    expect(Math.abs(sd(ds) - 0.07)).toBeLessThan(0.007);
    expect(Math.abs(sd(us) - 0.07)).toBeLessThan(0.007);
  });
  it('150% の大きな SD でも裏は表を追い越さない', () => {
    for (let i = 0; i < 4000; i++) {
      const [a, b] = swing(0, 1, 0.1, 0.9, gauss()*0.15, gauss()*0.15, gauss()*0.15);
      expect(b).toBeGreaterThanOrEqual(a + GAP);
    }
  });
  it('0% はグリッドどおり', () => expect(swing(2, 0.5, 0.03, 0.6, 0, 0, 0)).toEqual([2 + 0.03, 2 + 0.03 + 0.6*0.5, 2 + 0.5 + 0.03]));
});

describe('メロディ・ベースの音域（乱数なので全進行で 2000 拍回す）', () => {
  for (const prog of ['blues', 'rhythm', 'iivi', 'one']) it(prog, () => {
    buildProg(prog); resetMusic();
    for (let i = 0; i < 2000; i++) {
      const [d, u] = melodyBeat(i), b = bassBeat(i);
      expect(d).toBeGreaterThanOrEqual(58); expect(d).toBeLessThanOrEqual(82); // 表拍は音域 58–82
      expect(u).toBeGreaterThanOrEqual(56); expect(u).toBeLessThanOrEqual(84); // 裏拍は経過音・アプローチで ±2 まで
      expect(b).toBeGreaterThanOrEqual(35); expect(b).toBeLessThanOrEqual(53); // 36–52 と半音アプローチ
    }
  });
});
