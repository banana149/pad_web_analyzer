/**
 * Power Automate (クラウドフロー) と Power Automate Desktop の統合解析クラス
 */

const JSZip = require('jszip');
const xml2js = require('xml2js');
const fs = require('fs-extra');
const PADActionExtractor = require('./padExtractor');

class PowerAutomateAnalyzer {
  constructor() {
    this.solutionType = null; // 'PA' or 'PAD'
    this.padExtractor = new PADActionExtractor();
  }

  /**
   * ZIPファイルを解析（自動判定）
   */
  async analyzeFromZipFile(zipFilePath) {
    try {
      const zipData = await fs.readFile(zipFilePath);
      const zip = await JSZip.loadAsync(zipData);

      // PAかPADかを判定（ZIPフォルダ構造で判定）
      this.solutionType = await this._detectSolutionType(zip);
      console.log(`Detected solution type: ${this.solutionType}`);

      let allActions = [];

      // PAクラウドフローの解析
      if (this.solutionType === 'PA' || this.solutionType === 'MIXED') {
        console.log('Analyzing PA cloud flows...');
        const paActions = await this._analyzeCloudFlow(zip);

        // 各アクションにフロータイプを追加
        paActions.forEach(action => {
          action['フロータイプ'] = 'PA';
        });

        console.log(`PA actions extracted: ${paActions.length}`);
        allActions.push(...paActions);
      }

      // PADデスクトップフローの解析
      if (this.solutionType === 'PAD' || this.solutionType === 'MIXED') {
        console.log('Analyzing PAD desktop flows...');
        const padActions = await this.padExtractor.extractFromZipFile(zipFilePath);

        // 各アクションにフロータイプを追加
        padActions.forEach(action => {
          action['フロータイプ'] = 'PAD';
        });

        console.log(`PAD actions extracted: ${padActions.length}`);
        allActions.push(...padActions);
      }

      console.log(`Total actions extracted: ${allActions.length}`);

      return {
        solutionType: this.solutionType,
        actions: allActions
      };

    } catch (error) {
      console.error('Analysis error:', error);
      throw new Error(`解析中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * PAかPADかを判定（ZIPフォルダ構造で判定）
   * 戻り値: 'PA', 'PAD', 'MIXED'
   */
  async _detectSolutionType(zip) {
    try {
      console.log('=== Solution Type Detection ===');

      // ZIP内の全ファイル・フォルダパスを取得
      const allPaths = [];
      zip.forEach((relativePath, file) => {
        allPaths.push(relativePath);
      });

      console.log('All ZIP paths:', allPaths);

      // PAクラウドフローの存在チェック (Workflows/ フォルダ)
      const hasPAWorkflows = allPaths.some(path =>
        path.toLowerCase().includes('workflows/') && path.toLowerCase().endsWith('.json')
      );

      // PADデスクトップフローの存在チェック (desktopflowbinaries フォルダ)
      const hasPADFlows = allPaths.some(path =>
        path.toLowerCase().includes('desktopflowbinaries')
      );

      console.log(`PA Workflows check: ${hasPAWorkflows}`);
      console.log(`PAD Desktop flows check: ${hasPADFlows}`);

      // 両方存在する場合はMIXED
      if (hasPAWorkflows && hasPADFlows) {
        console.log('Detected as MIXED (both PA and PAD found)');
        return 'MIXED';
      }
      // PADのみ
      else if (hasPADFlows) {
        console.log('Detected as PAD (desktopflowbinaries found)');
        return 'PAD';
      }
      // PAのみ
      else {
        console.log('Detected as PA (workflows found or default)');
        return 'PA';
      }

    } catch (error) {
      console.error('Detection error:', error);
      return 'PAD';
    }
  }

  /**
   * Power Automate (クラウドフロー) の解析
   */
  async _analyzeCloudFlow(zip) {
    const actions = [];

    try {
      console.log('Analyzing PA cloud flows from workflows folder...');

      // workflowsフォルダ内のJSONファイルを探す
      const workflowFiles = [];
      zip.forEach((relativePath, file) => {
        const lowerPath = relativePath.toLowerCase();
        // workflowsフォルダ内の.jsonファイルを検出
        if (lowerPath.includes('workflows/') && lowerPath.endsWith('.json')) {
          console.log(`Found workflow file: ${relativePath}`);
          workflowFiles.push({ path: relativePath, file: file });
        }
      });

      console.log(`Total workflow JSON files found: ${workflowFiles.length}`);

      if (workflowFiles.length === 0) {
        console.warn('No workflow JSON files found in ZIP');
        return actions;
      }

      for (const { path, file } of workflowFiles) {
        try {
          console.log(`Reading file: ${path}`);
          const jsonContent = await file.async('text');
          console.log(`File content length: ${jsonContent.length}`);

          const flowDef = JSON.parse(jsonContent);
          console.log(`Parsed JSON for: ${path}`);

          // ファイル名からフロー名を取得
          const flowName = path.split('/').pop().replace('.json', '');
          console.log(`Extracting actions for flow: ${flowName}`);

          const flowActions = this._parseCloudFlowDefinition(flowName, flowDef);
          console.log(`Extracted ${flowActions.length} actions from ${flowName}`);
          actions.push(...flowActions);
        } catch (error) {
          console.error(`Flow parsing error for ${path}:`, error.message);
          console.error(error.stack);
        }
      }

      console.log(`Total actions extracted from all flows: ${actions.length}`);
      return actions;
    } catch (error) {
      console.error('Cloud flow analysis error:', error);
      return [];
    }
  }

  /**
   * クラウドフローの定義を解析
   */
  _parseCloudFlowDefinition(flowName, flowDef) {
    const actions = [];

    try {
      console.log(`=== Parsing flow definition for: ${flowName} ===`);
      console.log('Flow definition keys:', Object.keys(flowDef));

      // JSONの構造を確認
      let definition = null;

      // パターン1: flowDef.properties.definition
      if (flowDef.properties && flowDef.properties.definition) {
        console.log('Found definition in flowDef.properties.definition');
        definition = flowDef.properties.definition;
      }
      // パターン2: flowDef自体がdefinition
      else if (flowDef.triggers || flowDef.actions) {
        console.log('flowDef itself contains triggers/actions');
        definition = flowDef;
      }
      // パターン3: flowDef.definition
      else if (flowDef.definition) {
        console.log('Found definition in flowDef.definition');
        definition = flowDef.definition;
      }

      if (!definition) {
        console.warn(`No valid definition structure found for ${flowName}`);
        console.log('Full flowDef structure:', JSON.stringify(flowDef, null, 2).substring(0, 500));
        return actions;
      }

      console.log('Definition keys:', Object.keys(definition));

      // トリガーを解析
      if (definition.triggers) {
        console.log('Processing triggers:', Object.keys(definition.triggers));
        for (const [triggerName, trigger] of Object.entries(definition.triggers)) {
          actions.push({
            'フロー名': flowName,
            'サブフロー名': 'トリガー',
            'アクション名': triggerName,
            'アクション種類': 'トリガー',
            '外部アプリケーション名': this._getConnectorName(trigger.type),
            '接続情報': trigger.inputs?.host?.connectionName || '',
            '変数名': '',
            'アクション内容': JSON.stringify(trigger, null, 2),
            '参照情報': `Type: ${trigger.type}`,
            '備考': trigger.description || ''
          });
        }
        console.log(`Extracted ${Object.keys(definition.triggers).length} triggers`);
      } else {
        console.log('No triggers found in definition');
      }

      // アクション
      if (definition.actions) {
        console.log('Processing actions:', Object.keys(definition.actions));
        this._extractActionsRecursive(flowName, definition.actions, actions, '');
        console.log(`Total actions after extraction: ${actions.length}`);
      } else {
        console.log('No actions found in definition');
      }

    } catch (error) {
      console.error('Flow definition parsing error:', error);
      console.error(error.stack);
    }

    console.log(`=== Completed parsing ${flowName}: ${actions.length} total actions ===`);
    return actions;
  }

  /**
   * アクションを再帰的に抽出（ループや条件分岐に対応）
   */
  _extractActionsRecursive(flowName, actionsObj, resultArray, parentPath) {
    const actionCount = Object.keys(actionsObj).length;
    console.log(`_extractActionsRecursive called: ${actionCount} actions at path "${parentPath}"`);

    // runAfterに基づいて実行順序でソート
    const sortedActions = this._sortActionsByRunAfter(actionsObj);
    console.log(`Sorted actions order:`, sortedActions.map(a => a[0]));

    for (const [actionName, action] of sortedActions) {
      const currentPath = parentPath ? `${parentPath} > ${actionName}` : actionName;
      console.log(`Processing action: ${actionName} (type: ${action.type})`);

      // 基本アクション情報
      const actionInfo = {
        'フロー名': flowName,
        'サブフロー名': parentPath || 'メインフロー',
        'アクション名': actionName,
        'アクション種類': this._getActionType(action),
        '外部アプリケーション名': this._getConnectorName(action.type),
        '接続情報': action.inputs?.host?.connectionName || '',
        '変数名': this._extractOutputVariables(action),
        'アクション内容': this._formatActionContent(action),
        '参照情報': `Type: ${action.type}`,
        '備考': action.description || action.metadata?.operationMetadataId || ''
      };

      resultArray.push(actionInfo);
      console.log(`Added action to result: ${actionName}`);

      // ネストされたアクション（条件分岐、ループなど）を処理
      if (action.actions) {
        console.log(`Found nested actions in ${actionName}`);
        this._extractActionsRecursive(flowName, action.actions, resultArray, currentPath);
      }

      // Foreach ループの中のアクション
      if (action.foreach && typeof action.foreach === 'object') {
        const foreachActions = action.foreach.actions || action.actions;
        if (foreachActions) {
          console.log(`Found foreach actions in ${actionName}`);
          this._extractActionsRecursive(flowName, foreachActions, resultArray, `${currentPath} (ForEach)`);
        }
      }

      // If条件分岐（条件式も抽出）
      if (action.cases) {
        console.log(`Found cases in ${actionName}`);
        // 条件式を抽出
        const expression = this._extractConditionExpression(action);
        if (expression) {
          console.log(`Condition expression: ${expression}`);
        }

        for (const [caseName, caseObj] of Object.entries(action.cases)) {
          if (caseObj.actions) {
            this._extractActionsRecursive(flowName, caseObj.actions, resultArray, `${currentPath} > ${caseName}`);
          }
        }
      }

      // Switch文（条件式も抽出）
      if (action.cases || action.default) {
        const expression = this._extractSwitchExpression(action);
        if (expression) {
          console.log(`Switch expression: ${expression}`);
        }
      }

      if (action.default && action.default.actions) {
        console.log(`Found default case in ${actionName}`);
        this._extractActionsRecursive(flowName, action.default.actions, resultArray, `${currentPath} > Default`);
      }
    }

    console.log(`Completed extraction at path "${parentPath}": ${resultArray.length} total actions so far`);
  }

  /**
   * runAfterに基づいてアクションを実行順序でソート
   */
  _sortActionsByRunAfter(actionsObj) {
    const actionEntries = Object.entries(actionsObj);
    const sorted = [];
    const processed = new Set();
    const graph = {};

    // 依存関係グラフを構築
    for (const [name, action] of actionEntries) {
      graph[name] = {
        action: action,
        dependencies: action.runAfter ? Object.keys(action.runAfter) : []
      };
    }

    // トポロジカルソート（DFS）
    const visit = (name) => {
      if (processed.has(name)) return;
      processed.add(name);

      const node = graph[name];
      if (node) {
        // 依存先を先に処理
        for (const dep of node.dependencies) {
          if (graph[dep]) {
            visit(dep);
          }
        }
        sorted.push([name, node.action]);
      }
    };

    // runAfterがないアクション（最初のアクション）から開始
    for (const [name, action] of actionEntries) {
      if (!action.runAfter || Object.keys(action.runAfter).length === 0) {
        visit(name);
      }
    }

    // 残りのアクションを処理
    for (const [name] of actionEntries) {
      visit(name);
    }

    return sorted;
  }

  /**
   * If条件分岐の条件式を抽出
   */
  _extractConditionExpression(action) {
    if (action.expression) {
      return JSON.stringify(action.expression, null, 2);
    }
    return '';
  }

  /**
   * Switch文の条件式を抽出
   */
  _extractSwitchExpression(action) {
    if (action.expression) {
      return JSON.stringify(action.expression, null, 2);
    }
    return '';
  }

  /**
   * アクション種類を取得
   */
  _getActionType(action) {
    const type = action.type || '';

    if (type.includes('Scope')) return 'スコープ';
    if (type.includes('Foreach')) return 'ForEachループ';
    if (type.includes('Until')) return 'Untilループ';
    if (type.includes('If')) return '条件分岐';
    if (type.includes('Switch')) return 'Switch文';
    if (type.includes('Compose')) return 'データ作成';
    if (type.includes('Query')) return 'クエリ';
    if (type.includes('Select')) return '選択';
    if (type.includes('Filter')) return 'フィルター';
    if (type.includes('Join')) return '結合';
    if (type.includes('Parse')) return 'JSON解析';
    if (type.includes('Response')) return '応答';
    if (type.includes('Http')) return 'HTTP';
    if (type.includes('ApiConnection')) return 'コネクタアクション';
    if (type.includes('Workflow')) return 'ワークフロー呼び出し';
    if (type.includes('Wait')) return '待機';
    if (type.includes('Terminate')) return '終了';

    return type;
  }

  /**
   * コネクタ名を取得
   */
  _getConnectorName(type) {
    if (!type) return '';

    const lowerType = type.toLowerCase();

    if (lowerType.includes('sharepoint')) return 'SharePoint';
    if (lowerType.includes('teams')) return 'Microsoft Teams';
    if (lowerType.includes('outlook')) return 'Outlook';
    if (lowerType.includes('excel')) return 'Excel Online';
    if (lowerType.includes('onedrive')) return 'OneDrive';
    if (lowerType.includes('dataverse')) return 'Dataverse';
    if (lowerType.includes('sql')) return 'SQL Server';
    if (lowerType.includes('http')) return 'HTTP';
    if (lowerType.includes('office365')) return 'Office 365';
    if (lowerType.includes('approval')) return 'Approvals';

    if (type.includes('ApiConnection')) {
      // ApiConnection の場合、inputs.host.apiId から取得を試みる
      return 'コネクタ';
    }

    return '';
  }

  /**
   * 出力変数を抽出
   */
  _extractOutputVariables(action) {
    const variables = [];

    if (action.runAfter) {
      // runAfterで参照している変数
      variables.push(...Object.keys(action.runAfter));
    }

    // outputsが存在する場合
    if (action.outputs) {
      variables.push('outputs');
    }

    return variables.join(', ');
  }

  /**
   * アクション内容をフォーマット
   */
  _formatActionContent(action) {
    const content = [];

    // Type
    content.push(`Type: ${action.type}`);

    // 条件式（If、Switch）
    if (action.expression) {
      content.push(`\n【条件式】`);
      content.push(JSON.stringify(action.expression, null, 2));
    }

    // Inputs (簡潔に)
    if (action.inputs) {
      const inputs = { ...action.inputs };

      // 長すぎる値は省略
      for (const key in inputs) {
        if (typeof inputs[key] === 'string' && inputs[key].length > 100) {
          inputs[key] = inputs[key].substring(0, 100) + '...';
        } else if (typeof inputs[key] === 'object' && JSON.stringify(inputs[key]).length > 200) {
          inputs[key] = '[Object - 省略]';
        }
      }

      content.push(`\n【入力パラメータ】`);
      content.push(JSON.stringify(inputs, null, 2));
    }

    // Switch の Cases
    if (action.cases) {
      content.push(`\n【分岐ケース】`);
      const caseNames = Object.keys(action.cases);
      content.push(`Cases: ${caseNames.join(', ')}`);
    }

    // RunAfter（実行順序）
    if (action.runAfter && Object.keys(action.runAfter).length > 0) {
      content.push(`\n【実行順序】`);
      const runAfterDetails = Object.entries(action.runAfter).map(([name, statuses]) => {
        const statusList = Array.isArray(statuses) ? statuses.join(', ') : JSON.stringify(statuses);
        return `${name} (${statusList})`;
      });
      content.push(runAfterDetails.join('\n'));
    }

    // Foreach の対象
    if (action.foreach) {
      content.push(`\n【繰り返し対象】`);
      content.push(typeof action.foreach === 'string' ? action.foreach : JSON.stringify(action.foreach, null, 2));
    }

    return content.join('\n');
  }
}

module.exports = PowerAutomateAnalyzer;
