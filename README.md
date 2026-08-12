# Weaving Matrix - 行列織物シミュレーター 引継書

このドキュメントは、開発の途中引き継ぎのために作成された技術ドキュメントです。新しく開発に参加する方は、まずこのファイルを読めば現状を把握できるようにまとめています。

作成日: 2026-08-13

---

## 1. プロジェクト概要

「Weaving Matrix」は、行列演算を使って織物パターンを生成する**展示会向けの体験型Webアプリ**です。来場者(主に子供を想定)が0/1のマス目(行列B)をタップして自分だけの織物パターンを作り、その場で

- 見た目のプレビュー(キャンバスアニメーション)
- 「じょうぶさ」「あつさ/すけかた」「うつくしさ」といったやさしい日本語の評価カード
- 5軸のレーダーチャート評価

を確認できます。作品はGoogleスプレッドシート/Google Driveに保存でき、QRコード付きのA5サイズ印刷カードとして出力することもできます。管理者用ダッシュボード(`admin.html`)から保存済み作品の一覧・統計を確認できます。

キオスク端末(タブレット等)での展示利用を想定しています。

### 基本フロー

```
来場者がBのマス目をタップ
   ↓
サイズ(2〜5)・パターン(repeat/mirror/mountain)を選択
   ↓
WeaveEngine が W = Aᵀ・B・C を計算し 120×120 の織り柄を生成
   ↓
CanvasRenderer がアニメーション描画
   ↓
EngineeringEvaluator が構造解説カードを生成(浮き・密度・周期)
RadarEvaluator が5軸スコアを算出 → RadarChartUI が描画
   ↓
「保存」→ ApiService経由でGASにPOST → スプレッドシート追加+画像アップロード
「印刷」→ PrintManager がQRコード付きA5カードを生成し window.print()
```

---

## 2. ディレクトリ構成

```
textile-math-exhibition/
├── index.html              # 来場者向けメイン画面
├── admin.html               # 管理者用ダッシュボード
├── .gitattributes           # 改行コード正規化設定(既存)
├── .gitignore                # 除外設定(下記「注意事項」参照)
├── css/
│   ├── layout.css            # 全体レイアウト
│   ├── components.css        # UI部品(ボタン・カード等)
│   ├── animations.css        # アニメーション
│   └── style.css             # その他スタイル
├── js/
│   ├── app.js                 # エントリーポイント(ES Modules)
│   ├── core/                  # ロジック層(DOM非依存)
│   │   ├── WeaveEngine.js         # 行列演算・織り生成・浮き/密度/周期検出
│   │   ├── EngineeringEvaluator.js # 構造解説カードの文言生成
│   │   ├── RadarEvaluator.js       # 5軸レーダースコア算出
│   │   └── MathAnalyzer.js         # ★未使用(後述)
│   ├── components/             # UI部品(DOM操作)
│   │   ├── MatrixInputUI.js        # 行列入力UI(タップ・ランダム・リセット)
│   │   ├── CanvasRenderer.js       # キャンバス描画・アニメーション
│   │   ├── RadarChartUI.js         # レーダーチャートSVG描画
│   │   ├── PrintManager.js         # 印刷カード生成
│   │   ├── AdminUI.js              # 管理画面のロジック(admin.htmlから使用)
│   │   ├── EvaluationUI.js         # ★未使用(後述)
│   │   ├── GalleryUI.js            # ★未使用(後述)
│   │   └── NumpadUI.js             # ★未使用(後述)
│   ├── services/
│   │   └── ApiService.js       # GAS Web AppへのAPI通信(保存・取得)
│   └── utils/
│       ├── helpers.js
│       └── qrcode.min.js       # QRコード生成(サードパーティ製、minify済み)
└── gas/                         # Google Apps Script側のソース(手動同期・後述)
    ├── Code.gs                    # doGet / doPost エントリーポイント
    ├── Config.gs                  # 設定値(シート名・DriveフォルダID)
    └── SpreadsheetHelper.gs       # スプレッドシート/Drive操作の実装
```

> `MathAnalyzer.js` / `EvaluationUI.js` / `GalleryUI.js` / `NumpadUI.js` はどこからも `import` されていない未使用ファイルです。詳細は「9. 今後の改善点」を参照してください。

---

## 3. 使用技術

