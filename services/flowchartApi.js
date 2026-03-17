/**
 * フローチャート作成ツール連携APIサービス
 * JavaScript版
 */

const axios = require('axios');

class FlowchartAPIService {
  constructor() {
    this.baseUrl = process.env.FLOWCHART_API_URL || 'http://localhost:3001/api';
    this.timeout = 10000; // 10秒
  }

  /**
   * フローチャート作成ツールが利用可能かチェック
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: this.timeout
      });
      return response.status === 200;
    } catch (error) {
      console.error('Flowchart service health check failed:', error.message);
      return false;
    }
  }

  /**
   * PADアクションデータをフローチャートデータに変換
   */
  convertToFlowchartData(actions) {
    const metadata = {
      source: 'PAD Analyzer',
      version: '1.0',
      flows: [...new Set(actions.map(action => action.フロー名))]
    };

    const nodes = [];
    const connections = [];
    let nodeId = 1;
    const positionX = 50;
    let positionY = 50;

    // フローごとにノードを作成
    for (const flowName of metadata.flows) {
      const flowActions = actions.filter(action => action.フロー名 === flowName);
      const subflows = [...new Set(flowActions.map(action => action.サブフロー名))];

      for (const subflowName of subflows) {
        const subflowActions = flowActions.filter(action => action.サブフロー名 === subflowName);
        let prevNodeId = null;

        for (const action of subflowActions) {
          const currentNodeId = `node_${nodeId}`;

          // ノードタイプを決定
          const nodeType = this._determineNodeType(action.アクション種類);

          // ノードを作成
          const node = {
            id: currentNodeId,
            type: nodeType,
            label: action.アクション名,
            flow: flowDisplayName,
            subflow: subflowName,
            position: { x: positionX, y: positionY },
            style: { backgroundColor: this._getNodeColor(nodeType) },
            icon: this._getNodeIcon(nodeType),
            metadata: {
              actionType: action.アクション種類,
              externalApp: action.外部アプリケーション名,
              variables: action.変数名,
              content: action.アクション内容
            }
          };

          nodes.push(node);

          // 前のノードとの接続を作成
          if (prevNodeId) {
            const connection = {
              id: `conn_${prevNodeId}_${currentNodeId}`,
              source: prevNodeId,
              target: currentNodeId,
              type: 'sequence',
              label: ''
            };
            connections.push(connection);
          }

          prevNodeId = currentNodeId;
          nodeId++;
          positionY += 100;
        }

        positionY += 50; // サブフロー間のスペース
      }

      positionY += 100; // フロー間のスペース
    }

    return {
      metadata,
      nodes,
      connections
    };
  }

  /**
   * フローチャート作成ツールへデータを送信
   */
  async sendToFlowchartTool(flowchartData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/flowchart/import`,
        flowchartData,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Flowchart tool API error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`フローチャート作成ツールとの通信でエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * フローチャートのURLを取得
   */
  async getFlowchartUrl(flowchartId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/flowchart/${flowchartId}/url`,
        { timeout: this.timeout }
      );

      return response.data.url;

    } catch (error) {
      console.error('Get flowchart URL error:', error.message);
      throw new Error(`フローチャートURL取得でエラーが発生しました: ${error.message}`);
    }
  }

  /**
   * API仕様を取得
   */
  getApiSpecification() {
    return {
      name: 'Flowchart Tool Integration API',
      version: '1.0',
      baseUrl: this.baseUrl,
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: '稼働状況確認'
        },
        {
          method: 'POST',
          path: '/flowchart/import',
          description: 'フローチャートデータインポート',
          requestBody: {
            type: 'object',
            properties: {
              metadata: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  version: { type: 'string' },
                  flows: { type: 'array', items: { type: 'string' } }
                }
              },
              nodes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    label: { type: 'string' },
                    flow: { type: 'string' },
                    subflow: { type: 'string' },
                    position: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' }
                      }
                    },
                    style: {
                      type: 'object',
                      properties: {
                        backgroundColor: { type: 'string' }
                      }
                    },
                    icon: { type: 'string' },
                    metadata: { type: 'object' }
                  }
                }
              },
              connections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    target: { type: 'string' },
                    type: { type: 'string' },
                    label: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        {
          method: 'GET',
          path: '/flowchart/{id}/url',
          description: 'フローチャート表示URL取得'
        }
      ]
    };
  }

  /**
   * アクション種類からノードタイプを決定
   */
  _determineNodeType(actionType) {
    const typeMap = {
      '制御フロー': 'decision',
      'ループ': 'loop',
      '条件分岐': 'decision',
      '外部フロー': 'subprocess',
      'クラウドコネクタ': 'service',
      'Excel操作': 'data',
      'Web操作': 'user_interaction',
      'UI操作': 'user_interaction',
      '入力操作': 'user_interaction',
      'ファイル操作': 'data',
      'フォルダ操作': 'data',
      '変数操作': 'process',
      'テキスト操作': 'process',
      '日時操作': 'process'
    };

    return typeMap[actionType] || 'process';
  }

  /**
   * ノードタイプから色を取得
   */
  _getNodeColor(nodeType) {
    const colorMap = {
      'process': '#E3F2FD',
      'decision': '#FFF3E0',
      'loop': '#F3E5F5',
      'subprocess': '#E8F5E8',
      'service': '#FFF8E1',
      'data': '#E0F2F1',
      'user_interaction': '#FCE4EC',
      'control': '#F1F8E9'
    };

    return colorMap[nodeType] || '#F5F5F5';
  }

  /**
   * ノードタイプからアイコンを取得
   */
  _getNodeIcon(nodeType) {
    const iconMap = {
      'process': '⚙️',
      'decision': '❓',
      'loop': '🔄',
      'subprocess': '📋',
      'service': '🌐',
      'data': '📁',
      'user_interaction': '👤',
      'control': '🎛️'
    };

    return iconMap[nodeType] || '⚙️';
  }

  /**
   * サービスのヘルスチェック
   */
  async healthCheck() {
    try {
      const isAvailable = await this.isAvailable();
      return {
        status: isAvailable ? 'healthy' : 'unavailable',
        baseUrl: this.baseUrl,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        baseUrl: this.baseUrl,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = FlowchartAPIService;