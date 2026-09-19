# Projects site

静的サイト。ビルドツールなし、依存パッケージなし。`index.html` を開けばそのまま動きます。

`lingmulongtai` が所有する**全公開リポジトリ**を掲載します。フォーク・プロフィール・学習用リポジトリも含み、現在は26件です。非公開リポジトリは取得・追加しません。

- 公開サイト: https://lingmulongtai.github.io/my-github-portfolio/
- リポジトリ: https://github.com/lingmulongtai/my-github-portfolio

```
.
├── index.html                      サイト本体（触らなくていい）
├── projects.json                   プロフィールと日英の紹介文
├── assets/projects/                各プロジェクトの生成背景画像とプロンプト
├── data/github.json                公開時に自動生成（Git 管理外）
├── scripts/sync-github.mjs          全公開リポジトリの取得スクリプト
├── tests/                          カタログ・読み込み処理の回帰テスト
└── .github/workflows/               PR 検証と GitHub Pages 公開
```

## 1. まず書き換えるところ

`projects.json` の `profile` を自分の値に。

| キー | 中身 |
|---|---|
| `github` | GitHub のユーザー名。Pages の URL 推定にも使う |
| `links.github` / `links.linkedin` / `links.x` / `links.mail` | ヘッダーとフッターのリンク |
| `hero` | 大見出し。2行の配列。英大文字が一番きれいに出る |
| `location` / `role` / `intro` / `quote` / `about` | `{ "ja": "…", "en": "…" }` の形。英語を空にすると日本語が出る |

プロジェクト一覧は毎回 GitHub API から全ページを取得します。新しい公開リポジトリは、`projects.json` に書かなくても次の同期で追加されます。紹介文が未設定の場合は GitHub の説明・言語を使用します。

`projects.json` の `projects` 配列は、日英の紹介文・分類・表示順の上書き設定です。ここにある公開プロジェクトを配列順で並べ、未設定の新規プロジェクトを更新順で末尾に追加します。削除済み・非公開のリポジトリは同期結果に含めません。

| キー | 中身 |
|---|---|
| `slug` | リポジトリ名を小文字にした識別子。`#aerogrid-3d` のように個別リンクになる |
| `repo` | `owner/name`。**これが GitHub API との紐付けキー** |
| `size` | タイルの大きさ。`hero` / `tall` / `wide` / `std` |
| `filter` | `web` / `desktop` / `mobile` / `tools` / `hardware` / `research` / `docs` / `other` |
| `tag` / `summary` / `desc` | すべて `{ ja, en }`。確認できる用途・実装を記載する |
| `stack` | 技術タグ。言語自動判定とは別に、自分で見せたいものを書く |
| `image` | `assets/projects/<slug>.webp`。未指定の新規プロジェクトは単色背景 |
| `links.docs` | 仕様書などの任意リンク。空なら出ない |

star 数・言語・ライセンス・最終更新・コミットグラフ・**サイトのリンク**は GitHub から自動で取得します。ステータスも「公開」「フォーク」「アーカイブ」を実際の設定から表示し、進捗率や完成度は推定しません。集計はフォークを含むリポジトリ単位の値です。

## 2. サイトのリンクについて

各リポジトリの **About → Website** 欄に URL を入れておくと、タイルの `SITE ↗` と詳細画面の「サイトを開く」ボタンが自動で出ます。
空でも GitHub Pages が有効なら `https://<user>.github.io/<repo>/` を推定して出します。
手で指定したいときだけ `projects.json` の `links.site` に書けば、そちらが優先されます。

## 3. デプロイ

1. 上のディレクトリ構成でファイルを配置して `main` に push
2. Settings → Pages → Source を **GitHub Actions** に設定
3. Actions タブで `Sync GitHub data and deploy Pages` を手動実行

以降は毎日 3:00 JST にデータ取得と公開が実行されます（開始時刻は GitHub 側で遅延する場合があります）。`index.html`、`projects.json`、`assets/`、取得スクリプト、ワークフローを編集して `main` に push したときも実行されます。

`data/github.json` は実行時に生成し、サイト本体と一緒に Pages へ公開します。自動更新でリポジトリへコミットする必要はありません。公開対象は `index.html`、`projects.json`、`data/github.json` と `assets/` です。

取得には標準の `GITHUB_TOKEN` を使うため、追加のシークレット設定は不要です。公開一覧を最後まで取得できない場合や0件の場合は公開を中止します。コミット集計が処理中・取得不能でも、そのプロジェクト自体は掲載します。

ローカルで同じデータを取得する場合は `node scripts/sync-github.mjs` を実行してください。API の利用制限を避けたい場合は、環境変数 `GH_TOKEN` に認証情報を渡せます。トークンをファイルやコミットに含めないでください。

検証は `node --test tests/*.test.mjs`、表示確認は `python -m http.server 4173 --bind 127.0.0.1` で行えます。PR と公開前にも同じテストを実行します。

## 4. データの読み込み順

1. `data/github.json`（Actions が作った `owner` / `syncedAt` / `projects` / `stats` を含むスナップショット）
2. なければブラウザから GitHub API で全公開リポジトリを取得（年間コミット集計は取得しない）
3. どちらも駄目なら `projects.json` の紹介文を表示し、統計は `—` とする

デモ用の数値は使用しません。詳細のイベント欄も取得済みの最終更新だけを表示します。

つまり `index.html` を単体でローカルで開いても、見た目の確認はできます。
`file://` で開くと `projects.json` の読み込みが CORS で弾かれるので、`index.html` 内の
`<script type="application/json" id="site-data">` に入っている予備データが使われます。
確認用にローカルサーバを立てるなら `python3 -m http.server` で十分です。

外部通信がブロックされた環境では「GitHub データ未取得」と表示します。

## カードの画像

公開26件の背景は、各プロジェクトの用途をもとにChatGPTの内蔵画像生成で個別に作ったコンセプト画像です。実際の画面や製品の写真ではありません。共通の画風と各画像の生成プロンプトは `assets/projects/prompts.json` に保存しています。

配信用画像は幅1280pxのWebPに最適化し、遅延読み込みを使用しています。タイトルの背景には暗いグラデーションを重ねています。新規リポジトリの画像生成は自動同期に含まれません。画像を追加するときは `image` と予備の `site-data` を更新してください。

## 5. 操作

- `⌘K` / `Ctrl+K` … 検索（技術名でも引っかかる）
- 詳細を開いた状態で `←` `→` … 前後のプロジェクト
- `Esc` … 閉じる
- 右上の `JA / EN` … 言語切り替え。選択は次回も保持される

## 6. AI に編集させるとき

`projects.json` だけ渡して「このプロジェクトを追加して」「説明を書き直して」と言えば済みます。
守ってほしいのは次の3点だけ:

- `slug` は重複させない（URL になる）
- `tag` / `summary` / `desc` は必ず `ja` と `en` の両方を書く
- `repo` は実在する `owner/name` にする（間違っていると数値が出ない）

README・実装で確認した内容を使い、フォークを独自開発と書いたり、未検証の機能を完成済みと書いたりしないでください。紹介文を編集した場合は `index.html` 内の `site-data` にも同じ JSON を反映すると、単体プレビューも一致します。
