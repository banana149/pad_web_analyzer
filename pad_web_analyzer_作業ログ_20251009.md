# Power Automate 解析ツール 作業ログ
**日付**: 2025年10月9日
**プロジェクト**: pad_web_analyzer_js (JavaScript/Node.js版)

---

## 📋 作業概要

Power Automate (PA/クラウドフロー) と Power Automate Desktop (PAD/デスクトップフロー) の両方に対応した統合解析ツールの開発・改修を実施。

---

## 🎯 完了した作業

### 1. PA (Power Automate クラウドフロー) 対応 ✅

#### 1-1. PA/PAD自動判定機能の実装
**ファイル**: `models/powerAutomateAnalyzer.js`

**実装内容**:
- ZIP内のフォルダ構造で判定
- `desktopflowbinaries` フォルダの有無をチェック
  - 存在する → PAD
  - 存在しない → PA

**変更箇所**:
```javascript
// _detectSolutionType メソッド (Line 51-82)
async _detectSolutionType(zip) {
  // ZIP内の全ファイル・フォルダパスを取得
  const allPaths = [];
  zip.forEach((relativePath, file) => {
    allPaths.push(relativePath);
  });

  // desktopflowbinaries フォルダが存在するかチェック
  const hasDesktopFlowBinaries = allPaths.some(path =>
    path.toLowerCase().includes('desktopflowbinaries')
  );

  return hasDesktopFlowBinaries ? 'PAD' : 'PA';
}
```

#### 1-2. PA解析ロジックの実装
**ファイル**: `models/powerAutomateAnalyzer.js`

**実装内容**:
- Workflows フォルダ内のJSONファイルを直接読み込み
- 複数のJSON構造パターンに対応
  - `flowDef.properties.definition`
  - `flowDef` 自体
  - `flowDef.definition`

**変更箇所**:
```javascript
// _analyzeCloudFlow メソッド (Line 87-139)
async _analyzeCloudFlow(zip) {
  // workflowsフォルダ内のJSONファイルを探す
  const workflowFiles = [];
  zip.forEach((relativePath, file) => {
    const lowerPath = relativePath.toLowerCase();
    if (lowerPath.includes('workflows/') && lowerPath.endsWith('.json')) {
      workflowFiles.push({ path: relativePath, file: file });
    }
  });

  // 各JSONファイルをパース
  for (const { path, file } of workflowFiles) {
    const jsonContent = await file.async('text');
    const flowDef = JSON.parse(jsonContent);
    const flowActions = this._parseCloudFlowDefinition(flowName, flowDef);
    actions.push(...flowActions);
  }
}
```

#### 1-3. アクション実行順序のソート機能
**ファイル**: `models/powerAutomateAnalyzer.js`

**実装内容**:
- `runAfter` プロパティに基づいてトポロジカルソート
- 依存関係を解析して正しい実行順序で抽出

**変更箇所**:
```javascript
// _sortActionsByRunAfter メソッド (Line 298-345)
_sortActionsByRunAfter(actionsObj) {
  // 依存関係グラフを構築
  const graph = {};
  for (const [name, action] of actionEntries) {
    graph[name] = {
      action: action,
      dependencies: action.runAfter ? Object.keys(action.runAfter) : []
    };
  }

  // トポロジカルソート（DFS）
  // runAfterがないアクション（最初のアクション）から開始
  // 依存先を先に処理してから自身を追加
}
```

#### 1-4. 条件式の抽出機能
**ファイル**: `models/powerAutomateAnalyzer.js`

**実装内容**:
- If条件分岐の `expression` プロパティから条件式を抽出
- Switch文の `expression` プロパティから条件式を抽出
- アクション内容に条件式を含めて表示

**変更箇所**:
```javascript
// _extractConditionExpression メソッド (Line 347-355)
_extractConditionExpression(action) {
  if (action.expression) {
    return JSON.stringify(action.expression, null, 2);
  }
  return '';
}

// _formatActionContent メソッド (Line 440-496)
_formatActionContent(action) {
  const content = [];

  // 条件式（If、Switch）
  if (action.expression) {
    content.push(`\n【条件式】`);
    content.push(JSON.stringify(action.expression, null, 2));
  }

  // 入力パラメータ
  // 分岐ケース
  // 実行順序（runAfter）
  // 繰り返し対象（foreach）
}
```

