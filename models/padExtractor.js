/**
 * Power Automate Desktop ソリューションファイルからアクションリストを抽出するクラス
 * JavaScript版
 */

const JSZip = require('jszip');
const xml2js = require('xml2js');
const fs = require('fs-extra');

class PADActionExtractor {
  constructor() {
    this.flowName = '';
    this.subflows = [];
    this.actions = [];
    this.connections = {};
  }

  /**
   * アップロードされたZIPファイルからアクションリストを抽出
   */
  async extractFromZipFile(zipFilePath) {
    const actions = [];

    try {
      console.log('PAD extraction started for:', zipFilePath);
      const zipData = await fs.readFile(zipFilePath);
      const zip = await JSZip.loadAsync(zipData);

      // customizations.xmlを探す
      const customizationsFile = zip.file('customizations.xml');

      if (!customizationsFile) {
        console.warn('customizations.xml not found in ZIP');
        return actions;
      }

      console.log('Reading customizations.xml...');
      const xmlContent = await customizationsFile.async('text');
      console.log(`XML content length: ${xmlContent.length}`);

      const flowInfo = await this._parseCustomizationsXml(xmlContent);
      console.log(`Found ${flowInfo.length} flows in XML`);

      // フロー定義を解析
      for (const flow of flowInfo) {
        console.log(`Parsing PAD flow: ${flow.name}`);
        const flowActions = this._parseFlowDefinition(flow);
        console.log(`Extracted ${flowActions.length} actions from ${flow.name}`);
        actions.push(...flowActions);
      }

      console.log(`Total PAD actions extracted: ${actions.length}`);
      return actions;
    } catch (error) {
      console.error('ZIP file extraction error:', error);
      throw new Error(`ZIPファイルの解析中にエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * customizations.xmlからフロー情報を抽出
   */
  async _parseCustomizationsXml(xmlContent) {
    const flows = [];

    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true
      });

      const result = await parser.parseStringPromise(xmlContent);
      console.log('XML parsed successfully');

      // ワークフローを検索
      let workflows = null;
      if (result.ImportExportXml && result.ImportExportXml.Workflows) {
        workflows = result.ImportExportXml.Workflows;
        console.log('Workflows found in ImportExportXml');
      }

      if (workflows && workflows.Workflow) {
        const workflowArray = Array.isArray(workflows.Workflow) ? workflows.Workflow : [workflows.Workflow];
        console.log(`Total Workflow entries in XML: ${workflowArray.length}`);

        for (let i = 0; i < workflowArray.length; i++) {
          const workflow = workflowArray[i];
          const flowName = workflow.Name || '';
          const category = workflow.Category || '';
          const definition = workflow.Definition || '';

          console.log(`\n=== Workflow ${i + 1}/${workflowArray.length} ===`);
          console.log(`Name: ${flowName}`);
          console.log(`Category: ${category}`);
          console.log(`Definition length: ${definition.length}`);

          // Categoryでデスクトップフローかどうか確認
          const isDesktopFlow = category && category.toLowerCase().includes('desktop');
          console.log(`Is Desktop Flow: ${isDesktopFlow}`);

          // 定義が空の場合はスキップ
          if (!definition || definition.length === 0) {
            console.log(`Skipping ${flowName} - no definition`);
            continue;
          }

          // 接続情報を取得
          let connections = [];
          if (workflow.ConnectionReferences) {
            try {
              connections = JSON.parse(workflow.ConnectionReferences);
              console.log(`Connections: ${connections.length}`);
            } catch (e) {
              console.log('Connection parsing failed');
              connections = [];
            }
          }

          flows.push({
            name: flowName,
            definition: definition,
            connections: connections
          });
          console.log(`Added flow: ${flowName}`);
        }
      } else {
        console.log('No workflows found in XML');
      }

      console.log(`\nTotal flows to process: ${flows.length}`);
      return flows;
    } catch (error) {
      console.error('XML parsing error:', error);
      return [];
    }
  }

  /**
   * フロー定義からアクションを抽出
   */
  _parseFlowDefinition(flowInfo) {
    const actions = [];
    const flowName = flowInfo.name || '';
    const definition = flowInfo.definition || '';
    const connections = flowInfo.connections || [];

    // 接続情報をマップに変換
    const connectionMap = {};
    for (const conn of connections) {
      if (conn && typeof conn === 'object') {
        const connName = conn.displayName || '';
        const apiName = conn.api && conn.api.name ? conn.api.name : '';
        connectionMap[connName] = apiName;
      }
    }

    if (!definition) {
      return actions;
    }

    // エスケープされた改行コードを変換
    let processedDefinition = definition;
    try {
      processedDefinition = definition
        .replace(/\\r\\n/g, '\r\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
    } catch (error) {
      console.error('Definition processing error:', error);
    }

    // 定義文字列を行に分割
    const lines = processedDefinition.includes('\r\n')
      ? processedDefinition.split('\r\n')
      : processedDefinition.split('\n');

    console.log(`Processing ${lines.length} lines for flow: ${flowName}`);

    // 最初の20行をサンプル表示
    console.log('\n=== Definition Sample (first 20 lines) ===');
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      console.log(`Line ${i+1}: ${lines[i].substring(0, 100)}`);
    }
    console.log('=== End Sample ===\n');

    // FUNCTIONキーワードを含む全ての行を検索
    console.log('=== Searching for all FUNCTION keywords ===');
    lines.forEach((line, index) => {
      if (line.toUpperCase().includes('FUNCTION')) {
        console.log(`Line ${index+1}: ${line.trim()}`);
      }
    });
    console.log('=== End FUNCTION search ===\n');

    let currentSubflow = 'メインフロー';
    const subflowsFound = new Set();
    let actionCount = 0;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();

      // 空行やコメント行をスキップ
      if (!trimmedLine ||
          trimmedLine.startsWith('#') ||
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('**REGION') ||
          trimmedLine.startsWith('**ENDREGION')) {
        continue;
      }

      // FUNCTIONでサブフローを検出（より柔軟なパターン）
      if (trimmedLine.toUpperCase().includes('FUNCTION ')) {
        console.log(`Line ${lineNumber}: Checking for FUNCTION - "${trimmedLine}"`);

        // パターン: FUNCTION name [GLOBAL|LOCAL]
        // 日本語や記号を含む名前に対応
        let match = trimmedLine.match(/FUNCTION\s+([^\s]+)(?:\s+(?:GLOBAL|LOCAL))?/i);
        if (match) {
          currentSubflow = match[1];
          subflowsFound.add(currentSubflow);
          console.log(`Found FUNCTION (subflow): ${currentSubflow}`);
          console.log(`Now in subflow: ${currentSubflow}`);
        } else {
          console.log(`FUNCTION keyword found but pattern didn't match: ${trimmedLine}`);
        }
      }
      // END FUNCTIONでメインフローに戻る
      else if (trimmedLine.toUpperCase().includes('END') && trimmedLine.toUpperCase().includes('FUNCTION')) {
        console.log(`Line ${lineNumber}: END FUNCTION for: ${currentSubflow}`);
        console.log(`Returning to メインフロー`);
        currentSubflow = 'メインフロー';
      }
      // 各種アクションを解析
      else {
        // サブフロー内の行を詳細ログ
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
      }
    }

