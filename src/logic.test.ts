import { describe, expect, it } from 'vitest';
import { dialValue, fromQuery, haneTag, NAME_MAX, tameTag, toQuery, unwrap, VOL, volFrom, type VolKey } from './logic';

describe('dialValue', () => {
  it('表拍は 12 時をまたいでも裏拍値を保つ', () => expect(dialValue('down', { lag:0.02, dist:60 }, -0.05)).toEqual({ lag:-0.03, dist:65 }));
  it('裏拍は行き過ぎても 80 で止まる', () => expect(dialValue('up', { lag:0.075, dist:60 }, 0.9)).toEqual({ lag:0.075, dist:80 }));
  it('表拍はハネ値 80 の端で止まる', () => expect(dialValue('down', { lag:0.075, dist:60 }, -0.3)).toEqual({ lag:-0.125, dist:80 }));
  it('表拍はハネ値 40 の端で止まる', () => expect(dialValue('down', { lag:0.075, dist:60 }, 1.2)).toEqual({ lag:0.275, dist:40 }));
  it('針はハネ値を保つ', () => expect(dialValue('needle', { lag:0.075, dist:60 }, 0.1)).toEqual({ lag:0.175, dist:60 }));
  it('針は -0.15 で止まる', () => expect(dialValue('needle', { lag:0.075, dist:60 }, -0.7)).toEqual({ lag:-0.15, dist:60 }));
  it('unwrap は直前の角度に近い周に寄せる', () => {
    expect(unwrap(0.02, 0.98)).toBeCloseTo(1.02, 9);
    expect(unwrap(0.97, 0.01)).toBeCloseTo(-0.03, 9);
  });
});

describe('volFrom', () => {
  // index.html の range と同じ [min, max, 既定値]
  const SPEC: Record<VolKey, [number, number, number]> = { all:[0, 100, 100], horn:[0, 150, 100], bass:[0, 150, 100], drums:[0, 150, 100] };
  const vol = (o: unknown, want: Partial<Record<VolKey, number>>) => expect(volFrom(o, SPEC)).toEqual(Object.fromEntries(VOL.map(k => [k, want[k] ?? 100])));
  it('文字列は既定値', () => vol({ all:'x' }, {}));
  it('null は既定値', () => vol({ all:null }, {}));
  it('範囲の上で止める', () => vol({ all:999, bass:999 }, { bass:150 }));
  it('範囲の下で止める', () => vol({ horn:-5 }, { horn:0 }));
  it('整数に丸める', () => vol({ drums:40.7 }, { drums:41 }));
  it('全体 0 は復元しない', () => vol({ all:0, bass:0 }, { bass:0 }));
  it('オブジェクト以外は既定値', () => { vol(null, {}); vol(5, {}); });
});

describe('fromQuery / toQuery', () => {
  // index.html の数値欄と同じ min / max
  const R = { bpm:[40, 400], lag:[-0.5, 0.5], dist:[30, 90], yureD:[0, 150], yureU:[0, 150], bassLag:[-0.2, 0.2] } as Parameters<typeof fromQuery>[1];
  const from = (s: string) => fromQuery(new URLSearchParams(s), R);
  it('値がなければ null', () => {
    expect(from('')).toBeNull();
    expect(from('zz=1&n=%20')).toBeNull();
  });
  it('範囲外は clamp、数でない・空は無視', () => expect(from('bpm=999&lag=abc&hane=&yd=-5&n=<b>x</b>')).toEqual({ bpm:400, yureD:0, name:'<b>x</b>' }));
  it('名前は NAME_MAX 文字まで', () => expect(from('n=' + 'あ'.repeat(99))!.name).toHaveLength(NAME_MAX));
  it('往復で戻る（0 は URL に載らない）', () => {
    const v = { name:'自分のノリ & co', bpm:190, lag:0.1234, dist:62.5, yureD:30, yureU:0, bassLag:-0.05 };
    const { yureU, ...back } = v;
    expect(from(toQuery(v))).toEqual(back);
  });
});

describe('tameTag / haneTag の境界', () => {
  it('tameTag', () => expect([-0.03, -0.02, -0.019, 0.039, 0.04, 0.139, 0.14].map(tameTag))
    .toEqual(['前ノリ', '前ノリ', 'ジャスト', 'ジャスト', 'ちょい後ろ', 'ちょい後ろ', 'かなり後ろ']));
  it('haneTag', () => expect([53.9, 54, 61.9, 62, 68.9, 69].map(haneTag))
    .toEqual(['まっすぐ', '軽く跳ねる', '軽く跳ねる', '3連くらい', '3連くらい', '強く跳ねる']));
});