---

### 2. PAD (Power Automate Desktop) 複数フロー対応 ✅

#### 2-1. 複数Workflowの検出と処理
**ファイル**: `models/padExtractor.js`

**実装内容**:
- customizations.xml内の複数Workflowを全て処理
- 各Workflowごとにアクションを抽出
- デバッグログで各Workflowの処理状況を出力

**変更箇所**:
```javascript
// _parseCustomizationsXml メソッド (Line 63-137)
async _parseCustomizationsXml(xmlContent) {
  const workflowArray = Array.isArray(workflows.Workflow)
    ? workflows.Workflow
    : [workflows.Workflow];

  console.log(`Total Workflow entries in XML: ${workflowArray.length}`);

  for (let i = 0; i < workflowArray.length; i++) {
    const workflow = workflowArray[i];
    const flowName = workflow.Name || '';
    const definition = workflow.Definition || '';

    console.log(`=== Workflow ${i + 1}/${workflowArray.length} ===`);
    console.log(`Name: ${flowName}`);
    console.log(`Definition length: ${definition.length}`);

    flows.push({
      name: flowName,
      definition: definition,
      connections: connections
    });
  }
}
```

#### 2-2. サブフロー（FUNCTION）の検出改善
**ファイル**: `models/padExtractor.js`

**実装内容**:
- `FUNCTION name GLOBAL/LOCAL` パターンに対応
- 日本語や記号を含むサブフロー名に対応
- 大文字小文字を区別しない検出

**変更箇所**:
```javascript
// _parseFlowDefinition メソッド内 (Line 206-236)
// FUNCTIONでサブフローを検出
if (trimmedLine.toUpperCase().includes('FUNCTION ')) {
  // パターン: FUNCTION name [GLOBAL|LOCAL]
  // 日本語や記号を含む名前に対応
  let match = trimmedLine.match(/FUNCTION\s+([^\s]+)(?:\s+(?:GLOBAL|LOCAL))?/i);
  if (match) {
    currentSubflow = match[1];
    subflowsFound.add(currentSubflow);
    console.log(`Found FUNCTION (subflow): ${currentSubflow}`);
  }
}

// END FUNCTIONでメインフローに戻る
else if (trimmedLine.toUpperCase().includes('END') &&
         trimmedLine.toUpperCase().includes('FUNCTION')) {
  console.log(`END FUNCTION for: ${currentSubflow}`);
  currentSubflow = 'メインフロー';
}
```

#### 2-3. サブフロー内アクションの詳細ログ
**ファイル**: `models/padExtractor.js`

**実装内容**:
- サブフロー内の各行を詳細ログ出力
- アクション抽出成功/失敗を明示
- デバッグ用の情報を強化

**変更箇所**:
```javascript
// サブフロー内の行を詳細ログ (Line 238-256)
if (currentSubflow !== 'メインフロー') {
  console.log(`Line ${lineNumber} in subflow "${currentSubflow}": ${trimmedLine.substring(0, 80)}`);
}

const actionInfo = this._parseActionLine(trimmedLine, flowName, currentSubflow, connectionMap);
if (actionInfo) {
  actions.push(actionInfo);
  actionCount++;
  if (currentSubflow !== 'メインフロー') {
    console.log(`  -> Action extracted in subflow "${currentSubflow}": ${actionInfo['アクション名']}`);
  }
} else {
  if (currentSubflow !== 'メインフロー') {
    console.log(`  -> No action extracted from this line in subflow`);
  }
}
```

#### 2-4. 定義文字列のサンプル表示とFUNCTION検索
**ファイル**: `models/padExtractor.js`

**実装内容**:
- 最初の20行をサンプル表示
- 全行からFUNCTIONキーワードを検索して表示

**変更箇所**:
```javascript
// 定義サンプル表示 (Line 181-186)
console.log('\n=== Definition Sample (first 20 lines) ===');
for (let i = 0; i < Math.min(20, lines.length); i++) {
  console.log(`Line ${i+1}: ${lines[i].substring(0, 100)}`);
}
console.log('=== End Sample ===\n');

// FUNCTION検索 (Line 188-195)
console.log('=== Searching for all FUNCTION keywords ===');
lines.forEach((line, index) => {
  if (line.toUpperCase().includes('FUNCTION')) {
    console.log(`Line ${index+1}: ${line.trim()}`);
  }
});
console.log('=== End FUNCTION search ===\n');
```

