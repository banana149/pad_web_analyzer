/**
 * Mermaidフローチャート生成サービス（ルールベース）
 * AIを使わず、完全に決定論的にMermaidコードを生成
 */

class MermaidGenerator {
  constructor() {
    this.nodeCounter = 0;
    this.nodeDetailsMap = {}; // ノードIDと詳細情報のマッピング
  }

  /**
   * アクション種類に応じたノード形状を返す
   * @param {String} actionType - アクション種類
   * @param {String} label - ラベル
   * @returns {String} - Mermaid形式のノード定義
   */
  _getNodeShape(actionType, actionName, label) {
    // ラベルをサニタイズ（改行を<br/>に変換してMermaid互換にする）
    const sanitizedLabel = this._sanitizeLabel(label).replace(/\\n/g, '<br/>');

    // actionTypeとactionNameの両方をチェック（actionNameに詳細情報が入っている場合がある）
    const typeInfo = `${actionType || ''} ${actionName || ''}`;

    // 条件分岐系 - ダイアモンド型
    if (typeInfo.includes('If') ||
        typeInfo.includes('条件') ||
        typeInfo.includes('Switch') ||
        typeInfo.includes('Case')) {
      return `{"${sanitizedLabel}"}`;
    }

    // ループ系 - ヘキサゴン型
    if (typeInfo.includes('Loop') ||
        typeInfo.includes('ForEach') ||
        typeInfo.includes('For each') ||
        typeInfo.includes('While') ||
        typeInfo.includes('Until') ||
        typeInfo.includes('ループ') ||
        typeInfo.includes('繰り返し')) {
      return `{{"${sanitizedLabel}"}}`;
    }

    // エラー/例外系 - シリンダー型
    if (typeInfo.includes('Error') ||
        typeInfo.includes('Exception') ||
        typeInfo.includes('エラー') ||
        typeInfo.includes('例外')) {
      return `[("${sanitizedLabel}")]`;
    }

    // 通常のアクション - 矩形
    return `["${sanitizedLabel}"]`;
  }

  /**
   * 構造化データからMermaidフローチャートを生成（メインメソッド）
   * レイアウト: メインフローを縦一列、サブフローは横ズレして縦展開
   * @param {Array} structuredData - _createStructuredFlowDataの出力
   * @param {String} solutionType - 'PA' or 'PAD' or 'MIXED'
   * @returns {String} Mermaidコード
   */
  generateFlowchart(structuredData, solutionType = 'PAD') {
    this.nodeCounter = 0;
    this.nodeDetailsMap = {}; // 詳細情報マップをリセット
    const lines = [];

    // ヘッダー（縦方向レイアウト）
    lines.push('flowchart TD');
    lines.push('    Start(["開始"]) --> Init["初期設定"]');

    // 各フローを処理
    for (let flowIndex = 0; flowIndex < structuredData.length; flowIndex++) {
      const flow = structuredData[flowIndex];
      const flowLines = this._generateFlowNodesBranching(flow, flowIndex);
      lines.push(...flowLines);
    }

    // 終了ノード
    const lastNode = this._getLastNodeId();
    lines.push(`    ${lastNode} --> End1(["終了"])`);

    return {
      mermaidCode: lines.join('\n'),
      nodeDetailsMap: this.nodeDetailsMap
    };
  }

  /**
   * 1つのフローからノードを生成（分岐レイアウト版）
   * メインフローを縦一列、サブフローは横ズレして縦展開
   */
  _generateFlowNodesBranching(flow, flowIndex) {
    const lines = [];
    const subflows = flow.subflows || [];

    // 前のメインフローノードID
    let prevMainNodeId = 'Init';

    // 各サブフローを処理
    for (let i = 0; i < subflows.length; i++) {
      const subflow = subflows[i];
      const mainCallNodeId = `Main${i + 1}`;
      const subflowLabel = this._sanitizeLabel(subflow.name);

      // メインフローの呼び出しノード
      lines.push(`    ${prevMainNodeId} --> ${mainCallNodeId}["${subflowLabel}"]`);

      // サブフローを右側に分岐して縦展開
      if (subflow.actionCount > 0) {
        const subflowLines = this._generateBranchingSubflow(subflow, i + 1, mainCallNodeId);
        lines.push(...subflowLines);
      }

      prevMainNodeId = mainCallNodeId;
    }

    // 最終処理
    if (subflows.length > 0) {
      lines.push(`    ${prevMainNodeId} --> Finish["終了処理"]`);
      this.lastNodeId = 'Finish';
    } else {
      this.lastNodeId = prevMainNodeId;
    }

    return lines;
  }

