# Power Automate 解析ツール (JavaScript版)

Power Automate (クラウドフロー) と Power Automate Desktop (デスクトップフロー) のソリューションファイルを解析し、アクション一覧の抽出、CSV出力、AI要件定義生成、フローチャート作成ツール連携を行うWebアプリケーション（JavaScript/Node.js版）です。

## 🎯 対応フォーマット

- ✅ **Power Automate (PA)**: クラウドフロー - 自動判定
- ✅ **Power Automate Desktop (PAD)**: デスクトップフロー - 自動判定

## 主要機能

### 基本機能
- **ZIPファイルアップロード**: PADソリューションファイルのアップロード
- **アクション解析**: フロー、サブフロー、アクション情報の自動抽出
- **結果表示**: JSON形式での解析結果表示
- **CSV出力**: 解析結果のCSVファイルダウンロード

### 拡張機能
- **OpenAI連携**: アクションデータから要件定義書の自動生成
- **フローチャート連携**: 別チーム開発のフローチャート作成ツールとのデータ連携
- **緊急時手動実行ガイド**: PA/PADが使えない場合に業務を手作業で行うための詳細マニュアル生成

## 技術スタック

- **Backend**: Node.js, Express.js
- **ファイル処理**: JSZip, xml2js, fs-extra
- **AI**: OpenAI API (GPT-3.5/4)
- **HTTP通信**: Axios
- **その他**: CORS, Multer, UUID, dotenv

## インストール・セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして設定：

```bash
cp .env.example .env
```

必要な環境変数：
```
PORT=5000
OPENAI_API_KEY=your-openai-api-key-here  # OpenAI連携を使用する場合
OPENAI_ENABLED=false
FLOWCHART_API_URL=http://localhost:3001/api  # フローチャート連携を使用する場合
FLOWCHART_ENABLED=false
```

### 3. アプリケーションの起動

```bash
# 本番環境
npm start

# 開発環境（ホットリロード）
npm run dev
```

サーバーが `http://localhost:5000` で起動します。

## API仕様

### エンドポイント一覧

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/` | サービス情報取得 |
| POST | `/upload` | ZIPファイルアップロード・解析 |
| GET | `/api/actions/:sessionId` | アクション一覧API |
| GET | `/api/download/csv/:sessionId` | CSVダウンロード |
| POST | `/api/requirements/:sessionId` | AI要件定義生成 |
| POST | `/api/user-guide/:sessionId` | 緊急時手動実行ガイド生成 |
| POST | `/api/flowchart/:sessionId` | フローチャートツール連携 |
| GET | `/api/flowchart/spec` | フローチャート連携API仕様 |
| GET | `/health` | ヘルスチェック |
| POST | `/api/cleanup` | セッションクリーンアップ |

### 使用例

#### 1. ファイルアップロード
```bash
curl -X POST -F "file=@solution.zip" http://localhost:5000/upload
```

#### 2. 解析結果取得
```bash
curl http://localhost:5000/api/actions/{session_id}
```

#### 3. CSVダウンロード
```bash
curl http://localhost:5000/api/download/csv/{session_id} > actions.csv
```

#### 4. 緊急時手動実行ガイド生成
```bash
curl -X POST http://localhost:5000/api/user-guide/{session_id} \
  -H "Content-Type: application/json" \
  -d '{"solution_name": "MyFlow"}'
```

## プロジェクト構造

```
pad_web_analyzer_js/
├── app.js                    # メインアプリケーション
├── package.json             # パッケージ設定
├── .env.example             # 環境変数テンプレート
├── README.md                # このファイル
├── models/
│   └── padExtractor.js      # PADアクション抽出クラス
├── services/
│   ├── openaiService.js     # OpenAI連携サービス
│   └── flowchartApi.js      # フローチャートツール連携API
├── public/                  # 静的ファイル（将来の拡張用）
└── uploads/                 # アップロードファイル一時保存
```

## 機能詳細

### PADアクション抽出

JavaScript版では以下のライブラリを使用してPythonと同等の機能を実現：

- **ZIPファイル解析**: `jszip`
- **XML解析**: `xml2js`
- **CSV生成**: 独自実装（UTF-8 BOM対応）

### サポートするアクションタイプ

- 外部フロー呼び出し
- 外部コネクタ（クラウドコネクタ）
- Excel操作
- Web操作
- UI操作
- マウス・キーボード操作
- ファイル・フォルダ操作
- 変数・テキスト・日時操作
- 制御フロー（条件分岐、ループ等）

### OpenAI連携

GPT-3.5/4を使用して：
- **要件定義書の自動生成**: アクション情報から技術仕様書を生成
- **フローチャート用説明文の生成**: 視覚的なフロー図の自動作成
- **緊急時手動実行ガイド**: PA/PAD障害時に業務を手作業で実行するための詳細マニュアル生成
  - PA/PADが自動化していた業務内容を分析
  - 人間が手作業で実行する具体的な手順を生成
  - AI解説付きで技術者以外でも理解できる形式

### フローチャート連携

フローチャート作成ツール側で実装が必要なエンドポイント：

```
GET  /api/health                     # 稼働状況確認
POST /api/flowchart/import           # フローチャートデータインポート
GET  /api/flowchart/{id}/url         # フローチャート表示URL取得
```

## 開発・カスタマイズ

### 新しいアクションタイプの追加

`models/padExtractor.js` の `_parseActionLine` メソッドに新しい条件を追加：

```javascript
else if (line.includes('NewAction.')) {
  return this._parseNewAction(line, flowName, subflowName);
}
```

### OpenAI プロンプトのカスタマイズ

`services/openaiService.js` の各生成メソッドでプロンプトを調整可能。

### フローチャート連携のカスタマイズ

`services/flowchartApi.js` でデータフォーマットやAPI仕様を調整可能。

## Python版との比較

| 機能 | Python版 | JavaScript版 | 状況 |
|------|----------|--------------|------|
| ZIPファイル解析 | zipfile | jszip | ✅ 同等 |
| XML解析 | xml.etree.ElementTree | xml2js | ✅ 同等 |
| CSV生成 | csv | 独自実装 | ✅ 同等 |
| Webサーバー | Flask | Express.js | ✅ 同等 |
| OpenAI連携 | openai (Python) | openai (Node.js) | ✅ 同等 |
| ファイルアップロード | Werkzeug | Multer | ✅ 同等 |
| テンプレートエンジン | Jinja2 | なし（API のみ） | ⚠️ 今後対応 |

## トラブルシューティング

### よくある問題

1. **依存関係のインストールエラー**
   ```bash
   npm cache clean --force
   npm install
   ```

2. **ポート衝突**
   - `.env` ファイルでPORTを変更

3. **OpenAI連携が動作しない**
   - API キーが正しく設定されているか確認
   - `OPENAI_ENABLED=true` に設定

4. **大きなファイルのアップロードエラー**
   - Multerの制限設定を確認（現在50MB）

### ログの確認

開発モードでは詳細なエラーログがコンソールに出力されます：

```bash
npm run dev
```

## テスト

```bash
npm test
```

## ライセンス

このプロジェクトは開発・検証用途で作成されています。
商用利用の場合は適切なライセンス確認を行ってください。

## 貢献

バグ報告や機能改善の提案は Issue でお知らせください。