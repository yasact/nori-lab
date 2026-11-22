# ノリ・ラボ（nori-lab）

ジャズの8分音符の「ノリ」を、井上裕章『ジャズの「ノリ」を科学する』の指標で再現して鳴らす Web Audio アプリ。
Vite + TypeScript（framework なし、runtime 依存ゼロ、`strict: true`、外部読み込みは Google Fonts のみ）。

## コマンドと公開
- `npm run dev`: 開発
- `npm run build`: `tsc --noEmit` → `vite build`。テストファイルも型チェックに入る。変更したら通ることを確かめる
- `npm test`: Vitest（`src/*.test.ts`）。ローカルだけで回す（Actions では回さない）
- 公開: GitHub Pages https://yasact.github.io/nori-lab/ （`vite.config.ts` の `base: '/nori-lab/'`）。main への push で `.github/workflows/deploy.yml` が build して `dist/` を deploy する

## 指標（本・論文と同じ定義）
- 遅れ値 = ベースの拍頭に対する表拍8分の遅れ ÷ 1拍の長さ（マイナスで前ノリ）
- ハネ値 = 表拍8分の長さ ÷ 1拍の長さ（= 表拍の音から裏拍の音までの距離）
- 裏拍値 = 遅れ値 + ハネ値（グリッドから見た裏拍の位置。ストレートは 0.5）
- 出典: 井上裕章「スウィングジャズからビバップへの変遷期における8分音符タイミングの変化」日本音楽知覚認知学会誌 23(1) https://doi.org/10.32199/jsmpc.23.1_3
- このアプリの遅れ値はライド（リズム隊のグリッド）基準。ベースの位置 `bassLag` が 0 のときだけ論文のベース基準と一致する

内部状態は `src/state.ts` の `P = { bpm, lag(遅れ値), dist(ハネ値×100), bassLag, yureD / yureU(ゆらぎ %), sdLag / sdUra(100% のときの SD、拍) }`。ms は `P.delay` ゲッターで換算する。遅れ値で持つので、テンポを変えてもノリは保たれる。

## ファイル
import は main → draw → audio → music の一方向。`state` と `logic` はどこからでも読む。

- `index.html`: markup だけ。`src/style.css`: CSS（テーマの CSS 変数もここ）
- `src/state.ts`: `$`（getElementById。既定の型は HTMLInputElement）、`P`、`YURE_DEFAULT`、`SD_AVG`
- `src/logic.ts`: DOM に触らない純粋な計算（円のドラッグ `dialValue`、音量の保存値 `volFrom`、共有 URL `fromQuery` / `toQuery`、タグ `tameTag` / `haneTag`）。テストは `logic.test.ts`
- `src/music.ts`: 進行 `PROGS`・メロディ `melodyBeat`・ベース `bassBeat`。DOM に触らない
- `src/audio.ts`: シンセとスケジューラ、ゆらぎの `swing()`。テストは `audio.test.ts`（swing と音域）
- `src/draw.ts`: 2拍表示 `#cv` と円 `#dial` の描画、再生中の `loop()`
- `src/knob.ts`: 音量の SVG ノブ
- `src/main.ts`: 入口。入力のひも付け・プリセット・共有・円のドラッグ・音量・再生

## 守ること
- 純粋な計算は `src/logic.ts` に置いてテストする。範囲は DOM から読まず引数で受け、DOM から読むのは main.ts
- 音量と共有 URL の範囲・既定値は markup（range / number の `min` / `max` / `value`）が正で、JS はそこから読む
- 音のグラフ: 各声部 → `hornBus` / `bassBus` / `drumBus` → `master`(0.8) → DynamicsCompressor → `out` → destination。新しい声部は必ずどれかの bus につなぐ（`master` に直結しない。`noiseHit` の `dest` は必須）
- `ctx` は最初の再生の `initAudio()` まで undefined。それより前は `if (ctx)` で確かめる。音量の gain は `start()` で `initAudio()` の直後に入れる
- URL のクエリは信用しない: 数でない・空は無視、範囲は数値欄の min / max で clamp、名前は 40 文字まで・表示は textContent だけ、知らないキーは無視
- 再生・停止のアイコンに文字の ▶ ■ を使わない（iOS が絵文字で描く）。CSS の `::before` + `clip-path` で描き、JS は文字（「再生」「停止」）だけ切り替える
- Space は再生/停止。ただし text / number / checkbox の input・select・button・textarea にフォーカスがあるときはブラウザ本来の動作
- `near` はベース用の名前なので、円側の補助関数に使わない
- プリセットの数値は論文・本にあるものだけ。推測値を入れない

