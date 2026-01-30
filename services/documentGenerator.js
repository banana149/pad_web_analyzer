/**
 * 統合ドキュメント生成サービス
 * タブ形式のHTMLドキュメントを生成
 */

class DocumentGenerator {
  constructor() {
    this.documentTitle = 'Power Automate 解析レポート';
  }

  /**
   * 統合ドキュメントを生成
   */
  generateDocument(sessionData) {
    console.log('=== DocumentGenerator.generateDocument called ===');
    console.log('Session data keys:', Object.keys(sessionData));

    const {
      filename,
      solution_type,
      actions,
      summary,
      requirements,
      system_flowchart
    } = sessionData;

    console.log(`Filename: ${filename}`);
    console.log(`Solution type: ${solution_type}`);
    console.log(`Actions count: ${actions ? actions.length : 0}`);
    console.log(`Has requirements: ${!!requirements}`);
    console.log(`Has system_flowchart: ${!!system_flowchart}`);

    // タブの有効/無効を判定
    const hasRequirements = !!requirements;
    const hasAIFlowchart = !!system_flowchart;

    // 詳細フロー図を生成（PADアクションから）
    const detailedFlowcharts = this._generateDetailedFlowcharts(actions, solution_type);
    const hasDetailedFlowcharts = detailedFlowcharts && detailedFlowcharts.length > 0;

    console.log(`hasRequirements: ${hasRequirements}`);
    console.log(`hasAIFlowchart: ${hasAIFlowchart}`);
    console.log(`hasDetailedFlowcharts: ${hasDetailedFlowcharts}`);

    const html = this._generateHTML({
      filename,
      solution_type,
      actions,
      summary,
      requirements,
      system_flowchart,
      detailedFlowcharts,
      hasRequirements,
      hasAIFlowchart,
      hasDetailedFlowcharts
    });

    console.log('=== DocumentGenerator.generateDocument completed ===');

    return html;
  }

