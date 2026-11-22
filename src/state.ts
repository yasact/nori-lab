// 大半が input なので既定は HTMLInputElement。select / button に使うのは value・hidden・textContent など共通のものだけ
export const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

// 遅れは「遅れ値（拍比）」で持ち、ms は表示と入力のための換算値
export const P = { bpm:180, lag:0.075, dist:60 } as { bpm: number; lag: number; dist: number; readonly delay: number };
Object.defineProperty(P, 'delay', { get(){ return P.lag * 60000 / P.bpm; } });