---

### 3. フロントエンド改善 ✅

#### 3-1. ファイル選択の二重クリック問題修正
**ファイル**: `public/index.html`, `public/static/js/app.js`

**実装内容**:
- HTML内のonclick属性を削除
- JavaScriptで統一的にイベント管理
- イベント伝播制御（stopPropagation）
- isAnalyzingフラグのリセット処理追加

**変更箇所**:
```javascript
// index.html (Line 147-150)
<button id="selectFileButton" class="btn btn-primary btn-lg">
  <i class="fas fa-folder-open me-2"></i>
  ファイルを選択
</button>

// app.js - initializeEventListeners (Line 22-30)
const selectFileButton = document.getElementById('selectFileButton');
if (selectFileButton) {
  selectFileButton.addEventListener('click', (e) => {
    console.log('Select file button clicked');
    e.stopPropagation();
    fileInput.click();
  });
}
```

#### 3-2. デバッグログの強化
**ファイル**: `public/static/js/app.js`

**実装内容**:
- 各処理ステップで詳細ログ出力
- データの流れを追跡
- エラー発生箇所の特定が容易に

**変更箇所**:
- analyzeFile関数: レスポンス内容、actions配列の長さ、最初のアクションサンプル
- displayResults関数: 呼び出し確認、統計情報、各関数呼び出しの確認
- setupFilters関数: allActionsの長さ、ユニークな値のリスト
- displayTable関数: ページング情報、表示データの長さ、最初の要素

---

## 📁 修正したファイル一覧

### バックエンド
1. **models/powerAutomateAnalyzer.js** - PA/PAD統合解析クラス
   - PA/PAD判定ロジック
   - PA解析（workflows JSONファイル読み込み）
   - アクション実行順序ソート
   - 条件式抽出
   - アクション内容フォーマット改善

2. **models/padExtractor.js** - PAD解析クラス
   - 複数Workflow対応
   - サブフロー検出パターン改善
   - 詳細デバッグログ
   - 定義文字列サンプル表示

3. **app.js** - メインアプリケーション
   - PowerAutomateAnalyzerの使用（PADActionExtractorから変更）
   - solution_type情報の追加

### フロントエンド
4. **public/index.html**
   - ボタンのonclick属性削除

5. **public/static/js/app.js**
   - イベントハンドラー改善
   - デバッグログ強化
   - isAnalyzingフラグ管理

---

## 🔍 検証結果

### テストファイル
- **5732_PARTS_1_0_0_2.zip** (PADソリューション)
  - 2つのWorkflow: 「先行登録」「統合ダウンロード(DWH)」
  - 各Workflowに1つずつサブフロー「エラー処理」

### 検証結果
✅ **PA/PAD判定**: 正常動作（desktopflowbinariesの有無で判定）
✅ **複数Workflow検出**: 2つとも検出・処理
✅ **サブフロー検出**: 両方のフローで「エラー処理」を検出
✅ **サブフロー内アクション抽出**: 正常（各5個のアクション）
✅ **総アクション数**: 118個（先行登録: 76, 統合ダウンロード: 42）

### サーバーログ確認事項
```
Total Workflow entries in XML: 2

=== Workflow 1/2 ===
Name: 先行登録
Definition length: 13298
-> 76 actions extracted

=== Workflow 2/2 ===
Name: 統合ダウンロード(DWH)
Definition length: 7851
-> 42 actions extracted

Total PAD actions extracted: 118
```

サブフロー「エラー処理」内のアクション（各フロー共通）:
1. Variables.CreateNewList
2. Variables.AddItemToList (×4)
3. External.RunFlow

---

## ⚠️ 現在の課題

### 表示の問題（要確認）
ユーザーから「先行登録はメインフローのみの表示となっている」との報告あり。

**サーバーログでは正常に抽出されているため、以下の可能性**:
1. ブラウザの表示フィルター設定
2. ページネーションで別ページに分かれている
3. CSVダウンロードでは正しく出力されている可能性

**次回確認事項**:
- [ ] CSVダウンロードして「サブフロー名」列を確認
- [ ] ブラウザのフィルター機能で「エラー処理」を検索
- [ ] アクション一覧テーブルの全ページを確認
- [ ] 総アクション数の表示が118になっているか確認

