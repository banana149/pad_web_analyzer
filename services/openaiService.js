/**
 * OpenAI連携サービス
 * JavaScript版
 */

const { OpenAI, AzureOpenAI } = require('openai');

class OpenAIService {
  constructor() {
    // Azure OpenAIエンドポイントが設定されている場合はAzure OpenAIを使用
    if (process.env.OPENAI_ENDPOINT) {
      this.client = new AzureOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: process.env.OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-02-15-preview',
        deployment: process.env.OPENAI_MODEL || 'gpt-4o-mini'
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      console.log('Using Azure OpenAI with endpoint:', process.env.OPENAI_ENDPOINT);
    } else {
      // 通常のOpenAI APIを使用
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      console.log('Using OpenAI API');
    }
  }

  /**
   * アクションデータから要件定義書を生成
   */
  async generateRequirementsDocument(actions, solutionName, excelData = "") { // ← ここを修正
    try {
      // アクションデータをプロンプト用に整理
      const actionSummary = this._createActionSummary(actions);
      console.log('actionSummary',actionSummary);
      console.log('solutionName',solutionName);
      console.log('excelData',excelData);
      const prompt = `
# 命令
Power Automateソリューション「${solutionName}」を解析し、業務の開始から終了までの一連の流れを、参照Excel（マスターデータ）の情報と紐付けながら、時系列のリスト形式で作成してください。

# 参照Excelデータ（マスター情報）
${excelData}

# フロー詳細データ
${actionSummary}

---

# 【業務実行フロー：一連の流れ】
※フロー名やサブフロー名で区切らず、一つの連続した業務プロセスとして、以下の形式でリスト化してください。
※Excelデータに該当する情報（拠点名、担当者、システムURL、ファイル名など）がある場合は、必ず具体名を補完して記述してください。
※全ての手順を記載してください

1. **[作業ステップ]**
   - **業務概要**: （その手順でどういった業務が行われているのかを推測してください。）
   - **手順詳細**: （その作業が具体的に何をしているのかを詳細に記述）
   - **仕様アプリシステム**: （Excel、ブラウザ、基幹システム名などを記述。★重要：操作対象がPower AutomateやPower Automate Desktop自体の機能である場合、または外部アプリを使用していない場合は、必ず「なし」とだけ記述してください。）
   - **インプット**: （このステップで参照しているExcelのシート名・列名や、前工程から引き継いだ変数、インプットしてきたシステム名。なければ「なし」）
   - **アウトプット**: （このステップで作成したファイル、保存先、または次工程に渡す変数名アウトプットしてきたシステム名。。なければ「なし」）
   - **フロー名**: （クラウドフローもしくはデスクトップフローの名称だけサブフローは記載しない。「なし」はあり得ないのでフロー名をちゃんと記載してください。）
2. **[ステップ名]**
   - ...（続く）

---

## ■ 解析・記述ルール（厳守事項）
1. **フォーマット厳守**: 各ステップは必ず「番号. **ステップ名**」で始め、その下の項目は「- **項目名**: 内容」の形式を維持してください。
2. **マスターデータの結合**: フロー内のID等はExcel内の「具体名」に置き換えて記述してください。
3. **専門用語の翻訳**: 非エンジニアでも分かる業務動作の言葉（例：「Excelを起動する」等）に変換してください。
4. **情報の網羅**: 「どのシステム」で「何をインプット」して「何が出たか」を各行で完結させて記述してください。


日本語で、このリストを読めば「どのマスタを参照して、どの画面に何を入力し、どこへデータが流れるのか」が完璧に理解できるように記述してください。


`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはシステム要件定義の専門家です。Power Automate Desktopのアクション情報から、分かりやすい要件定義書を作成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`要件定義生成中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * フローチャート用の説明文を生成
   */
  async generateFlowchartDescription(actions, flowName) {
    try {
      const actionSummary = this._createActionSummary(actions.filter(action => action.フロー名 === flowName));

      const prompt = `
以下のPower Automate Desktopフロー「${flowName}」のアクション一覧から、フローチャート用の簡潔な説明文を生成してください。

# アクション一覧
${actionSummary}

以下の点を含めて、1-2文で簡潔に説明してください：
- フローの主要な処理内容
- 使用する外部アプリケーション
- 処理の流れ

日本語で回答してください。
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはフローチャート作成の専門家です。処理内容を簡潔に要約してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`フローチャート説明生成中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * Mermaid形式のシステムフローチャートを生成（PA/PAD両対応）- 改善版
   * 構造化データ + Few-shot Examples + temperature=0 で安定した品質を実現
   */
  async generateSystemFlowchart(actions, solutionName, solutionType) {
    try {
      // 構造化データを作成
      const structuredData = this._createStructuredFlowData(actions);

      // Few-shot Examples（縦長表示の良い例を提示）
      const fewShotExamples = `
# 例1: 単純な順次処理（縦長・推奨）
flowchart TD
    Start(["開始"]) --> Init["初期設定"]
    Init --> Process1["データ取得"]
    Process1 --> Process2["データ加工"]
    Process2 --> Save["結果保存"]
    Save --> End1(["終了"])

# 例2: 条件分岐あり（縦長配置）
flowchart TD
    Start(["開始"]) --> Load["データ読込"]
    Load --> Check{"データ存在?"}
    Check -->|"Yes"| Process["データ処理"]
    Check -->|"No"| Error["エラー処理"]
    Process --> End1(["終了"])
    Error --> End1

# 例3: サブフロー呼び出し（縦長・推奨パターン）
flowchart TD
    Start(["開始"]) --> Init["初期設定"]
    Init --> CallSub1["サブフロー1を呼出"]
    CallSub1 --> CallSub2["サブフロー2を呼出"]
    CallSub2 --> CallSub3["サブフロー3を呼出"]
    CallSub3 --> End1(["終了"])

# 例4: サブフロー詳細化（最大2-3個のsubgraphのみ）
flowchart TD
    Start(["開始"]) --> Init["初期設定"]
    Init --> CallSub1["サブフロー1を呼出"]

    subgraph Sub1["サブフロー1: データ取得"]
        Sub1_1["ファイル読込"] --> Sub1_2["データ検証"]
    end

    CallSub1 --> CallSub2["サブフロー2を呼出"]

    subgraph Sub2["サブフロー2: データ処理"]
        Sub2_1["データ加工"] --> Sub2_2["結果出力"]
    end

    CallSub2 --> End1(["終了"])

# 例5: 条件分岐は縦に配置（横並び禁止）
flowchart TD
    Start(["開始"]) --> Init["初期化"]
    Init --> Check{"条件チェック"}
    Check -->|"条件A"| ProcessA["処理A実行"]
    Check -->|"条件B"| ProcessB["処理B実行"]
    ProcessA --> Merge["処理結合"]
    ProcessB --> Merge
    Merge --> End1(["終了"])

## 6. RPAの処理手順詳細説明
  各ステップにおいて、「何を対象に」「どんな操作をしているか」を以下のルールで具体的に記述してください。

  ### A. ファイル操作・Excel操作
  - **操作対象ファイル**: 使用しているExcelのファイル名やパスを特定して記述してください。
  - **操作内容**: どのシートのどのセル（または列名）を読み取り・書き込みしているか明示してください。

  ### B. Webブラウザ・サイト操作
  - **利用サイト**: 操作対象のURLまたはサイト名を記述してください。
  - **具体的な操作**: 「ログイン」「データ入力」「ボタンクリック」「抽出」など、人間が行う動作として記述してください。

  ### C. 処理フローの詳細
  - 主要な処理のつながりを、データの流れ（どこから持ってきてどこへ移すか）に注目して説明してください。
- 条件分岐やループがある場合、その「条件（例：データが空の場合など）」を具体的に記述してください。    
    `;

      // PAとPADで異なる指示を生成
      let specificInstructions = '';
      if (solutionType === 'PA') {
        specificInstructions = `
このソリューションはPower Automate（クラウドフロー）です。
- トリガーから始まり、各アクションの実行順序を明確に表現
- コネクタや外部サービスとの連携を subgraph または個別ノードで表現
- 並列処理がある場合は並列の矢印で表現`;
      } else if (solutionType === 'PAD') {
        specificInstructions = `
このソリューションはPower Automate Desktop（デスクトップフロー）です。
- メインフローとサブフローの関係を明確に表現
- サブフローは subgraph でグループ化（数が多い場合は主要なもののみ）
- UIオートメーションや外部アプリ連携を明示`;
      } else {
        specificInstructions = `
このソリューションはPower AutomateとPower Automate Desktopの混在です。
- PA（クラウド）とPAD（デスクトップ）の両方を表現
- 各フローの役割分担を明確にする`;
      }

      // Chain-of-Thought プロンプト（段階的思考）- 縦長表示に最適化（中解像度版）
      const prompt = `
あなたは厳密なMermaid記法の専門家です。以下の手順で、**縦長で詳細な**フローチャートを生成してください。

## ステップ1: フロー構造の理解
以下のJSON形式で構造化されたフローデータを分析してください：

${JSON.stringify(structuredData, null, 2)}

## ステップ2: 抽象度の決定ルール（中解像度：より詳細に）
サブフロー数に基づいて表現レベルを決定：
- サブフロー数が1-3個 → 全てのサブフローを subgraph で詳細表現
- サブフロー数が4-8個 → 重要な4-5個を subgraph で表現、他は呼び出しノードのみ
- サブフロー数が9-15個 → 重要な3-4個を subgraph で表現、他は呼び出しノードのみ
- サブフロー数が16個以上 → 最も重要な2-3個のみ subgraph で表現、他は呼び出しノードのみ

**ノード数制限**: 全体で15-20個のノードまで許容（詳細度を向上）

## ステップ3: ノード構成の決定（縦方向に配置）
以下の要素を必ず含めること：
1. Start(["開始"]) - 必須の開始ノード
2. Init["初期設定"] または最初の処理ノード
3. CallSubN["サブフローNを呼出"] - 各サブフロー呼び出し（Nは1, 2, 3...の連番）
4. DecisionN{"条件"} - 条件分岐がある場合（patterns.hasCondition=true）
   - **重要**: 条件分岐は縦に配置（Yes/Noの両方を下に向ける）
5. LoopN["ループ処理"] - ループがある場合（patterns.hasLoop=true）
6. ErrorHandler["エラー処理"] - エラー処理がある場合（patterns.hasError=true）
7. End1(["終了"]) - 必須の終了ノード

## ステップ4: Mermaid コード生成（縦長レイアウト）
以下のテンプレートに厳密に従って生成：

flowchart TD
    Start(["開始"]) --> [最初の処理]
    [処理の流れ...]
    [最後の処理] --> End1(["終了"])

**重要なレイアウトルール**:
- 全てのノードは縦方向に配置（横並びは避ける）
- 条件分岐のYes/Noは両方とも下向きの矢印
- サブフローは縦に順番に呼び出す
- subgraph内のノードも縦に2-3個程度に制限

## ソリューション固有の指示
${specificInstructions}

## 出力ルール（厳守）
1. **ノードID**: 必ず英数字とアンダースコアのみ（Start, Init, CallSub1, Decision1, Loop1, Sub1_1 など）
2. **ラベル**: 必ずダブルクォートで囲む（["開始"], {"条件"}, ["サブフロー1を呼出"]）
3. **エッジラベル**: 条件分岐の場合はダブルクォートで囲む（|"Yes"|, |"No"|）
4. **subgraph構文**: subgraph Sub1["サブフロー名"] ... end の形式
5. **コメント禁止**: 説明文やコメント（%%）は一切含めない
6. **コードブロック禁止**: \`\`\` は含めない
7. **一貫性**: 同じ構造には同じパターンを適用
8. **縦長優先**: 必ず flowchart TD を使用し、横に広がらないようにする

## Few-shot Examples（参考にすべき良い例）
${fewShotExamples}

## 最終確認事項
- flowchart TD で開始していますか？
- 全てのノードは縦方向に配置されていますか？（横並びはNG）
- ノード数は8-12個程度に抑えられていますか？
- 全てのノードIDは英数字のみですか？
- 全てのラベルはダブルクォートで囲まれていますか？
- subgraph を使用した場合、必ず end で閉じていますか？
- Start と End1 の両方が存在しますか？

では、上記の構造化データから、**縦長で見やすいレイアウト**でMermaidコードのみを生成してください。
説明や補足は一切不要です。Mermaidコードのみを出力してください。
`;

      // API呼び出し（決定性を最大化、縦長表示を強調）
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたは厳密なMermaid記法の専門家です。与えられたフロー構造から、常に一貫した形式で**縦長（Top-Down）**のフローチャートを生成してください。横に広がるレイアウトは絶対に避け、全てのノードを縦方向に配置してください。ノード数は8-12個程度に抑え、見やすさを最優先します。創造性ではなく、正確性と再現性を最優先します。ルールに従い、Mermaidコードのみを出力してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,        // トークン数を削減して簡潔に（3000 → 2000）
        temperature: 0.0,        // 完全に決定的にする
        top_p: 0.1,              // サンプリング範囲を極小化
        frequency_penalty: 0,
        presence_penalty: 0
      });

