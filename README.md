# Projects site

静的サイト。ビルドツールなし、依存パッケージなし。`index.html` を開けばそのまま動きます。

- 公開サイト: https://lingmulongtai.github.io/my-github-portfolio/
- リポジトリ: https://github.com/lingmulongtai/my-github-portfolio

```
.
├── index.html                      サイト本体（触らなくていい）
├── projects.json                   ★ 内容の編集はここだけ
├── data/github.json                公開時に自動生成（Git 管理外）
├── scripts/sync-github.mjs         取得スクリプト
└── .github/workflows/sync-github.yml  GitHub データ取得と Pages 公開
```

## 1. まず書き換えるところ

`projects.json` の `profile` を自分の値に。

| キー | 中身 |
|---|---|
| `github` | GitHub のユーザー名。Pages の URL 推定にも使う |
| `links.github` / `links.linkedin` / `links.x` / `links.mail` | ヘッダーとフッターのリンク |
| `hero` | 大見出し。2行の配列。英大文字が一番きれいに出る |
| `location` / `role` / `intro` / `quote` / `about` | `{ "ja": "…", "en": "…" }` の形。英語を空にすると日本語が出る |

プロジェクトは `projects` 配列に並べた順どおりに表示されます。

| キー | 中身 |
|---|---|
| `slug` | URL に出る識別子。`#aerogrid-3d` のように個別リンクになる |
| `repo` | `owner/name`。**これが GitHub API との紐付けキー** |
| `size` | タイルの大きさ。`hero` / `tall` / `wide` / `std` |
| `filter` | 絞り込みボタンの分類。好きな値を足すとボタンも自動で増える |
| `tag` / `status` / `summary` / `desc` | すべて `{ ja, en }` |
| `stack` | 技術タグ。言語自動判定とは別に、自分で見せたいものを書く |
| `links.docs` | 仕様書などの任意リンク。空なら出ない |

star 数・言語・ライセンス・最終更新・コミットグラフ・**サイトのリンク**は書きません。GitHub から自動で入ります。

## 2. サイトのリンクについて

各リポジトリの **About → Website** 欄に URL を入れておくと、タイルの `SITE ↗` と詳細画面の「サイトを開く」ボタンが自動で出ます。
空でも GitHub Pages が有効なら `https://<user>.github.io/<repo>/` を推定して出します。
手で指定したいときだけ `projects.json` の `links.site` に書けば、そちらが優先されます。

## 3. デプロイ

1. 上のディレクトリ構成でファイルを配置して `main` に push
2. Settings → Pages → Source を **GitHub Actions** に設定
3. Actions タブで `Sync GitHub data and deploy Pages` を手動実行

以降は毎日 3:00 JST にデータ取得と公開が実行されます（開始時刻は GitHub 側で遅延する場合があります）。`index.html`、`projects.json`、取得スクリプト、ワークフローを編集して `main` に push したときも実行されます。

`data/github.json` は実行時に生成し、サイト本体と一緒に Pages へ公開します。自動更新でリポジトリへコミットする必要はありません。公開対象は `index.html`、`projects.json`、`data/github.json` の3ファイルです。

取得には標準の `GITHUB_TOKEN` を使うため、追加のシークレット設定は不要です。非公開・未作成のリポジトリは取得対象から除外し、1件も取得できない場合は公開を中止します。

ローカルで同じデータを取得する場合は `node scripts/sync-github.mjs` を実行してください。構文確認は `node --check scripts/sync-github.mjs`、表示確認は `python -m http.server 4173 --bind 127.0.0.1` で行えます。

## 4. データの読み込み順

1. `data/github.json`（Actions が作ったもの）
2. なければブラウザから GitHub API を直接叩く（未認証・60回/時）
3. どちらも駄目なら**デモ用の仮データ**を表示し、画面に `DEMO DATA` と出る

実データを取得できた場合、未取得のリポジトリ・コミット集計には仮データを混ぜず、指標を `—` と表示します。詳細のイベント欄も取得済みの最終更新だけを表示します。

つまり `index.html` を単体でローカルで開いても、見た目の確認はできます。
`file://` で開くと `projects.json` の読み込みが CORS で弾かれるので、`index.html` 内の
`<script type="application/json" id="site-data">` に入っている予備データが使われます。
確認用にローカルサーバを立てるなら `python3 -m http.server` で十分です。

> サンドボックス化されたプレビュー環境（Claude の成果物ページなど）では外部 API への通信が
> ブロックされるため、常に `DEMO DATA` になります。自分のドメインに置けば実データになります。

## 5. 操作

- `⌘K` / `Ctrl+K` … 検索（技術名でも引っかかる）
- 詳細を開いた状態で `←` `→` … 前後のプロジェクト
- `Esc` … 閉じる
- 右上の `JA / EN` … 言語切り替え。選択は次回も保持される

## 6. AI に編集させるとき

`projects.json` だけ渡して「このプロジェクトを追加して」「説明を書き直して」と言えば済みます。
守ってほしいのは次の3点だけ:

- `slug` は重複させない（URL になる）
- `tag` / `status` / `summary` / `desc` は必ず `ja` と `en` の両方を書く
- `repo` は実在する `owner/name` にする（間違っていると数値が出ない）