- **フロントエンド**: Vanilla JavaScript(ES Modules、`type="module"`で読み込み)、HTML5、CSS3。**ビルドツール・npmパッケージは一切使用していません。** バンドラー(webpack/vite等)もありません。
- **描画**: HTML5 Canvas(織り柄アニメーション)、インラインSVG(レーダーチャート)
- **QRコード**: `js/utils/qrcode.min.js`(サードパーティのminifyライブラリ)。生成に失敗した場合はGoogle Chart APIをフォールバックとして使用(`PrintManager.js`)
- **バックエンド**: Google Apps Script(GAS)。サーバーは持たず、GASのWeb App機能をAPIエンドポイントとして利用
- **データ保存**: Googleスプレッドシート(作品データ)+ Google Drive(生成画像)
- **ホスティング**: GitHub Pages(静的サイトとしてそのまま公開。ビルドステップなし)

ES Modules を使用しているため、**ローカルでの動作確認は `file://` で直接HTMLを開くだけでは動作しません**(CORSでモジュール読み込みがブロックされます)。簡易HTTPサーバー(例: `npx serve` や VSCodeの Live Server拡張)経由で開いてください。

---

## 4. Google Apps Script(GAS)との構成

### 4.1 全体構成

GASスクリプトは**特定のGoogleスプレッドシートに紐づけられた「コンテナバインドスクリプト」**として動作する設計です(`SpreadsheetApp.getActiveSpreadsheet()`を使用しており、スプレッドシートIDを指定するコードはありません)。つまり、GAS単体では動かず、**対象のスプレッドシートを開き、そこから「拡張機能 → Apps Script」で開くスクリプトエディタにコードを配置する必要があります。**

### 4.2 各ファイルの役割

- **`gas/Config.gs`**: 設定値。
  - `SHEET_NAME_WORKS: 'Works'` — 作品データを書き込むシート名。**このシートに以下10列のヘッダー行を手動で用意しておく必要があります**(コード側では自動作成しません):
    `ID / 日時 / サイズ / Bの行列 / Aプリセット / Cプリセット / 浮きの有無 / 密度 / 周期 / 画像URL`
  - `IMAGE_FOLDER_ID: '1R0Qp9lyLIbYZD9uw7MYxlzd3uXRGvnGl'` — 生成画像のアップロード先Google DriveフォルダID(実在する値が設定済み)。
- **`gas/Code.gs`**: `doGet(e)` / `doPost(e)` のエントリーポイント。
  - `doPost`: 作品保存(画像アップロード+シート行追加)
  - `doGet`: `?action=getWorks` で保存済み作品一覧を返す(admin.html用)
- **`gas/SpreadsheetHelper.gs`**: 実際のスプレッドシート/Drive操作。`saveNewWork()`、`getWorksData()`など。

### 4.3 フロントエンドとの接続

GASを「Web Appとしてデプロイ」した際に発行される `/exec` URLが、以下**3ファイルに同じ値がハードコードされています**(共通設定ファイルはありません):

```
js/services/ApiService.js  (8行目)
js/components/AdminUI.js
js/components/GalleryUI.js  (未使用ファイルだが同じ値を持つ)
```

現在の値:
```
https://script.google.com/macros/s/AKfycbwhkd7K4gqFzsDHDR-SQB_siIsoQp20mNhwKFSbSQMOoQ2J777ql1EW5K2tK6WqDYvFSw/exec
```

**GAS側を「新しいデプロイ」として再デプロイするとURLが変わるため、その場合は上記2ファイル(実際に使われているもの)を手動で更新してください。**(「デプロイを管理」→既存のデプロイを編集、であればURLは変わりません。)

### 4.4 GAS側のコード反映方法

このリポジトリには`.clasp.json`等の自動デプロイ設定はありません。**`gas/*.gs`の変更は、Googleスプレッドシートに紐づいたApps Scriptエディタへ手動でコピー&ペーストして反映する運用**になっています。`clasp`(Google公式CLI)を導入すればコマンドラインからのpushも可能ですが、現状は未導入です。

---

## 5. GitHub Pages公開方法

### 5.1 現在の公開状態

- 公開リポジトリ: **`https://github.com/noko-museum/textile-math-exhibition`**(Public)
- 公開URL: **`https://noko-museum.github.io/textile-math-exhibition/`**
- 管理画面URL: `https://noko-museum.github.io/textile-math-exhibition/admin.html`
- 2026-08-13時点で公開済み・正常表示を確認済み(HTTP 200、文字化けなし)

### 5.2 仕組み