---

## 🛠️ 技術的な実装詳細

### PA解析のJSON構造パターン対応
```javascript
// パターン1: flowDef.properties.definition
if (flowDef.properties && flowDef.properties.definition) {
  definition = flowDef.properties.definition;
}
// パターン2: flowDef自体がdefinition
else if (flowDef.triggers || flowDef.actions) {
  definition = flowDef;
}
// パターン3: flowDef.definition
else if (flowDef.definition) {
  definition = flowDef.definition;
}
```

### トポロジカルソートアルゴリズム
```javascript
// DFS（深さ優先探索）を使用
const visit = (name) => {
  if (processed.has(name)) return;
  processed.add(name);

  // 依存先を先に処理
  for (const dep of node.dependencies) {
    visit(dep);
  }
  // その後自身を追加
  sorted.push([name, node.action]);
};
```

### PADサブフロー検出の正規表現
```javascript
// FUNCTION name [GLOBAL|LOCAL] パターン
// [^\s]+ で日本語や記号を含む名前に対応
// (?:\s+(?:GLOBAL|LOCAL))? でオプショナルなキーワードに対応
/FUNCTION\s+([^\s]+)(?:\s+(?:GLOBAL|LOCAL))?/i
```

---

## 📊 データフロー図

```
ZIP File Upload
    ↓
[powerAutomateAnalyzer.js]
    ↓
_detectSolutionType (desktopflowbinariesチェック)
    ↓
    ├─ PA → _analyzeCloudFlow
    │         ↓
    │      Workflows/*.json 読み込み
    │         ↓
    │      _parseCloudFlowDefinition
    │         ↓
    │      _extractActionsRecursive (runAfterでソート)
    │
    └─ PAD → padExtractor.extractFromZipFile
              ↓
           customizations.xml 読み込み
              ↓
           _parseCustomizationsXml (複数Workflow対応)
              ↓
           _parseFlowDefinition (各Workflowごと)
              ↓
           FUNCTION検出 → サブフロー切り替え
              ↓
           _parseActionLine
    ↓
Actions配列
    ↓
フロントエンド表示 / CSV出力
```

---

## 🔄 次回作業時の確認手順

### 1. サーバー起動
```bash
cd C:\Users\OGURATakeo(小倉健生)\pad_web_analyzer_js
npm start
```

### 2. ブラウザで確認
- http://localhost:5000
- F12でデベロッパーツール → コンソールタブ

### 3. テストファイルアップロード
- `5732_PARTS_1_0_0_2.zip`
- サーバーログとブラウザログを両方確認

### 4. 表示確認
- 総アクション数: 118
- フロー数: 2
- アクション種類とサブフロー名でフィルタリング

### 5. CSV確認
- CSVダウンロード
- Excelで開く（UTF-8 BOM対応）
- 「サブフロー名」列で「エラー処理」を検索
- 期待: 各フローで5行ずつ（計10行）

---

## 📝 メモ・備考

### 判明した仕様
- PADのサブフローは `FUNCTION name GLOBAL` 形式で定義
- 同じサブフロー名（例: エラー処理）が複数のフローで使用される
- PAのアクション実行順序は `runAfter` プロパティで制御
- PAの条件式は `expression` プロパティに格納

### 成功したデバッグ手法
- 定義文字列の最初の20行をサンプル表示
- FUNCTIONキーワードを含む全行を検索
- サブフロー内の各行を詳細ログ
- アクション抽出の成功/失敗を明示

### 今後の拡張案
- [ ] サブフロー呼び出し関係の可視化
- [ ] PAのコネクタ情報の詳細抽出
- [ ] エラーハンドリングの改善
- [ ] 大規模ファイル（1000+アクション）の性能最適化

---

## 📞 問い合わせ先

- プロジェクトパス: `C:\Users\OGURATakeo(小倉健生)\pad_web_analyzer_js`
- 作業ログ保存先: `C:\Users\OGURATakeo(小倉健生)\Desktop\CLAUDE_PROJECT\pad_web_analyzer_作業ログ_20251009.md`

---

**作業終了時刻**: 2025年10月9日
**次回作業予定**: 2025年10月10日