  /**
   * サブフローを分岐レイアウトで生成（メインから右にズレて縦展開）
   * @param {Object} subflow - サブフローオブジェクト
   * @param {Number} index - サブフローのインデックス
   * @param {String} mainNodeId - メインフローのノードID
   * @returns {Array} Mermaidコード行の配列
   */
  _generateBranchingSubflow(subflow, index, mainNodeId) {
    const lines = [];
    const subPrefix = `S${index}`;

    // サブフローの開始ノード（メインから右に分岐）
    const subStartId = `${subPrefix}_Start`;
    lines.push(`    ${mainNodeId} -.-> ${subStartId}["⇒ 開始"]`);

    // サブフロー内のアクション数を決定（最大10個）- 中解像度版
    const maxActions = Math.min(subflow.actionSequence.length, 10);
    const actions = subflow.actionSequence.slice(0, maxActions);

    let currentNodeId = subStartId;

    // 各アクションを処理（縦に展開）
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nodeId = `${subPrefix}_A${i + 1}`;
      const actionLabel = this._sanitizeLabel(action.type || action.name || '処理');

      // 外部アプリ連携がある場合はラベルに追加
      let fullLabel = actionLabel;
      if (action.externalApp) {
        fullLabel = `${actionLabel}\\n(${this._sanitizeLabel(action.externalApp)})`;
      }

      // ノード形状を決定（actionTypeとactionNameの両方を渡す）
      const nodeShape = this._getNodeShape(action.type, action.name, fullLabel);

      // 詳細情報を保存
      this.nodeDetailsMap[nodeId] = {
        actionType: action.type || '処理',
        actionName: action.name || '',
        externalApp: action.externalApp || '',
        label: fullLabel,
        actionIndex: action.originalIndex !== null && action.originalIndex !== undefined ? action.originalIndex + 1 : null // 1始まりの番号
      };

      lines.push(`    ${currentNodeId} --> ${nodeId}${nodeShape}`);
      currentNodeId = nodeId;
    }

    // サブフロー内の処理パターンを反映
    if (subflow.patterns.hasCondition && actions.length > 0) {
      const condId = `${subPrefix}_Cond`;
      const trueId = `${subPrefix}_T`;
      const falseId = `${subPrefix}_F`;
      const mergeId = `${subPrefix}_Merge`;

      lines.push(`    ${currentNodeId} --> ${condId}{"条件"}`);
      lines.push(`    ${condId} -->|Yes| ${trueId}["処理A"]`);
      lines.push(`    ${condId} -->|No| ${falseId}["処理B"]`);
      lines.push(`    ${trueId} --> ${mergeId}["結合"]`);
      lines.push(`    ${falseId} --> ${mergeId}`);
      currentNodeId = mergeId;
    }

    if (subflow.patterns.hasLoop && actions.length > 0) {
      const loopId = `${subPrefix}_Loop`;
      const checkId = `${subPrefix}_Chk`;

      lines.push(`    ${currentNodeId} --> ${loopId}["ループ"]`);
      lines.push(`    ${loopId} --> ${checkId}{"継続?"}`);
      lines.push(`    ${checkId} -->|Yes| ${loopId}`);
      lines.push(`    ${checkId} -->|No| ${subPrefix}_End`);
      currentNodeId = checkId;
    } else {
      // サブフロー終了
      lines.push(`    ${currentNodeId} --> ${subPrefix}_End["⇒ 終了"]`);
    }

    lines.push(``); // 空行で区切り

