// 大半が input なので既定は HTMLInputElement。select / button に使うのは value・hidden・textContent など共通のものだけ
export const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

// ゆらぎ（表・裏）の既定値（%）。保存したノリに値がないときもこれを使う
export const YURE_DEFAULT = 0; // 既定はぴったり。聴き比べ（平均の位置）を邪魔しないように、ゆらぎは自分で足す
// 実測の SD がない「基本」「保存したノリ」用: 井上ほか（2017）表1 のソリスト 8 行の平均 [遅れ値 SD, 裏拍値 SD]
export const SD_AVG: [number, number] = [0.064, 0.066];

// 遅れは「遅れ値（拍比）」で持ち、ms は表示と入力のための換算値
// bassLag はベースの位置（ライドのグリッドからのズレ ÷ 1拍。遅れ値はこれに関係なくグリッド基準）。yureD / yureU はゆらぎ（%）、sdLag / sdUra は 100% のときのずれの SD（拍）。SD は最後に選んだプリセットで決まる
export const P = { bpm:180, lag:0.075, dist:60, bassLag:0, yureD:YURE_DEFAULT, yureU:YURE_DEFAULT, sdLag:SD_AVG[0], sdUra:SD_AVG[1] } as
  { bpm: number; lag: number; dist: number; bassLag: number; yureD: number; yureU: number; sdLag: number; sdUra: number; readonly delay: number };
Object.defineProperty(P, 'delay', { get(){ return P.lag * 60000 / P.bpm; } });