      let mermaidCode = response.choices[0].message.content.trim();

      // コードブロック記号を削除
      mermaidCode = mermaidCode.replace(/```mermaid\n?/g, '');
      mermaidCode = mermaidCode.replace(/```\n?/g, '');
      mermaidCode = mermaidCode.trim();

      // Mermaidコードのバリデーションとクリーンアップ
      mermaidCode = this._validateAndCleanMermaidCode(mermaidCode);

      console.log('Generated Mermaid code with structured data approach');
      console.log(`Input: ${actions.length} actions, ${structuredData.length} flows`);

      return mermaidCode;

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`フローチャート生成中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * Mermaidコードのバリデーションとクリーンアップ（強化版）
   */
  _validateAndCleanMermaidCode(code) {
    try {
      let cleanCode = code;

      // 先頭がflowchartまたはgraphで始まっていない場合は追加
      if (!cleanCode.match(/^(flowchart|graph)\s+(TD|LR|TB|RL|BT)/m)) {
        cleanCode = 'flowchart TD\n' + cleanCode;
      }

      // ノードIDマッピング（日本語→英語）
      const nodeIdMap = new Map();
      let nodeCounter = 1;

      const getOrCreateNodeId = (originalId) => {
        // 既に英数字のみの場合はそのまま使用
        if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(originalId)) {
          return originalId;
        }

        // マップに存在する場合は取得
        if (nodeIdMap.has(originalId)) {
          return nodeIdMap.get(originalId);
        }

        // 新しいIDを生成
        const newId = `Node${nodeCounter++}`;
        nodeIdMap.set(originalId, newId);
        return newId;
      };

      // ラベルのエスケープ処理
      const escapeLabel = (label) => {
        return label
          .replace(/^"|"$/g, '')   // 既存のクォートを削除
          .replace(/\\/g, '')      // バックスラッシュを削除
          .replace(/"/g, "'")      // ダブルクォートをシングルクォートに置換
          .replace(/\[/g, '(')     // [を(に置換
          .replace(/\]/g, ')')     // ]を)に置換
          .replace(/\{/g, '(')     // {を(に置換
          .replace(/\}/g, ')')     // }を)に置換
          .trim();
      };

      // 行ごとに処理
      const lines = cleanCode.split('\n');
      const cleanedLines = [];

      for (let line of lines) {
        // コメント行、flowchart宣言行、subgraph、endはそのまま
        if (line.trim().startsWith('%%') ||
            line.trim().match(/^(flowchart|graph)\s+(TD|LR|TB|RL|BT)/) ||
            line.trim() === 'end') {
          cleanedLines.push(line);
          continue;
        }

        // subgraph行の処理
        if (line.trim().startsWith('subgraph ')) {
          // subgraph ID["ラベル"] の形式を処理
          const subgraphMatch = line.match(/^(\s*)subgraph\s+(\S+)(\[.+\])?$/);
          if (subgraphMatch) {
            const indent = subgraphMatch[1];
            const subgraphId = subgraphMatch[2];
            let subgraphLabel = subgraphMatch[3] || '';

            // ラベルの整形
            if (subgraphLabel) {
              subgraphLabel = subgraphLabel.replace(/\[([^\]]+)\]/g, (m, l) => `["${escapeLabel(l)}"]`);
            }

            cleanedLines.push(`${indent}subgraph ${subgraphId}${subgraphLabel}`);
            continue;
          } else {
            // マッチしない場合はそのまま
            cleanedLines.push(line);
            continue;
          }
        }

        // 空行はスキップ
        if (line.trim() === '') {
          continue;
        }

        // インデントを保持
        const indent = line.match(/^(\s*)/)[1];
        line = line.trim();

        // 矢印で分割（エッジラベル含む）
        const arrowMatch = line.match(/^(.+?)\s*-->\s*(.+)$/);

        if (arrowMatch) {
          // 接続がある場合
          let fromPart = arrowMatch[1].trim();
          let toPart = arrowMatch[2].trim();

          // エッジラベルの処理
          let edgeLabel = '';
          const edgeLabelMatch = toPart.match(/^\|([^\|]+)\|\s*(.+)$/);
          if (edgeLabelMatch) {
            edgeLabel = `|"${escapeLabel(edgeLabelMatch[1])}"|`;
            toPart = edgeLabelMatch[2].trim();
          }

          // fromPartの処理
          const fromNodeMatch = fromPart.match(/^(\S+?)([\[\(\{].+)?$/);
          if (fromNodeMatch) {
            const fromNodeId = getOrCreateNodeId(fromNodeMatch[1]);
            let fromLabel = fromNodeMatch[2] || '';

            // ラベルの整形
            if (fromLabel) {
              fromLabel = fromLabel
                .replace(/\[([^\]]+)\]/g, (m, l) => `["${escapeLabel(l)}"]`)
                .replace(/\{([^\}]+)\}/g, (m, l) => `{"${escapeLabel(l)}"}`)
                .replace(/\(\[([^\]]+)\]\)/g, (m, l) => `(["${escapeLabel(l)}"])`)
                .replace(/\(([^\)]+)\)/g, (m, l) => {
                  if (!l.match(/^\[.+\]$/)) {
                    return `("${escapeLabel(l)}")`;
                  }
                  return m;
                });
            }

            fromPart = fromNodeId + fromLabel;
          }

          // toPartの処理
          const toNodeMatch = toPart.match(/^(\S+?)([\[\(\{].+)?$/);
          if (toNodeMatch) {
            const toNodeId = getOrCreateNodeId(toNodeMatch[1]);
            let toLabel = toNodeMatch[2] || '';

            if (toLabel) {
              toLabel = toLabel
                .replace(/\[([^\]]+)\]/g, (m, l) => `["${escapeLabel(l)}"]`)
                .replace(/\{([^\}]+)\}/g, (m, l) => `{"${escapeLabel(l)}"}`)
                .replace(/\(\[([^\]]+)\]\)/g, (m, l) => `(["${escapeLabel(l)}"])`)
                .replace(/\(([^\)]+)\)/g, (m, l) => {
                  if (!l.match(/^\[.+\]$/)) {
                    return `("${escapeLabel(l)}")`;
                  }
                  return m;
                });
            }

            toPart = toNodeId + toLabel;
          }

          cleanedLines.push(`${indent}${fromPart} --> ${edgeLabel ? edgeLabel + ' ' : ''}${toPart}`);
        } else {
          // 単独のノード定義
          const nodeMatch = line.match(/^(\S+?)([\[\(\{].+)?$/);
          if (nodeMatch) {
            const nodeId = getOrCreateNodeId(nodeMatch[1]);
            let nodeLabel = nodeMatch[2] || '';

            if (nodeLabel) {
              nodeLabel = nodeLabel
                .replace(/\[([^\]]+)\]/g, (m, l) => `["${escapeLabel(l)}"]`)
                .replace(/\{([^\}]+)\}/g, (m, l) => `{"${escapeLabel(l)}"}`)
                .replace(/\(\[([^\]]+)\]\)/g, (m, l) => `(["${escapeLabel(l)}"])`)
                .replace(/\(([^\)]+)\)/g, (m, l) => {
                  if (!l.match(/^\[.+\]$/)) {
                    return `("${escapeLabel(l)}")`;
                  }
                  return m;
                });
            }

            cleanedLines.push(`${indent}${nodeId}${nodeLabel}`);
          } else {
            cleanedLines.push(indent + line);
          }
        }
      }

      cleanCode = cleanedLines.join('\n');

      console.log('Cleaned Mermaid code:');
      console.log(cleanCode);

      return cleanCode;

    } catch (error) {
      console.error('Mermaid validation error:', error);
      // エラー時は元のコードを返す
      return code;
    }
  }

  /**
   * アクションサマリーを作成（詳細版）
   */
  /**
   * アクション名から特殊文字を除去してMermaid対応の形式にする
   */
  _sanitizeActionName(actionName) {
    if (!actionName) return '';

    let sanitized = actionName;

    // Call[...を呼出"] のような形式を Call_... に変換
    sanitized = sanitized.replace(/^Call\[(.+?)を呼出["\]]+$/g, 'Call_$1');

    // その他の特殊文字を除去または置換
    sanitized = sanitized
      .replace(/[\[\]"'()]/g, '_')  // 括弧や引用符をアンダースコアに
      .replace(/[<>]/g, '')          // 不等号を除去
      .replace(/\s+/g, '_')          // 空白をアンダースコアに
      .replace(/_+/g, '_')           // 連続するアンダースコアを1つに
      .replace(/^_|_$/g, '');        // 前後のアンダースコアを除去

    return sanitized;
  }

  _createActionSummary(actions) {
    const summary = {
      totalActions: actions.length,
      flows: [...new Set(actions.map(action => action.フロー名))],
      actionTypes: [...new Set(actions.map(action => action.アクション種類))],
      externalApps: [...new Set(actions.map(action => action.外部アプリケーション名).filter(Boolean))]
    };

    let summaryText = `総アクション数: ${summary.totalActions}\n`;
    summaryText += `フロー数: ${summary.flows.length}\n`;
    summaryText += `アクション種類数: ${summary.actionTypes.length}\n`;
    summaryText += `外部アプリケーション: ${summary.externalApps.join(', ') || 'なし'}\n\n`;

    // 各フローの詳細
    for (const flow of summary.flows) {
      const flowActions = actions.filter(action => action.フロー名 === flow);
      summaryText += `## フロー: ${flow}\n`;
      summaryText += `総アクション数: ${flowActions.length}\n`;