    console.log(`\nFlow ${flowName} - Subflows found: ${Array.from(subflowsFound).join(', ') || 'None'}`);
    console.log(`Flow ${flowName} - Total actions extracted: ${actionCount}`);


    return actions;
  }

  /**
   * 単一行からアクションを解析
   */
  _parseActionLine(line, flowName, subflowName, connections) {
    // 外部フロー呼び出し
    if (line.includes('External.RunFlow')) {
      return this._parseExternalFlow(line, flowName, subflowName);
    }
    // 外部コネクタ呼び出し
    else if (line.includes('External.InvokeCloudConnector')) {
      return this._parseCloudConnector(line, flowName, subflowName, connections);
    }
    // Excel操作
    else if (line.includes('Excel.')) {
      return this._parseExcelAction(line, flowName, subflowName);
    }
    // Web操作
    else if (line.includes('WebAutomation.')) {
      return this._parseWebAction(line, flowName, subflowName);
    }
    // UI操作
    else if (line.includes('UIAutomation.')) {
      return this._parseUiAction(line, flowName, subflowName);
    }
    // マウス・キーボード操作
    else if (line.includes('MouseAndKeyboard.')) {
      return this._parseMouseKeyboardAction(line, flowName, subflowName);
    }
    // ファイル操作
    else if (line.includes('File.')) {
      return this._parseFileAction(line, flowName, subflowName);
    }
    // フォルダ操作
    else if (line.includes('Folder.')) {
      return this._parseFolderAction(line, flowName, subflowName);
    }
    // 変数操作
    else if (line.includes('Variables.')) {
      return this._parseVariablesAction(line, flowName, subflowName);
    }
    // テキスト操作
    else if (line.includes('Text.')) {
      return this._parseTextAction(line, flowName, subflowName);
    }
    // 日時操作
    else if (line.includes('DateTime.')) {
      return this._parseDateTimeAction(line, flowName, subflowName);
    }
    // 制御フロー
    else if (this._isControlFlow(line)) {
      return this._parseControlFlow(line, flowName, subflowName);
    }

    return null;
  }

  /**
   * 制御フローかどうかを判定
   */
  _isControlFlow(line) {
    const controlKeywords = ['IF', 'LOOP', 'SWITCH', 'GOTO', 'LABEL', 'CALL', 'SET', 'WAIT', 'ON ERROR', 'THROW ERROR', 'END', 'ELSE', 'THEN', 'BLOCK', 'DISABLE'];
    return controlKeywords.some(keyword =>
      line.includes(`${keyword} `) || line.startsWith(`${keyword} `)
    );
  }

  /**
   * 外部フロー呼び出しを解析
   */
  _parseExternalFlow(line, flowName, subflowName) {
    const flowIdMatch = line.match(/FlowId:\s*'([^']+)'/);
    const flowId = flowIdMatch ? flowIdMatch[1] : '';

    const flownameMatch = line.match(/@@flowname:\s*'([^']+)'/);
    const externalFlowName = flownameMatch ? flownameMatch[1] : flowId;

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `外部フロー呼び出し: ${externalFlowName}`,
      'アクション種類': '外部フロー',
      '外部アプリケーション名': 'Power Automate',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': `FlowId: ${flowId}`,
      '備考': ''
    };
  }

  /**
   * クラウドコネクタ呼び出しを解析
   */
  _parseCloudConnector(line, flowName, subflowName, connections) {
    const connectorMatch = line.match(/ConnectorId:\s*'([^']+)'/);
    const connectorId = connectorMatch ? connectorMatch[1] : '';

    const operationMatch = line.match(/OperationId:\s*'([^']+)'/);
    const operationId = operationMatch ? operationMatch[1] : '';

    const connectionMatch = line.match(/@@connectionDisplayName:\s*'([^']+)'/);
    const connectionName = connectionMatch ? connectionMatch[1] : '';

    // アプリケーション名を決定
    let appName = '';
    const lowerConnectorId = connectorId.toLowerCase();
    if (lowerConnectorId.includes('sharepoint')) {
      appName = 'SharePoint';
    } else if (lowerConnectorId.includes('teams')) {
      appName = 'Microsoft Teams';
    } else if (lowerConnectorId.includes('excel')) {
      appName = 'Excel Online';
    } else {
      appName = connectorId.includes('/') ? connectorId.split('/').pop() : connectorId;
    }

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `${appName} - ${operationId}`,
      'アクション種類': 'クラウドコネクタ',
      '外部アプリケーション名': appName,
      '接続情報': connectionName,
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': `Connector: ${connectorId}`,
      '備考': ''
    };
  }

  /**
   * Excel操作を解析
   */
  _parseExcelAction(line, flowName, subflowName) {
    const actionMatch = line.match(/Excel\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'Excel操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `Excel - ${actionName}`,
      'アクション種類': 'Excel操作',
      '外部アプリケーション名': 'Microsoft Excel',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * Web操作を解析
   */
  _parseWebAction(line, flowName, subflowName) {
    const actionMatch = line.match(/WebAutomation\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'Web操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `Web - ${actionName}`,
      'アクション種類': 'Web操作',
      '外部アプリケーション名': 'ブラウザ',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * UI操作を解析
   */
  _parseUiAction(line, flowName, subflowName) {
    const actionMatch = line.match(/UIAutomation\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'UI操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `UI - ${actionName}`,
      'アクション種類': 'UI操作',
      '外部アプリケーション名': 'デスクトップアプリ',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * マウス・キーボード操作を解析
   */
  _parseMouseKeyboardAction(line, flowName, subflowName) {
    const actionMatch = line.match(/MouseAndKeyboard\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'マウス・キーボード操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `入力 - ${actionName}`,
      'アクション種類': '入力操作',
      '外部アプリケーション名': 'システム',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * ファイル操作を解析
   */
  _parseFileAction(line, flowName, subflowName) {
    const actionMatch = line.match(/File\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'ファイル操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `ファイル - ${actionName}`,
      'アクション種類': 'ファイル操作',
      '外部アプリケーション名': 'ファイルシステム',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * フォルダ操作を解析
   */
  _parseFolderAction(line, flowName, subflowName) {
    const actionMatch = line.match(/Folder\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'フォルダ操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `フォルダ - ${actionName}`,
      'アクション種類': 'フォルダ操作',
      '外部アプリケーション名': 'ファイルシステム',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * 変数操作を解析
   */
  _parseVariablesAction(line, flowName, subflowName) {
    const actionMatch = line.match(/Variables\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : '変数操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `変数 - ${actionName}`,
      'アクション種類': '変数操作',
      '外部アプリケーション名': '',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * テキスト操作を解析
   */
  _parseTextAction(line, flowName, subflowName) {
    const actionMatch = line.match(/Text\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : 'テキスト操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `テキスト - ${actionName}`,
      'アクション種類': 'テキスト操作',
      '外部アプリケーション名': '',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * 日時操作を解析
   */
  _parseDateTimeAction(line, flowName, subflowName) {
    const actionMatch = line.match(/DateTime\.(\w+(?:\.\w+)*)/);
    const actionName = actionMatch ? actionMatch[1] : '日時操作';

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': `日時 - ${actionName}`,
      'アクション種類': '日時操作',
      '外部アプリケーション名': '',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * 制御フローを解析
   */
  _parseControlFlow(line, flowName, subflowName) {
    let controlType = '制御フロー';

    if (line.startsWith('IF ')) {
      controlType = '条件分岐';
    } else if (line.startsWith('LOOP ')) {
      controlType = 'ループ';
    } else if (line.startsWith('SWITCH ')) {
      controlType = 'スイッチ';
    } else if (line.startsWith('GOTO ')) {
      controlType = 'ジャンプ';
    } else if (line.startsWith('LABEL ')) {
      controlType = 'ラベル';
    } else if (line.startsWith('CALL ')) {
      controlType = '関数呼び出し';
    } else if (line.startsWith('SET ')) {
      controlType = '変数設定';
    }

    return {
      'フロー名': flowName,
      'サブフロー名': subflowName,
      'アクション名': controlType,
      'アクション種類': '制御フロー',
      '外部アプリケーション名': '',
      '接続情報': '',
      '変数名': this._extractVariablesFromLine(line),
      'アクション内容': line.trim(),
      '参照情報': '',
      '備考': ''
    };
  }

  /**
   * 行から変数名を抽出
   */
  _extractVariablesFromLine(line) {
    const variables = new Set();

    // => で出力される変数
    const outputVars = line.match(/(\w+)=>/g);
    if (outputVars) {
      outputVars.forEach(match => {
        const varName = match.replace('=>', '');
        variables.add(varName);
      });
    }

    // @ で始まる入力変数
    const inputVars = line.match(/@(\w+):/g);
    if (inputVars) {
      inputVars.forEach(match => {
        const varName = match.replace('@', '').replace(':', '');
        variables.add(varName);
      });
    }

    // SET文の変数
    const setVars = line.match(/SET\s+(\w+)\s+TO/g);
    if (setVars) {
      setVars.forEach(match => {
        const varName = match.replace(/SET\s+/, '').replace(/\s+TO/, '');
        variables.add(varName);
      });
    }

    return Array.from(variables).join(', ');
  }

  /**
   * アクションリストをCSV文字列に変換
   */
  actionsToCsv(actions) {
    if (!actions || actions.length === 0) {
      return '';
    }

    const headers = [
      'フロータイプ', 'フロー名', 'サブフロー名', 'アクション名', 'アクション種類',
      '外部アプリケーション名', '接続情報', '変数名', 'アクション内容',
      '参照情報', '備考'
    ];

    let csvContent = headers.join(',') + '\n';

    for (const action of actions) {
      const row = headers.map(header => {
        let value = action[header] || '';

        // CSV用にエスケープ
        if (typeof value === 'string') {
          // 制御文字を除去
          value = value.replace(/[\x00-\x1F\x7F]/g, '');
          // 改行コードをスペースに変換
          value = value.replace(/[\r\n]/g, ' ');
          // 長すぎるテキストを制限
          if (value.length > 32767) {
            value = value.substring(0, 32764) + '...';
          }
          // ダブルクォートをエスケープ
          value = value.replace(/"/g, '""');
          // カンマまたはダブルクォートが含まれる場合はダブルクォートで囲む
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value}"`;
          }
        }

        return value;
      });

      csvContent += row.join(',') + '\n';
    }

    return csvContent;
  }
}

module.exports = PADActionExtractor;