    return lines;
  }

  /**
   * 旧メソッド（下位互換のため残す）
   */
  _generateFlowNodesHorizontal(flow, flowIndex) {
    return this._generateFlowNodesBranching(flow, flowIndex);
  }

  _generateFlowNodes(flow, flowIndex) {
    return this._generateFlowNodesBranching(flow, flowIndex);
  }

  /**
   * サブフローの詳細をsubgraphで生成（横展開版）
   * メインフローノードから右側に横展開
   * @param {Object} subflow - サブフローオブジェクト
   * @param {Number} index - サブフローのインデックス
   * @param {String} mainCallNodeId - メインフローの呼び出しノードID
   * @returns {Array} Mermaidコード行の配列
   */
  _generateHorizontalSubgraph(subflow, index, mainCallNodeId) {
    const lines = [];
    const subgraphId = `Sub${index}`;
    const subflowLabel = this._sanitizeLabel(subflow.name);

    // subgraph開始
    lines.push(``);
    lines.push(`    subgraph ${subgraphId}["${subflowLabel}"]`);
    lines.push(`        direction TB`); // サブフロー内は縦方向

    // サブフロー内のアクション数を決定（最大12個）- 中解像度版
    const maxActions = Math.min(subflow.actionSequence.length, 12);
    const actions = subflow.actionSequence.slice(0, maxActions);

    let currentNodeId = `${subgraphId}_Start`;
    lines.push(`        ${currentNodeId}["開始"]`);

    // 各アクションを処理
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nodeId = `${subgraphId}_A${i + 1}`;
      const actionLabel = this._sanitizeLabel(action.type || action.name || '処理');

      // 外部アプリ連携がある場合はラベルに追加
      let fullLabel = actionLabel;
      if (action.externalApp) {
        fullLabel = `${actionLabel}<br/>(${this._sanitizeLabel(action.externalApp)})`;
      }

      lines.push(`        ${currentNodeId} --> ${nodeId}["${fullLabel}"]`);
      currentNodeId = nodeId;
    }

    // サブフロー内の処理パターンを反映
    if (subflow.patterns.hasCondition && actions.length > 0) {
      const conditionNodeId = `${subgraphId}_Cond`;
      const trueNodeId = `${subgraphId}_True`;
      const falseNodeId = `${subgraphId}_False`;
      const mergeNodeId = `${subgraphId}_Merge`;

      lines.push(`        ${currentNodeId} --> ${conditionNodeId}{"条件"}`);
      lines.push(`        ${conditionNodeId} -->|"Yes"| ${trueNodeId}["処理A"]`);
      lines.push(`        ${conditionNodeId} -->|"No"| ${falseNodeId}["処理B"]`);
      lines.push(`        ${trueNodeId} --> ${mergeNodeId}["結合"]`);
      lines.push(`        ${falseNodeId} --> ${mergeNodeId}`);
      currentNodeId = mergeNodeId;
    }

    if (subflow.patterns.hasLoop && actions.length > 0) {
      const loopNodeId = `${subgraphId}_Loop`;
      const loopCheckId = `${subgraphId}_Check`;

      lines.push(`        ${currentNodeId} --> ${loopNodeId}["ループ"]`);
      lines.push(`        ${loopNodeId} --> ${loopCheckId}{"継続?"}`);
      lines.push(`        ${loopCheckId} -->|"Yes"| ${loopNodeId}`);
      lines.push(`        ${loopCheckId} -->|"No"| ${subgraphId}_End`);
      currentNodeId = loopCheckId;
    } else {
      // ループがない場合は終了ノードへ
      lines.push(`        ${currentNodeId} --> ${subgraphId}_End["終了"]`);
    }

    lines.push(`    end`);

    // メインフローからサブフローへの接続
    lines.push(`    ${mainCallNodeId} -.-> ${subgraphId}_Start`);

    return lines;
  }

  /**
   * サブフローの詳細をsubgraphで生成（詳細版・旧レイアウト）
   * @param {Object} subflow - サブフローオブジェクト
   * @param {Number} index - サブフローのインデックス
   * @param {String} prevNodeId - 前のノードID
   * @returns {Array} Mermaidコード行の配列
   */
  _generateDetailedSubgraph(subflow, index, prevNodeId) {
    const lines = [];
    const subgraphId = `Sub${index}`;
    const subflowLabel = this._sanitizeLabel(subflow.name);

    // subgraph開始
    lines.push(``);
    lines.push(`    ${prevNodeId} --> ${subgraphId}_Start`);
    lines.push(`    subgraph ${subgraphId}["${subflowLabel}"]`);

    // サブフロー内のアクション数を決定（最大12個）- 中解像度版
    const maxActions = Math.min(subflow.actionSequence.length, 12);
    const actions = subflow.actionSequence.slice(0, maxActions);

    let currentNodeId = `${subgraphId}_Start`;
    lines.push(`        ${currentNodeId}["開始"]`);

    // 各アクションを処理
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nodeId = `${subgraphId}_${i + 1}`;
      const actionLabel = this._sanitizeLabel(action.type || action.name || '処理');

      // 外部アプリ連携がある場合はラベルに追加
      let fullLabel = actionLabel;
      if (action.externalApp) {
        fullLabel = `${actionLabel} (${this._sanitizeLabel(action.externalApp)})`;
      }

      lines.push(`        ${currentNodeId} --> ${nodeId}["${fullLabel}"]`);
      currentNodeId = nodeId;
    }

    // サブフロー内の処理パターンを反映
    if (subflow.patterns.hasCondition && actions.length > 0) {
      const conditionNodeId = `${subgraphId}_Condition`;
      const trueNodeId = `${subgraphId}_True`;
      const falseNodeId = `${subgraphId}_False`;
      const mergeNodeId = `${subgraphId}_Merge`;

      lines.push(`        ${currentNodeId} --> ${conditionNodeId}{"条件分岐"}`);
      lines.push(`        ${conditionNodeId} -->|"Yes"| ${trueNodeId}["処理A"]`);
      lines.push(`        ${conditionNodeId} -->|"No"| ${falseNodeId}["処理B"]`);
      lines.push(`        ${trueNodeId} --> ${mergeNodeId}["結合"]`);
      lines.push(`        ${falseNodeId} --> ${mergeNodeId}`);
      currentNodeId = mergeNodeId;
    }

    if (subflow.patterns.hasLoop && actions.length > 0) {
      const loopNodeId = `${subgraphId}_Loop`;
      const loopCheckId = `${subgraphId}_LoopCheck`;

      lines.push(`        ${currentNodeId} --> ${loopNodeId}["ループ処理"]`);
      lines.push(`        ${loopNodeId} --> ${loopCheckId}{"継続?"}`);
      lines.push(`        ${loopCheckId} -->|"Yes"| ${loopNodeId}`);
      lines.push(`        ${loopCheckId} -->|"No"| ${subgraphId}_End`);
      currentNodeId = loopCheckId;
    } else {
      // ループがない場合は終了ノードへ
      lines.push(`        ${currentNodeId} --> ${subgraphId}_End["終了"]`);
    }

    // エラー処理がある場合
    if (subflow.patterns.hasError && !subflow.patterns.hasLoop) {
      const errorNodeId = `${subgraphId}_Error`;
      lines.push(`        ${currentNodeId} -.->|"エラー"| ${errorNodeId}["エラー処理"]`);
      lines.push(`        ${errorNodeId} --> ${subgraphId}_End`);
    }

    lines.push(`    end`);

    return lines;
  }

  /**
   * 旧メソッド（下位互換のため残す）
   */
  _generateSubgraph(subflow, index) {
    return this._generateDetailedSubgraph(subflow, index, 'Init');
  }

  /**
   * ラベル文字列のサニタイズ（改善版）
   */
  _sanitizeLabel(label) {
    if (!label) return '処理';

    return label
      .replace(/"/g, "'")           // ダブルクォートをシングルクォートに
      .replace(/\[/g, '(')          // [を(に
      .replace(/\]/g, ')')          // ]を)に
      .replace(/\{/g, '(')          // {を(に
      .replace(/\}/g, ')')          // }を)に
      .replace(/\n/g, ' ')          // 改行を空白に
      .replace(/\r/g, '')           // キャリッジリターンを削除
      .trim()                       // 前後の空白を削除
      .substring(0, 40);            // 最大40文字（30→40に拡張）
  }

  /**
   * 最後のノードIDを取得
   */
  _getLastNodeId() {
    return this.lastNodeId || 'Init';
  }

  /**
   * 構造化データを作成（OpenAIServiceから移植）
   */
  createStructuredFlowData(actions) {
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

          // アクション種類を集計（実行順序を保持、最大15件）- 中解像度版
          // 元のアクション配列のインデックスも保存
          const actionSequence = subflowActions.slice(0, 15).map(a => {
            const originalIndex = actions.indexOf(a); // 元の配列でのインデックス
            return {
              type: a.アクション種類 || '処理',
              name: this._sanitizeActionName(a.アクション名 || ''),
              externalApp: a.外部アプリケーション名 || null,
              originalIndex: originalIndex >= 0 ? originalIndex : null // 一覧表示の番号（0始まり）
            };
          });

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
   * アクション名をサニタイズ
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
}

module.exports = MermaidGenerator;