このリポジトリには独自のGitHub Actionsワークフロー(`.github/workflows/*.yml`)は**含まれていません**。**`main`ブランチへpushすると、GitHub Pagesが自動で更新されます**(ビルド不要、静的ファイルそのまま配信)。詳細な公開方式(ブランチからの直接デプロイか、Actions経由かなど)は、GitHubリポジトリの **Settings → Pages** で確認できます。

---

### 5.3 注意: もう一つの別リポジトリについて

過去の開発では `noko-museum/textile-math`(非公開リポジトリ)というリポジトリも使われており、そちらには独自の`deploy-pages.yml`(GitHub Actions経由のPages公開)が存在します。**今回の一本化作業により、公開は`textile-math-exhibition`側に統一されました。`textile-math`は今後使用しません。**(経緯・理由は「10. 注意事項」参照)

---

## 6. デプロイ手順

通常の変更を公開するまでの手順は以下の通りです。

1. ローカルでコードを修正する(`C:\Users\tfton\textile-math-exhibition\` 直下のファイルを直接編集)
2. 動作確認(簡易HTTPサーバー経由でブラウザ確認。ES Modules使用のため`file://`直接オープンは不可)
3. 変更をコミット
   ```bash
   git add <変更したファイル>
   git commit -m "変更内容の説明"
   ```
4. GitHubへpush
   ```bash
   git push origin main
   ```
5. push後、GitHubが自動的にPagesの再公開処理を実行します。数十秒〜数分後に `https://noko-museum.github.io/textile-math-exhibition/` に反映されます。
6. GitHubリポジトリの **Actions** タブで、ビルドが `success` になっていることを確認するのが確実です。

GAS側(`gas/*.gs`)を変更した場合は、上記に加えて**Apps Scriptエディタ側にも手動でコードを反映**してください(4.4節参照)。

---

## 7. 開発環境

- OS: Windows
- エディタ: Visual Studio Code(実ファイルはすべて `C:\Users\tfton\textile-math-exhibition\` 直下で編集)
- Git: Git for Windows(Git Bash) / PowerShell
- Git認証: Git Credential Manager(`credential.helper=manager`、Windows資格情報マネージャー経由でGitHubの認証情報がキャッシュされている状態)
- パッケージマネージャ・ビルドツール: **なし**(npm/yarn等は未導入・不要)
- ローカル確認用の簡易サーバーが必要(ES Modules使用のため。例: `npx serve .` や VSCode Live Server拡張)

---

## 8. 今回修正した内容(2026-08-13の作業)

前担当(OpenAI Codex)が利用上限で作業を中断した状態から、以下を実施しました。

### 8.1 発見した問題

1. **トップディレクトリの`.git`が空(壊れている)状態だった。** コミット履歴が一切なく、実ファイル群がgit管理外の「裸のファイル」として存在していた。
2. プロジェクト内に**2つの独立したgitクローンがネストして存在**していた:
   - `textile-math/`(非公開リポジトリ `noko-museum/textile-math` のクローン。ローカルは7コミット遅れ、かつリモート上の4ファイルが破損)
   - `textile-math-exhibition/`(公開リポジトリ `noko-museum/textile-math-exhibition` のクローン。ほぼ空)
3. `noko-museum/textile-math`(非公開)のリモート上の以下4ファイルが**文字コード破損**していた(pushの過程で事故が起きたと推測):
   - `js/app.js` / `css/layout.css` / `js/components/MatrixInputUI.js` / `js/components/RadarChartUI.js`
   - トップディレクトリにあった裸のファイルは正常な内容だった(`MatrixInputUI.js`は破損版より機能も多かった)。

### 8.2 実施した対応

1. トップディレクトリの内容をまるごとバックアップ(`C:\Users\tfton\_backup_textile-math-exhibition_20260813\`)。
2. トップディレクトリで `git init -b main` → `git remote add origin https://github.com/noko-museum/textile-math-exhibition.git` → `git fetch` → `git checkout -b main origin/main` を実施し、公開リポジトリと正しく接続。
3. `.gitignore` を新規作成し、`/textile-math/`・`/textile-math-exhibition/`(ネストしたクローン)・`.claude/`・`.agents/` を除外対象に設定(誤って埋め込みリポジトリとしてaddされるのを防止)。
4. 正常なアプリケーションファイル一式(`admin.html` / `index.html` / `css/` / `js/` / `gas/` / `.gitignore`)をコミット(`Initial import of Weaving Matrix exhibition application`)し、`textile-math-exhibition`へpush。
5. GitHub Pagesのビルド・公開成功、および文字化けが再発していないことを確認済み。

### 8.3 意図的にまだ行っていないこと

- `noko-museum/textile-math`(非公開・破損版が残っているリポジトリ)側の修正・削除は**未実施**です。今後このリポジトリをどう扱うか(削除/アーカイブ/放置)は要決定です。
- ローカルの`textile-math/`・`textile-math-exhibition/`(ネストしたクローンフォルダ)自体の削除も**未実施**です。`.gitignore`でgit管理からは除外していますが、ディスク上にはまだ残っています。

---

## 9. 今後の改善点

- **未使用ファイルの整理**: `js/core/MathAnalyzer.js` / `js/components/EvaluationUI.js` / `js/components/GalleryUI.js` / `js/components/NumpadUI.js` はどこからも呼ばれていない旧実装の残骸です。使う予定がなければ削除、使うなら結線してください。`index.html`内の `#printArea`(107行目付近)も同様に未使用のマークアップです。
- **管理画面の集計バグ**: `AdminUI.js`(および未使用の`GalleryUI.js`)は保存データに`score`・`patternName`・`colorTheme`フィールドがある前提で表示していますが、`gas/SpreadsheetHelper.gs`の`getWorksData()`はこれらを返していません。そのため管理画面の「平均スコア」は常に0、「模様/カラー」列は常に「-」になります。スプレッドシート側に列を追加してGAS側で返すようにするか、表示項目自体を削除するか方針を決めて修正してください。
- **死んだプレースホルダーチェック**: `AdminUI.js`・`GalleryUI.js`内の `if (GAS_ENDPOINT === 'YOUR_GAS_WEB_APP_URL')` は既にURLが実値で埋まっているため絶対に発火しません。GAS_ENDPOINTが将来無効になった際のエラーメッセージをもっと分かりやすくすることを検討してください。
- **古いコメントの修正**: `CanvasRenderer.js`・`RadarEvaluator.js`に「16×16固定」という記述が残っていますが、実際は120×120(`WeaveEngine.js`の`OUTPUT_SIZE = 120`)です。
- **`FLOAT_THRESHOLD`の妥当性検討**: `WeaveEngine.js`の`FLOAT_THRESHOLD = 4`について、前担当者自身が「120マス化後の妥当性は要検討」とコメントを残しています。
- **GAS_ENDPOINTの一元管理**: 現状3ファイルに同じURLがハードコードされています。将来的には設定用の共通モジュール(例: `js/config.js`)に一本化すると保守性が上がります。
- **`noko-museum/textile-math`リポジトリの扱い決定**: 破損ファイルが残ったままの非公開リポジトリをどうするか(アーカイブ/削除/放置)を決めてください。

---

## 10. 注意事項

- **`textile-math-exhibition/`・`textile-math/`というネストしたフォルダがローカルに残っています。** これらは過去の作業で作られた別々のgitクローンの残骸で、`.gitignore`によりGit管理からは除外済みですが、実体のフォルダはまだディスク上に存在します。混乱を避けるため、内容を再確認した上で削除を検討してください(削除する場合は必ず事前確認・バックアップを取ってから行うこと)。
- **`noko-museum/textile-math`は非公開リポジトリとして現存しており、破損した4ファイルがpushされたままです。** このリポジトリのURLをうっかり参照・クローンしないよう注意してください。今後の正としては必ず`textile-math-exhibition`を使用してください。
- **GAS Web AppのURLは3ファイルに重複ハードコードされています**(4.3節)。GAS側を再デプロイしてURLが変わった場合は、必ず`ApiService.js`と`AdminUI.js`の両方を更新してください(更新漏れがあると保存/管理画面のどちらかだけ動かなくなります)。
- **スプレッドシート側のヘッダー行は手動管理です。** コード側に自動作成処理は無いため、スプレッドシートの「Works」シートを新規作成する場合は、4.2節に記載した10列のヘッダーを手動で用意してください。
- **ES Modulesを使用しているため、`file://`で直接HTMLファイルを開いても動作しません。** 必ずローカルの簡易HTTPサーバー経由で確認してください。
- **`.claude/`・`.agents/`フォルダは`.gitignore`で除外されています。** これらはAIコーディングツールのローカル設定であり、アプリケーションの動作には無関係です。誤って`git add -f`等で追加しないよう注意してください。
