# ノリ・ラボ（nori-lab）

ジャズの8分音符の「ノリ」を、井上裕章『ジャズの「ノリ」を科学する』の指標で再現して鳴らす Web Audio アプリ。
Vite + TypeScript（framework なし、runtime 依存ゼロ、`strict: true`、外部読み込みは Google Fonts のみ）。公開先は GitHub Pages（https://yasact.github.io/nori-lab/、`vite.config.ts` の `base: '/nori-lab/'`）。main への push で `.github/workflows/deploy.yml` が build → `dist/` を deploy する。
`npm run dev` で開発、`npm run build`（`tsc --noEmit` → `vite build`）が通ることを確認する。

## 指標（本・論文と同じ定義）
- **遅れ値** = ベースの拍頭に対する表拍8分の遅れ ÷ 1拍の長さ（マイナスで前ノリ）
- **ハネ値** = 表拍8分の長さ ÷ 1拍の長さ（= 表拍の音から裏拍の音までの距離）
- **裏拍値** = 遅れ値 + ハネ値（グリッドから見た裏拍の位置。ストレートは 0.5）
- 出典: 井上裕章「スウィングジャズからビバップへの変遷期における8分音符タイミングの変化」日本音楽知覚認知学会誌 23(1) https://doi.org/10.32199/jsmpc.23.1_3

内部状態は `P = { bpm, lag(遅れ値), dist(ハネ値×100), bassLag(ベースの位置), yureD / yureU(ゆらぎ %), sdLag / sdUra(100% のときの SD、拍) }`。ms 表示は `P.delay` ゲッターで換算。
遅れ値で保持しているので、テンポを変えてもノリは保たれる。
このアプリの遅れ値はライド（リズム隊のグリッド）基準。ベースの位置（`bassLag`）が 0 のときだけ論文のベース基準と一致する。

## 構成
- ファイル（import は main → draw → audio → music の一方向。`state` はどこからでも読む）
  - `index.html`: markup だけ。`src/style.css`: CSS（テーマの CSS 変数もここ）
  - `src/state.ts`: `$`（getElementById。既定の型は HTMLInputElement）と `P`、`YURE_DEFAULT`、`SD_AVG`
  - `src/music.ts`: 進行・メロディ・ベース。DOM に触らない（`buildProg(name)` は進行名を引数で受ける）。再生開始時に `resetMusic()`
  - `src/audio.ts`: シンセとスケジューラ。`ctx` は最初の再生で `initAudio()` するまで undefined。`startScheduler()` / `stopScheduler()` と `playing` / `beatLog` を export
  - `src/draw.ts`: `#cv` と `#dial` の描画、再生中の `loop()`（`head` / `curChord` はここだけで持つ）
  - `src/main.ts`: 入口。入力のひも付け・プリセット・円のドラッグ・音量・再生ボタン/Space。音量の gain は `start()` で `initAudio()` の直後に入れる
- 音: Web Audio のシンセ（ホーン=saw+square→LPF、ベース=tri+sine、ライド=808式 square 6本→HPF→VCA＋スティック音（右）、ハイハット=ノイズ+BPF（左））
  - グラフ: 各声部 → `hornBus` / `bassBus` / `drumBus`（ライド・ハットの panner）→ `master`(0.8) → DynamicsCompressor → `out` → destination。新しい声部は必ずどれかの bus につなぐ（`master` に直結しない。`noiseHit` の `dest` は必須）
