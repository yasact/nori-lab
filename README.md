# ノリ・ラボ（nori-lab）

ジャズの 8 分音符の「ノリ」を、井上裕章『ジャズの「ノリ」を科学する』の指標で再現して鳴らす Web Audio アプリ。
表拍の遅れと裏拍までの距離を動かしながら、ホーン・ベース・ドラムで鳴らし続けて聴き比べられる。

https://yasact.github.io/nori-lab/

## 指標

- 遅れ値 = ベースの拍頭に対する表拍 8 分の遅れ ÷ 1 拍の長さ（マイナスで前ノリ）
- ハネ値 = 表拍 8 分の長さ ÷ 1 拍の長さ（= 表拍の音から裏拍の音までの距離）
- 裏拍値 = 遅れ値 + ハネ値（グリッドから見た裏拍の位置。ストレートは 0.5）

プレイヤーのプリセットは、次の論文の表 1 の中央値。

井上裕章ほか（2017）「スウィングジャズからビバップへの変遷期における8分音符タイミングの変化」音楽知覚認知研究 23(1). https://doi.org/10.32199/jsmpc.23.1_3

## 開発

```sh
npm install
npm run dev      # http://localhost:5173/nori-lab/
npm run build    # tsc --noEmit → vite build（dist/）
```

Vite + TypeScript（framework なし、runtime 依存なし）。main に push すると GitHub Actions が build して GitHub Pages に deploy する。

## License

[MIT](LICENSE)