## 音とスケジューラ
- シンセ: ホーン = saw + square → LPF、ベース = tri + sine、ライド = 808 式 square 6 本 → HPF → VCA ＋スティック音（右）、ハイハット = ノイズ + BPF（左）
- スケジューラ: 25ms 間隔、lookahead 0.15s。拍ごとに リズム隊（グリッドどおり）→ 表拍 `bt + delay` → 裏拍 `bt + delay + hane*T`
- ベースの位置（#13）: ベースの発音だけ `bt + bassLag*T` にずらす（ホーン・ライド・ハットはグリッドのまま）。プリセットとは独立（選んでも変わらず、保存もせず、選択も外さない）。2拍表示では 0 以外のときだけ上端に印を描く（円には出さない）
- ゆらぎ（#8）: ホーンの表拍・裏拍だけを 1 音ごとに正規分布（`gauss()`）でずらす。既定は 0%（聴き比べの邪魔をしないため）
  - SD（拍）は 表 = `sdLag` × 表%、裏 = `sdUra` × 裏%（裏は表と独立に引く）
  - `sdLag` / `sdUra` は最後に選んだプリセットで決まる。プレイヤーはその行の値、それ以外（基本・保存したノリ・共有・起動時）はソリスト 8 行の平均 `SD_AVG`
  - 裏は前後の表から 0.05 拍以上離す（表を追い越さないほうを優先）。次の拍の表のずれは 1 拍先に引く（`zNext`）。ホーンの長さは次の音までの間隔 × 0.92
  - canvas は平均の位置のまま描く。ゆらぎのスライダーはプリセットの選択を外さない
- メロディ: 拍頭 = 次コードのコードトーン、裏拍 = スケール経過音 or 半音アプローチ / 越えて戻る。音域 58–82
- ベース: コード頭 = ルート、コード末 = 次ルートへの半音アプローチ、他 = コードトーン
- 進行 `PROGS`: blues / rhythm（循環 A）/ iivi / one。`[root, quality, beats]` の配列

## 画面
上から 見出し → 表示パネル（円・2拍表示）→ プリセット欄 → コントロール（再生の行・テンポ〜詳細設定・音量調整）→ このアプリについて → フッター。

- 最初の画面（#23）: キャッチ「自分の好きなノリを探そう」（作者の言葉。正解はなく人それぞれ、の意図）。`.dialcol` の中に 円 → `.dialhint` → `#pinfo`（タグ）→ `.trio`（JATP Blues 1946 のホーキンス・ヤング・パーカー。押すとその奏者を選んだのと同じ `change`。鳴らし始めはしない）。円の大きさは `.scope` の `--dial`（260px）で、`#tapstart` の位置もこれで決まる
- `#tapstart`「タップして聴く」: 初回だけ円の真ん中に出す。`start()` で消して覚える（再生ボタン・Space でも消える）。スマホでは出ているあいだ浮いた `#play` を隠す
- 円 `#dial`: 1 周 = 1 拍、12 時 = 拍頭、表拍の丸 = 遅れ値、裏拍の丸 = 裏拍値
  - 丸ドラッグはその丸だけ（表拍は裏拍値を保つ）、針ドラッグはハネ値を保って両方回る。つかんだ位置からの回転量で動く
  - 範囲はスライダーと同じ（遅れ値 -0.15〜0.3、ハネ値 40〜80）
  - 目盛り 8 分（1/2）・3 連（1/3・2/3）は `#m-t8` / `#m-t3` で切り替え（円だけ。2拍表示は変えない）。`drawDial()` は `draw()` の最後で呼ぶ