      const subflows = [...new Set(flowActions.map(action => action.サブフロー名))];
      summaryText += `サブフロー数: ${subflows.length}\n`;
      summaryText += `サブフロー一覧: ${subflows.join(', ')}\n\n`;

      // メインフローと各サブフローの処理内容
      for (const subflow of subflows) {
        const subflowActions = flowActions.filter(action => action.サブフロー名 === subflow);
        summaryText += `### サブフロー: ${subflow} (${subflowActions.length}件)\n`;

        // アクション種類の統計
        const subflowActionTypes = {};
        subflowActions.forEach(action => {
          const type = action.アクション種類 || '不明';
          subflowActionTypes[type] = (subflowActionTypes[type] || 0) + 1;
        });
        summaryText += `主要処理: ${Object.entries(subflowActionTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 100)
          .map(([type, count]) => `${type}(${count})`)
          .join(', ')}\n`;

        // 代表的なアクション（最大15件）
        summaryText += `\n処理フロー:\n`;
        for (const action of subflowActions.slice(0, 100)) {
          const sanitizedActionName = this._sanitizeActionName(action.アクション名);
          summaryText += `  - [${action.アクション種類}] ${sanitizedActionName}`;
          if (action.外部アプリケーション名) {
            summaryText += ` → ${action.外部アプリケーション名}`;
          }
          if (action.変数名) {
            summaryText += ` (変数: ${action.変数名})`;
          }
          summaryText += '\n';
        }

        if (subflowActions.length > 15) {
          summaryText += `  ... 他${subflowActions.length - 15}件の処理\n`;
        }
        summaryText += '\n';
      }
    }

    return summaryText;
  }

  /**
   * フロー構造を抽象化して構造化データに変換（Mermaid生成用）
   */
  _createStructuredFlowData(actions) {
    const flows = [...new Set(actions.map(a => a.フロー名))];

    const structuredData = flows.map(flowName => {
      const flowActions = actions.filter(a => a.フロー名 === flowName);
      const subflows = [...new Set(flowActions.map(a => a.サブフロー名))];

      return {
        flowName: flowName,
        flowType: flowActions[0]['フロータイプ'] || 'PAD',
        totalActions: flowActions.length,
        subflows: subflows.map(subflowName => {
          const subflowActions = flowActions.filter(a => a.サブフロー名 === subflowName);

          // アクション種類を集計（実行順序を保持、最大10件）
          const actionSequence = subflowActions.slice(0, 100).map(a => ({
            type: a.アクション種類 || '処理',
            name: this._sanitizeActionName(a.アクション名 || ''),
            externalApp: a.外部アプリケーション名 || null
          }));

          // 主要な処理パターンを抽出
          const hasLoop = subflowActions.some(a =>
            a.アクション種類?.includes('ループ') ||
            a.アクション種類?.includes('ForEach') ||
            a.アクション種類?.includes('Until')
          );
          const hasCondition = subflowActions.some(a =>
            a.アクション種類?.includes('条件') ||
            a.アクション種類?.includes('If') ||
            a.アクション種類?.includes('Switch')
          );
          const hasError = subflowActions.some(a =>
            a.アクション種類?.includes('エラー') ||
            a.アクション種類?.includes('例外') ||
            a.アクション種類?.includes('終了')
          );

          return {
            name: subflowName,
            actionCount: subflowActions.length,
            actionSequence: actionSequence,
            patterns: {
              hasLoop,
              hasCondition,
              hasError
            },
            externalApps: [...new Set(
              subflowActions
                .map(a => a.外部アプリケーション名)
                .filter(Boolean)
            )]
          };
        })
      };
    });

    return structuredData;
  }

  /**
   * ユーザー向け手動実行ガイドを生成
   * PA/PADが使えなくなった場合に、フローが自動化していた業務を人間が手作業で行うためのガイドを生成
   */
  async generateUserGuideDocument(actions, solutionName, solutionType) {
    try {
      // アクションデータをプロンプト用に整理
      const actionSummary = this._createActionSummary(actions);

      const prompt = `
以下の${solutionType === 'PA' ? 'Power Automate（クラウドフロー）' : 'Power Automate Desktop（デスクトップフロー）'}ソリューション「${solutionName}」のアクション一覧を分析してください。

# 重要な前提
このフローは通常、PA/PADによって自動化されていますが、**システム障害やライセンス問題などでPA/PADが使えなくなった場合**に、
ユーザーが同じ業務を手作業で実行するための手順書を作成する必要があります。

つまり、「PA/PADフローを実行する方法」ではなく、「PA/PADが自動化していた業務内容を、PA/PADを使わずに人間が手作業で行う方法」を記述してください。

# アクション一覧
${actionSummary}

# 分析と手順書作成のアプローチ
1. 各アクションが何をしているかを分析
2. それらのアクションを「人間の手作業」に変換
3. 技術者でない一般ユーザーでも実行できる手順書を作成

例：
- アクション「Excelファイルを開く」→ 手順「Excelファイルを手動で開く」
- アクション「Webブラウザでログイン」→ 手順「ブラウザを開いてログインページにアクセスし、手動でログイン」
- アクション「データをコピー」→ 手順「必要なデータをコピー（Ctrl+C）する」
- アクション「別のシステムに入力」→ 手順「対象システムを開いて、手動でデータを入力する」

# 手動実行ガイドの形式

## 1. 概要
- **この業務の目的**: PA/PADが自動化していた業務の目的と成果
- **所要時間（手作業の場合）**: 手動で実行した場合にかかる想定時間
- **緊急度**: PA/PADが使えない場合、この業務を手動で行う必要性（高/中/低）

## 2. 事前準備
### 2.1 必要なツール・アプリケーション
- 使用するアプリケーション（Excel、Webブラウザ、基幹システムなど）のリスト
- 必要なログイン情報やアクセス権限
- 必要なファイルの保存場所

### 2.2 事前確認
- 実行前に確認すべき事項
- データのバックアップ方法

## 3. 手作業による実行手順
**重要**: PA/PADを使わずに、人間が手作業で行う手順を記載

各ステップの形式：
### 【ステップ番号】ステップのタイトル
- **目的**: このステップで何を達成するか
- **具体的な操作手順**:
  1. 詳細な操作手順（画面名、ボタン名、メニュー名を具体的に）
  2. 入力する値や選択する項目
  3. クリックする場所やキーボード操作
- **AI解説**: なぜこの操作が必要か、元のPA/PADフローでは何をしていたか
- **確認ポイント**: 正しく実行できたかの確認方法
- **注意事項**: ⚠️ ミスしやすい点、特に注意すべき点

## 4. トラブルシューティング
### よくあるエラーと対処法
- 手作業で起こりうるエラーやミスとその対処法
- データ不整合が起きた場合の対処

### エスカレーション
- 問題が解決しない場合の連絡先
- 報告すべき情報

## 5. 実行後の確認
- 業務が正常に完了したかの確認方法
- 出力ファイルや結果データの確認場所
- 次の業務や後続処理への引き継ぎ事項

## 6. 補足・参考情報
- PA/PAD復旧後の対応
- この業務の背景や重要性
- 手作業で実行する際の効率化のヒント

**記述時の重要ルール:**
- PA/PADの専門用語は使わず、一般的なPC操作用語を使用
- 「フローを実行」ではなく、具体的な業務操作（「ファイルを開く」「データを入力」など）を記載
- 各ステップには具体的な画面名、ボタン名、フィールド名、ファイル名を含める
- スクリーンショットを撮るべき箇所には「📷 スクリーンショット推奨」と記載
- 時間がかかる処理には「⏱ 処理時間: 約X分」と記載
- 重要な注意事項には「⚠️」マークを付ける
- 手作業で実行する際の「コツ」や「注意点」を具体的に記載

日本語で、わかりやすく丁寧に記述してください。
`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたは業務マニュアル作成の専門家です。Power AutomateやPower Automate Desktopのアクション情報を分析し、それらが自動化していた業務を、PA/PADを使わずに人間が手作業で実行するための詳細な手順書を作成してください。技術者でない一般ユーザーでも理解できる表現を使い、各ステップには必ずAI解説を含めて、ユーザーが安心して作業できるよう配慮してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`ユーザーガイド生成中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * サービスの動作確認
   */
  async healthCheck() {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 10
      });

      return {
        status: 'healthy',
        model: this.model,
        response: response.choices[0].message.content
      };

    } catch (error) {
      console.error('OpenAI health check error:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  // ★ここから追記★
  /**
   * AIが生成した手順書テキストをCSV形式に変換する（BOM付き）
   * 日本のExcelでの文字化けを防止します。
   */
  convertToCSV(aiResponseText) {
    // 1. AIの回答を簡易的にパースして行データを作成
    const rows = [["項目", "内容"]]; // CSVのヘッダー

    const lines = aiResponseText.split('\n');
    let currentCategory = "全般";

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 「#」「##」「###」で始まる行を項目名（カテゴリ）として扱う
      if (trimmedLine.startsWith('#')) {
        currentCategory = trimmedLine.replace(/#/g, '').trim();
      } else {
        // 内容を項目に紐づけて追加
        rows.push([currentCategory, trimmedLine]);
      }
    });

    // 2. CSV文字列の生成（カンマ区切り・ダブルクォート囲み）
    const csvString = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    // 3. 日本語Excel用：BOM（Byte Order Mark）の付与
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    
    // BOMとCSV文字列を結合したデータを返す
    return Buffer.concat([bom, Buffer.from(csvString)]);
  }

}



module.exports = OpenAIService;