  /**
   * HTMLドキュメント生成
   */
  _generateHTML(data) {
    const {
      filename,
      solution_type,
      actions,
      summary,
      requirements,
      system_flowchart,
      detailedFlowcharts,
      hasRequirements,
      hasAIFlowchart,
      hasDetailedFlowcharts
    } = data;

    const solutionTypeName = this._getSolutionTypeName(solution_type);
    const currentDate = new Date().toLocaleString('ja-JP');

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._escapeHtml(filename)} - 解析レポート</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', 'Yu Gothic', 'Meiryo', sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            min-height: 100vh;
        }

        header {
            background: linear-gradient(135deg, #0078d4 0%, #106ebe 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        header h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .subtitle {
            font-size: 1rem;
            opacity: 0.9;
        }

        .tabs {
            display: flex;
            background: #2c3e50;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            overflow-x: auto;
        }

        .tab {
            padding: 1rem 1.5rem;
            color: white;
            cursor: pointer;
            border: none;
            background: transparent;
            transition: background 0.3s;
            white-space: nowrap;
            font-size: 0.95rem;
        }

        .tab:hover {
            background: #34495e;
        }

        .tab.active {
            background: #0078d4;
            border-bottom: 3px solid #fff;
        }

        .tab-content {
            display: none;
            padding: 2rem;
            animation: fadeIn 0.3s;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        h2 {
            color: #0078d4;
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 3px solid #0078d4;
        }

        h3 {
            color: #106ebe;
            font-size: 1.4rem;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }

        h4 {
            color: #555;
            font-size: 1.1rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }

        .info-card {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #0078d4;
        }

        .info-card .label {
            color: #666;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
        }

        .info-card .value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #0078d4;
        }

        .stat-badge {
            display: inline-block;
            background: #0078d4;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            margin: 0.25rem;
            font-size: 0.9rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            background: white;
        }

        th {
            background: #0078d4;
            color: white;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
        }

        td {
            padding: 0.875rem 1rem;
            border-bottom: 1px solid #ddd;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .accordion {
            margin: 1.5rem 0;
        }

        .accordion-item {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 1rem;
        }

        .accordion-header {
            background: linear-gradient(135deg, #e3f2fd, #bbdefb);
            padding: 1rem 1.5rem;
            cursor: pointer;
            font-weight: 600;
            color: #0d47a1;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .accordion-header:hover {
            background: linear-gradient(135deg, #bbdefb, #90caf9);
        }

        .accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .accordion-content.open {
            max-height: 5000px;
        }

        .accordion-body {
            padding: 1.5rem;
        }

        .subflow-section {
            margin: 1rem 0;
            border-left: 4px solid #0078d4;
            background: #f8f9fa;
            padding: 1rem;
        }

        .subflow-title {
            font-weight: 600;
            color: #0078d4;
            margin-bottom: 0.75rem;
        }

        .action-item {
            background: white;
            padding: 0.75rem 1rem;
            margin: 0.5rem 0;
            border-radius: 4px;
            border-left: 3px solid #dee2e6;
        }

        .action-item:hover {
            border-left-color: #0078d4;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-right: 0.5rem;
        }

        .badge-primary {
            background: #0078d4;
            color: white;
        }

        .badge-info {
            background: #17a2b8;
            color: white;
        }

        .badge-success {
            background: #28a745;
            color: white;
        }

        .requirements-content {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }

        .requirements-content pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: inherit;
            margin: 0;
        }

        .mermaid {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            margin: 1.5rem 0;
            overflow-x: auto;
        }

        .alert {
            padding: 1rem 1.5rem;
            border-radius: 4px;
            margin: 1rem 0;
        }

        .alert-info {
            background: #d1ecf1;
            border-left: 4px solid #0c5460;
            color: #0c5460;
        }

        .alert-warning {
            background: #fff3cd;
            border-left: 4px solid #856404;
            color: #856404;
        }

        footer {
            background: #2c3e50;
            color: white;
            padding: 2rem;
            text-align: center;
            margin-top: 3rem;
        }

        footer p {
            margin: 0.5rem 0;
            opacity: 0.8;
        }

        @media print {
            .tabs {
                display: none;
            }
            .tab-content {
                display: block !important;
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Power Automate 解析レポート</h1>
            <p class="subtitle">${this._escapeHtml(filename)}</p>
            <p class="subtitle">${solutionTypeName} | 生成日時: ${currentDate}</p>
        </header>

        <div class="tabs">
            <button class="tab active" onclick="showTab(event, 'overview')">概要</button>
            ${hasRequirements ? '<button class="tab" onclick="showTab(event, \'requirements\')">要件定義</button>' : ''}
            ${hasAIFlowchart ? '<button class="tab" onclick="showTab(event, \'ai-flowchart\')">AI生成フロー図</button>' : ''}
            ${hasDetailedFlowcharts ? '<button class="tab" onclick="showTab(event, \'detailed-flowchart\')">詳細フロー図</button>' : ''}
            <button class="tab" onclick="showTab(event, 'actions')">アクション一覧</button>
        </div>

        <!-- 概要タブ -->
        <div id="overview" class="tab-content active">
            ${this._generateOverviewSection(summary, solution_type)}
        </div>

        <!-- 要件定義タブ -->
        ${hasRequirements ? `
        <div id="requirements" class="tab-content">
            ${this._generateRequirementsSection(requirements)}
        </div>
        ` : ''}

        <!-- AI生成フロー図タブ -->
        ${hasAIFlowchart ? `
        <div id="ai-flowchart" class="tab-content">
            ${this._generateAIFlowchartSection(system_flowchart)}
        </div>
        ` : ''}

        <!-- 詳細フロー図タブ -->
        ${hasDetailedFlowcharts ? `
        <div id="detailed-flowchart" class="tab-content">
            ${this._generateDetailedFlowchartSection(detailedFlowcharts)}
        </div>
        ` : ''}

        <!-- アクション一覧タブ -->
        <div id="actions" class="tab-content">
            ${this._generateActionsSection(actions)}
        </div>

        <footer>
            <p>Power Automate 解析レポート</p>
            <p>本ドキュメントは Power Automate 解析ツールによって自動生成されました</p>
        </footer>
    </div>

    <script>
        // タブ切り替え
        function showTab(event, tabId) {
            const tabs = document.querySelectorAll('.tab');
            const contents = document.querySelectorAll('.tab-content');

            tabs.forEach(tab => tab.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));

            event.currentTarget.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        }

        // アコーディオン
        document.addEventListener('DOMContentLoaded', function() {
            const accordionHeaders = document.querySelectorAll('.accordion-header');
            accordionHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    const content = this.nextElementSibling;
                    content.classList.toggle('open');
                });
            });

            // Mermaid初期化
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                }
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * 概要セクション生成
   */
  _generateOverviewSection(summary, solutionType) {
    const solutionTypeBadge = this._getSolutionTypeBadge(solutionType);

    return `
      <h2>解析概要</h2>
      <div class="alert alert-info">
        <strong>ソリューションタイプ:</strong> ${solutionTypeBadge}
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="label">総アクション数</div>
          <div class="value">${summary.total_actions}</div>
        </div>
        ${solutionType === 'MIXED' ? `
        <div class="info-card">
          <div class="label">PA アクション</div>
          <div class="value">${summary.pa_actions}</div>
        </div>
        <div class="info-card">
          <div class="label">PAD アクション</div>
          <div class="value">${summary.pad_actions}</div>
        </div>
        ` : `
        <div class="info-card">
          <div class="label">フロー数</div>
          <div class="value">${summary.flows}</div>
        </div>
        `}
        <div class="info-card">
          <div class="label">アクション種類</div>
          <div class="value">${summary.action_types}</div>
        </div>
        <div class="info-card">
          <div class="label">外部アプリ数</div>
          <div class="value">${summary.external_apps}</div>
        </div>
      </div>
    `;
  }

  /**
   * 要件定義セクション生成
   */
  _generateRequirementsSection(requirements) {
    return `
      <h2>要件定義書</h2>
      <div class="alert alert-info">
        この要件定義書はAIによって自動生成されました。
      </div>
      <div class="requirements-content">
        <pre>${this._escapeHtml(requirements)}</pre>
      </div>
    `;
  }

  /**
   * AI生成フローチャートセクション生成
   */
  _generateAIFlowchartSection(flowchart) {
    return `
      <h2>AI生成システムフロー図</h2>
      <div class="alert alert-info">
        このフローチャートはAIによって自動生成されました。システム全体の処理フローを表現しています。
      </div>
      <div class="mermaid">
${flowchart}
      </div>
    `;
  }

  /**
   * アクション一覧セクション生成
   */
  _generateActionsSection(actions) {
    // フロー毎にグループ化
    const flowGroups = {};
    actions.forEach(action => {
      const flowName = action['フロー名'] || '不明なフロー';
      if (!flowGroups[flowName]) {
        flowGroups[flowName] = {};
      }

      const subflowName = action['サブフロー名'] || 'メインフロー';
      if (!flowGroups[flowName][subflowName]) {
        flowGroups[flowName][subflowName] = [];
      }

      flowGroups[flowName][subflowName].push(action);
    });

    let html = '<h2>アクション一覧（グループ別）</h2>';
    html += '<div class="accordion">';

    Object.keys(flowGroups).forEach(flowName => {
      const subflows = flowGroups[flowName];
      const totalActions = Object.values(subflows).reduce((sum, acts) => sum + acts.length, 0);

      html += `
        <div class="accordion-item">
          <div class="accordion-header">
            <span>📊 ${this._escapeHtml(flowName)}</span>
            <span class="stat-badge">${totalActions} アクション</span>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
      `;

      Object.keys(subflows).forEach(subflowName => {
        const acts = subflows[subflowName];
        html += `
          <div class="subflow-section">
            <div class="subflow-title">🔹 ${this._escapeHtml(subflowName)} (${acts.length}件)</div>
        `;

        acts.forEach((action, index) => {
          html += `
            <div class="action-item">
              <div>
                <strong>${index + 1}. ${this._escapeHtml(action['アクション名'] || '-')}</strong>
                <span class="badge badge-primary">${this._escapeHtml(action['アクション種類'] || '-')}</span>
                ${action['外部アプリケーション名'] ? `<span class="badge badge-info">${this._escapeHtml(action['外部アプリケーション名'])}</span>` : ''}
              </div>
              ${action['変数名'] ? `<div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">変数: ${this._escapeHtml(action['変数名'])}</div>` : ''}
            </div>
          `;
        });

        html += `
          </div>
        `;
      });

      html += `
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    return html;
  }

  /**
   * ソリューションタイプ名取得
   */
  _getSolutionTypeName(type) {
    switch(type) {
      case 'PA': return 'Power Automate (クラウドフロー)';
      case 'PAD': return 'Power Automate Desktop (デスクトップフロー)';
      case 'MIXED': return 'PA + PAD 混在';
      default: return type;
    }
  }

  /**
   * ソリューションタイプバッジ取得
   */
  _getSolutionTypeBadge(type) {
    switch(type) {
      case 'PA': return '<span class="badge badge-info">Power Automate (クラウドフロー)</span>';
      case 'PAD': return '<span class="badge badge-primary">Power Automate Desktop</span>';
      case 'MIXED': return '<span class="badge badge-success">PA + PAD 混在</span>';
      default: return type;
    }
  }

  /**
   * 詳細フロー図セクション生成
   */
  _generateDetailedFlowchartSection(detailedFlowcharts) {
    if (!detailedFlowcharts || detailedFlowcharts.length === 0) {
      return `
        <h2>詳細フロー図</h2>
        <div class="alert alert-warning">
          詳細フロー図のデータがありません。
        </div>
      `;
    }

    let html = `
      <h2>詳細フロー図（フロー別）</h2>
      <div class="alert alert-info">
        各フローの詳細な処理フローを表現しています。
      </div>
    `;

    detailedFlowcharts.forEach((flowchart, index) => {
      html += `
        <h3>${index + 1}. ${this._escapeHtml(flowchart.flowName)}</h3>
        <div class="mermaid">
${flowchart.mermaidCode}
        </div>
      `;
    });

    return html;
  }

  /**
   * 詳細フロー図データ生成（PADアクションから）
   */
  _generateDetailedFlowcharts(actions, solutionType) {
    console.log('=== _generateDetailedFlowcharts called ===');
    console.log(`Total actions: ${actions ? actions.length : 0}`);
    console.log(`Solution type: ${solutionType}`);

    if (!actions || actions.length === 0) {
      console.log('No actions provided');
      return [];
    }

    // PADアクションのみを対象にする
    // PAのアクションは除外、PADまたはMIXEDの場合は含める
    const padActions = actions.filter(action => {
      const flowType = action['フロータイプ'];
      const isPad = flowType === 'PAD' || flowType !== 'PA';
      return isPad;
    });

    console.log(`Filtered PAD actions: ${padActions.length}`);

    if (padActions.length === 0) {
      console.log('No PAD actions found');
      return [];
    }

    // フロー毎にグループ化
    const flowGroups = {};
    padActions.forEach(action => {
      const flowName = action['フロー名'] || '不明なフロー';
      if (!flowGroups[flowName]) {
        flowGroups[flowName] = [];
      }
      flowGroups[flowName].push(action);
    });

    console.log(`Flow groups: ${Object.keys(flowGroups).join(', ')}`);

    // 各フローのMermaidコードを生成
    const detailedFlowcharts = [];
    Object.keys(flowGroups).forEach(flowName => {
      const flowActions = flowGroups[flowName];
      console.log(`Generating flowchart for: ${flowName} (${flowActions.length} actions)`);

      const mermaidCode = this._generateMermaidFromActions(flowActions, flowName);

      detailedFlowcharts.push({
        flowName: flowName,
        mermaidCode: mermaidCode,
        actionCount: flowActions.length
      });
    });

    console.log(`Generated ${detailedFlowcharts.length} detailed flowcharts`);
    console.log('=== _generateDetailedFlowcharts completed ===');

    return detailedFlowcharts;
  }

  /**
   * アクションからMermaidコードを生成
   */
  _generateMermaidFromActions(actions, flowName) {
    if (!actions || actions.length === 0) {
      return 'flowchart TD\n    Start["開始"] --> End["終了"]';
    }

    let mermaidCode = 'flowchart TD\n';
    mermaidCode += '    Start(["開始"])\n';

    // サブフロー毎にグループ化
    const subflowGroups = {};
    actions.forEach(action => {
      const subflowName = action['サブフロー名'] || 'メインフロー';
      if (!subflowGroups[subflowName]) {
        subflowGroups[subflowName] = [];
      }
      subflowGroups[subflowName].push(action);
    });

    let previousNodeId = 'Start';
    let nodeCounter = 1;

    Object.keys(subflowGroups).forEach((subflowName, subflowIndex) => {
      const subflowActions = subflowGroups[subflowName];

      // サブフローの開始
      if (Object.keys(subflowGroups).length > 1) {
        const subflowNodeId = `Subflow${subflowIndex}`;
        mermaidCode += `    ${subflowNodeId}[["サブフロー: ${this._escapeMermaidLabel(subflowName)}"]]\n`;
        mermaidCode += `    ${previousNodeId} --> ${subflowNodeId}\n`;
        previousNodeId = subflowNodeId;
      }

      // アクションを処理（最大20件まで）
      const maxActions = Math.min(subflowActions.length, 20);
      for (let i = 0; i < maxActions; i++) {
        const action = subflowActions[i];
        const nodeId = `Action${nodeCounter}`;
        const actionType = action['アクション種類'] || '-';
        const actionName = action['アクション名'] || '-';

        // アクション種類に応じてノード形状を変える
        let nodeShape = '';
        if (actionType.includes('条件') || actionType.includes('判定') || actionType.includes('If')) {
          nodeShape = `{"${this._escapeMermaidLabel(actionName)}"}`;
        } else if (actionType.includes('ループ') || actionType.includes('繰り返し') || actionType.includes('Loop')) {
          nodeShape = `["🔄 ${this._escapeMermaidLabel(actionName)}"]`;
        } else if (actionType.includes('エラー') || actionType.includes('例外')) {
          nodeShape = `["⚠️ ${this._escapeMermaidLabel(actionName)}"]`;
        } else {
          nodeShape = `["${this._escapeMermaidLabel(actionName)}"]`;
        }

        mermaidCode += `    ${nodeId}${nodeShape}\n`;
        mermaidCode += `    ${previousNodeId} --> ${nodeId}\n`;
        previousNodeId = nodeId;
        nodeCounter++;
      }

      // 省略表示
      if (subflowActions.length > 20) {
        const omitNodeId = `Omit${subflowIndex}`;
        mermaidCode += `    ${omitNodeId}[\"... 他${subflowActions.length - 20}件省略\"]\n`;
        mermaidCode += `    ${previousNodeId} --> ${omitNodeId}\n`;
        previousNodeId = omitNodeId;
      }
    });

    mermaidCode += '    End(["終了"])\n';
    mermaidCode += `    ${previousNodeId} --> End\n`;

    return mermaidCode;
  }

  /**
   * Mermaidラベル用エスケープ
   */
  _escapeMermaidLabel(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, "'")       // ダブルクォートをシングルクォートに置換
      .replace(/\[/g, '(')      // [を(に置換
      .replace(/\]/g, ')')      // ]を)に置換
      .replace(/\{/g, '(')      // {を(に置換
      .replace(/\}/g, ')')      // }を)に置換
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .substring(0, 50); // 長すぎる場合は切り詰め
  }

  /**
   * HTMLエスケープ
   */
  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = DocumentGenerator;