- 2拍表示 `#cv`: `<details id="twobeat">` の中（既定で閉じる）。閉じている間は幅 0 なので、`toggle` で描き直す
- プリセット欄「誰風で吹く？」: `<select id="preset">` 1 個。先頭「（自分で調整中）」、optgroup は プレイヤー（`PAPER`）/ 基本（`PRESETS`）/ 保存したノリ。選んだ瞬間に適用
  - 起動時はチャーリー・パーカー — JATP Blues を、選んだときと同じ `change` で適用する（ヤング・ホーキンスと同じ録音・テンポで比べられる）
  - 遅れ / ハネを動かすと「（自分で調整中）」に戻る。テンポだけなら選択は残る
  - `#pinfo` のタグは表示する丸めた値から決める（`tameTag` / `haneTag`）
  - `#pdel`（削除）は保存したノリを選んでいるときだけ出る
- 共有（#21）: `?n=名前&bpm=&lag=&hane=&yd=&yu=&bl=`（`hane` はハネ値 %、`yd` / `yu` / `bl` は 0 なら付けない。SD は入れない）
  - クエリがあれば起動時のパーカーより優先し、`#preset` の先頭に「共有されたノリ: 名前」（value `'s'`）を出して選び、名前を `#pname` に入れる。ゆらぎ・ベース位置は書かれていなければ既定値
  - クエリはアドレスバーに残す（リロードで同じノリ）
  - `#pshare` は `navigator.share` → clipboard → URL を `#pmsg` に表示、の順に試す。名前は 入力欄 → 選んでいるプリセット名 → なし
- 詳細設定 `<details class="adv">`（既定で閉じる）: 表のゆらぎ・裏のゆらぎ・ベースの位置
- 再生の行: `#play` とホーンの吹き方 `#m-acc` / `#m-mono`。コントロールの一番上。560px 以下では `#play` だけ右下に `position:fixed` で浮かせる（スマホでは最初の画面に入らないため）
- 音量調整 `.mix`: コントロールの一番下。ホーン / ベース / ドラム / 全体の 4 本
  - 全体 0–100 % が `out`、パート 0–150 % が各 bus。gain = (位置/100)^2 で、表示 % はつまみ位置
  - 値は常に range が持つ。PC 幅は range を見えなくしてノブ（上下ドラッグ 150px で端から端）が range に値を入れ、560px 以下はノブを隠して横の range を出す（縦ドラッグはスクロールと取り合うため）
  - `initKnobs()` は main の最後（音量の初期値の後）。ノブの色は var() なのでテーマ切り替えで描き直さない
  - 「消音」ボタンの中身は checkbox `#m-horn` / `#m-bass` / `#m-ride` / `#m-hh`（checked = 鳴らす）
  - パートはコンプの前なので少し影響しあう（ベース 0 で他が約 +2 dB）
- このアプリについて（#14）: ページ最下部の `<details class="panel about">`。数値の出典（DOI）、円で考えるやり方の出典（宇田大志さんの動画 https://youtu.be/udollUSeICM?t=61 ）、遅れ値の基準のちがい、ドラムの位置、再現していないもの、の 3 段落。出典はここにまとめ、プリセット欄の脚注は操作の 2 文だけ
- フッター `.foot`: 作者名 yasact と Web・Instagram・GitHub のアイコンリンク（inline SVG）。新しいタブで開く（再生を止めない）

## localStorage
どれも try / catch で囲み、なくても動くようにする。

| key | 中身 |
| --- | --- |
| `nori-lab-presets` | 保存したノリ `[{name, lag, dist, yureD, yureU}]`。#8 より前の保存には yureD / yureU がなく、そのときと壊れた値は `YURE_DEFAULT` |
| `nori-lab-volume` | `{all, horn, bass, drums}`。range と数値の `change` で保存。全体 0 は復元せず既定値 |
| `nori-lab-seen` | `#tapstart` を出したか |