- 詳細設定（`<details class="adv">`、既定で閉じている）: 表のゆらぎ・裏のゆらぎ・ベースの位置
- ベースの位置（#13）: 「詳細設定」の中。`bassLag` = ライドのグリッドからのズレ ÷ 1拍（スライダー ±0.1、数値 ±0.2、ms を `#bl-ms` に表示）。ベースの発音だけを `bt + bassLag*T` にずらし、ホーン・ライド・ハットはグリッドのまま（ベースから見た遅れ値が変わる）。プリセットとは独立（選んでも変わらず、保存もしない。選択も外さない）。2拍表示では 0 以外のときだけ上端に印と「ベース」を描く（円には出さない）。再生開始の余白に前ノリ分を足している
- checkbox の置き場所: 円の目盛り `#m-t8` / `#m-t3` は表示パネル、ホーンの吹き方 `#m-acc` / `#m-mono` は再生ボタンの行、パートを鳴らすか `#m-horn` / `#m-bass` / `#m-ride` / `#m-hh` はミキサーの M ボタン（中身は checkbox で checked = 鳴らす。外れていると `:has()` で点灯）
- ミキサー（音量）: 再生ボタンの下。`.mix` の中に `.ch` が ホーン / ベース / ドラム / 全体（`.master`）の順。PC 幅は SVG のノブ（`src/knob.ts`）、560px 以下はノブを隠して横の range（縦ドラッグはページのスクロールと取り合うので、スマホでは横にする）。値は常に range が持ち、PC 幅では range を見えなくして（focus・読み上げはできる）、ノブの上下ドラッグ（150px で端から端）が range に値を入れて input / change を出す。ノブは `.ch` の input / change で描き直し、色は var() なのでテーマ切り替えで描き直し不要。`initKnobs()` は main の最後（音量の初期値の後）。音量は 4 本（全体 0–100 % が `out`、ホーン/ベース/ドラム 0–150 % が各 bus）。gain = (位置/100)^2 で、表示 % はつまみ位置（gain ではない）。`setTargetAtTime(…, 0.015)` で動かしたものだけ反映。範囲・既定値は markup の range の `min`/`max`/`value` が正で JS はそこから読む。localStorage `nori-lab-volume`（{all, horn, bass, drums}、range の `change` と数値の `change` で保存。全体 0 は復元せず 100）。パートはコンプの前なので少し影響しあう（ベース 0 で他が約 +2 dB）
- スケジューラ: 25ms 間隔の lookahead（0.15s）。拍ごとに リズム隊（グリッド通り）→ 表拍 bt+delay → 裏拍 bt+delay+hane*T（ゆらぎ分ずらす）
- ゆらぎ（#8）: 既定は表・裏とも 0%（`YURE_DEFAULT`。聴き比べの邪魔をしないため）。ホーンの表拍・裏拍だけを 1 音ごとに正規分布（Box-Muller の `gauss()`）でずらす。リズム隊はグリッドのまま。SD（拍）は 表 = `sdLag`×表のゆらぎ%、裏 = `sdUra`×裏のゆらぎ%（裏は裏拍値のばらつき = 表とは独立に引く）。`sdLag` / `sdUra` は最後に選んだプリセットで決まり、プレイヤーはその行の値、基本・保存したノリ・起動時はソリスト 8 行の平均 `SD_AVG`。スライダーをいじっても変えない。時刻は `swing()` で計算し、裏は前後の表から 0.05 拍以上離す（表を追い越さないほうを優先）。次の拍の表のずれは 1 拍先に引いておく（`zNext`）。ホーンの長さは次の音までの間隔×0.92。0% で従来と同じ。ロード時の `console.assert` で SD と順序を確かめる。ゆらぎのスライダーはプリセットの選択を外さない。canvas は平均の位置のまま
- メロディ生成 `melodyBeat(i)`: 拍頭=次コードのコードトーン、裏拍=スケール経過音 or 半音アプローチ/越えて戻る。音域 58–82
- ベース `bassBeat(i)`: コード頭=ルート、コード末=次ルートへの半音アプローチ、他=コードトーン
- 進行 `PROGS`: blues / rhythm（循環A）/ iivi / one。`[root, quality, beats]` の配列
- 描画: 2拍分の canvas `#cv` にグリッド・表/裏の発音位置・再生ヘッド・現在のコード
- 円の表示 `#dial`（`#cv` の左、560px 以下では上）: 1周=1拍、12時=拍頭、表拍の丸=遅れ値、裏拍の丸=裏拍値。丸ドラッグ=その丸だけ（表拍は裏拍値を保つ）、針ドラッグ=ハネ値を保って両方回る。範囲はスライダーと同じ（遅れ値 -0.15〜0.3、ハネ値 40〜80）。ドラッグはつかんだ位置からの回転量で動く（`dialValue()` とロード時の `console.assert`）。目盛りは拍頭基準で 8分=1/2（点線）・3連=1/3・2/3（`--brass`）、`#m-t8` / `#m-t3`（表示パネルの凡例の下「円の目盛り」）で表示を切り替え（円だけ。2拍表示は変えない）。`drawDial()` は `draw()` の最後で呼ぶ。`near` はベース用の既存名なので円側の補助関数に使わない
- プリセット欄「誰風で吹く？」: コントロールの下。native の `<select id="preset">` 1 個で、先頭が「（自分で調整中）」、optgroup は プレイヤー（`PAPER`）/ 基本（`PRESETS`）/ 保存したノリ。選んだ瞬間に適用。遅れ/ハネのスライダー・数値を動かすと「（自分で調整中）」になる（テンポだけなら選択は残る）。`#pinfo` に `tameTag`（遅れ値: ≤-0.02 前ノリ / <0.04 ジャスト / <0.14 ちょい後ろ / それ以上 かなり後ろ）と `haneTag`（ハネ値%: <54 まっすぐ / <62 軽く跳ねる / <69 3連くらい / それ以上 強く跳ねる）のタグ＋小さい数字＋bpm。`#pdel`（削除）は保存したノリを選んでいるときだけ出る。Space は再生/停止だが、text/number/checkbox の input・select・button・textarea にフォーカスがあるときはブラウザ本来の動作
- 「このアプリについて」（#14）: ページ最下部の `<details class="panel about">`（既定で閉じている）。数値の出典（DOI リンク）、遅れ値の基準（研究=ベース、アプリ=ライド）、ドラムの位置を測っていないこと、再現していないもの（拍ごとの違い・音色・フレーズ。ゆらぎはばらつきの大きさだけ借りている）。プリセット欄の脚注はプリセットの操作の 2 文だけ（選ぶと録音のテンポ・保存はこのブラウザだけ）。出典はこちらにまとめ、Space の案内は再生ボタンの `title` / `aria-keyshortcuts`
- ユーザープリセット（UI 上は「保存したノリ」）: localStorage `nori-lab-presets`（{name, lag, dist, yureD, yureU}。#8 より前の保存には yureD / yureU がなく、そのときと壊れた値は `YURE_DEFAULT`）

## TODO 候補
- 論文（23(1)）表1の中央値は `PAPER` にプリセット化済み（`[奏者, 曲, 録音年, 遅れ値, ハネ値(%), 録音テンポ, 遅れ値 SD, 裏拍値 SD]`、奏者名はカタカナ）。本にしかない型（ナヴァロ型/クール=デイヴィス型など）は未対応 ※数値は本から。推測値を入れない
- 裏拍の遅れを独立パラメータにするか検討（現状は表拍の音からの距離で決まる）
- ゴーストノート、休符/フレーズの息継ぎ
- A/B 比較モード（2つのプリセットを交互に鳴らす）
- 音色改善（サンプル音源 or より管っぽいシンセ）、MIDI 書き出し
