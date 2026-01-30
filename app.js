/**
 * Power Automate Desktop アクション解析 Webアプリケーション
 * JavaScript/Node.js版
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const PADActionExtractor = require('./models/padExtractor');
const PowerAutomateAnalyzer = require('./models/powerAutomateAnalyzer');
const OpenAIService = require('./services/openaiService');
const FlowchartAPIService = require('./services/flowchartApi');
const DocumentGenerator = require('./services/documentGenerator');
const MermaidGenerator = require('./services/mermaidGenerator');

const app = express();
const PORT = process.env.PORT || 5000;

// ミドルウェア設定
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/static', express.static(path.join(__dirname, 'public/static')));

// アップロードディレクトリの作成
const uploadDir = 'uploads';
fs.ensureDirSync(uploadDir);
fs.ensureDirSync('public');

// Multer設定（ファイルアップロード）
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('ZIPファイルのみ許可されています'), false);
    }
  }
});

// サービス初期化
let openaiService = null;
let flowchartService = null;

if (process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED === 'true') {
  try {
    openaiService = new OpenAIService();
    console.log('OpenAI service initialized successfully');
  } catch (error) {
    console.error('OpenAI service initialization failed:', error.message);
  }
}

if (process.env.FLOWCHART_ENABLED === 'true') {
  try {
    flowchartService = new FlowchartAPIService();
    console.log('Flowchart service initialized successfully');
  } catch (error) {
    console.error('Flowchart service initialization failed:', error.message);
  }
}

// ルート定義

// メインページ
app.get('/', (req, res) => {
  const flowchartAvailable = flowchartService ? flowchartService.isAvailable() : false;

  res.json({
    message: 'Power Automate Desktop アクション解析ツール (JavaScript版)',
    features: {
      openai_enabled: !!openaiService,
      flowchart_enabled: flowchartAvailable
    }
  });
});

// ファイルアップロード・解析
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('=== Upload request received ===');
  console.log('File:', req.file ? req.file.originalname : 'No file');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    console.log('Starting extraction...');
    // 統合解析器を初期化（PAとPADを自動判定）
    const analyzer = new PowerAutomateAnalyzer();

    // アップロードされたファイルから解析
    const result = await analyzer.analyzeFromZipFile(req.file.path);
    const actions = result.actions;
    const solutionType = result.solutionType;

    console.log(`Solution type: ${solutionType}`);

    if (!actions || actions.length === 0) {
      return res.status(400).json({
        error: 'アクションが見つかりませんでした。正しいPower Automateソリューションファイルか確認してください'
      });
    }

    // セッションIDの生成
    const sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    // 統計情報の計算
    const paActions = actions.filter(a => a['フロータイプ'] === 'PA');
    const padActions = actions.filter(a => a['フロータイプ'] === 'PAD');

    const summary = {
      total_actions: actions.length,
      pa_actions: paActions.length,
      pad_actions: padActions.length,
      flows: [...new Set(actions.map(action => action.フロー名))].length,
      action_types: [...new Set(actions.map(action => action.アクション種類))].length,
      external_apps: [...new Set(actions.map(action => action.外部アプリケーション名).filter(Boolean))].length
    };

    // 解析結果を一時保存
    const sessionData = {
      session_id: sessionId,
      filename: req.file.originalname,
      solution_type: solutionType, // PAまたはPAD
      actions,
      timestamp: new Date().toISOString(),
      summary
    };

    const sessionFilePath = path.join(uploadDir, `${sessionId}.json`);
    await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });

    // アップロードファイルを削除
    await fs.remove(req.file.path);

    console.log(`Extraction completed: ${actions.length} actions`);
    console.log('=== Upload request completed ===');

    res.json({
      success: true,
      session_id: sessionId,
      solution_type: solutionType,
      summary,
      actions: actions // 全件を返す
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: `ファイル解析中にエラーが発生しました: ${error.message}`
    });
  }
});

// 解析結果取得
app.get('/api/actions/:sessionId', async (req, res) => {
  try {
    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);

    res.json({
      actions: sessionData.actions,
      summary: sessionData.summary
    });

  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({
      error: `データの取得中にエラーが発生しました: ${error.message}`
    });
  }
});

// CSVダウンロード
app.get('/api/download/csv/:sessionId', async (req, res) => {
  try {
    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);
    const extractor = new PADActionExtractor();
    const csvContent = extractor.actionsToCsv(sessionData.actions);

    const filename = `pad_actions_${req.params.sessionId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM付き

  } catch (error) {
    console.error('CSV download error:', error);
    res.status(500).json({
      error: `CSVダウンロード中にエラーが発生しました: ${error.message}`
    });
  }
});

// OpenAI要件定義生成
app.post('/api/requirements/:sessionId', async (req, res) => {
  try {
    if (!openaiService) {
      return res.status(500).json({ error: 'OpenAI連携が設定されていません' });
    }

    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);
    const solutionName = req.body.solution_name || sessionData.filename || 'Power Automate Desktop ソリューション';

    const requirements = await openaiService.generateRequirementsDocument(
      sessionData.actions,
      solutionName
    );

    // 生成結果をセッションデータに保存
    sessionData.requirements = requirements;
    sessionData.requirements_generated_at = new Date().toISOString();
    await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });

    res.json({
      success: true,
      requirements
    });

  } catch (error) {
    console.error('Requirements generation error:', error);
    res.status(500).json({
      error: `要件定義生成中にエラーが発生しました: ${error.message}`
    });
  }
});

// 緊急時手動実行ガイド生成（PA/PAD不使用）
// PA/PADが使えない場合に、自動化されていた業務を人間が手作業で行うためのガイドを生成
app.post('/api/user-guide/:sessionId', async (req, res) => {
  try {
    if (!openaiService) {
      return res.status(500).json({ error: 'OpenAI連携が設定されていません' });
    }

    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);
    const solutionName = req.body.solution_name || sessionData.filename || 'Power Automate ソリューション';
    const solutionType = sessionData.solution_type || 'PAD';

    console.log(`Generating manual execution guide (without PA/PAD) for: ${solutionName} (Type: ${solutionType})`);

    const userGuide = await openaiService.generateUserGuideDocument(
      sessionData.actions,
      solutionName,
      solutionType
    );

    // 生成結果をセッションデータに保存
    sessionData.user_guide = userGuide;
    sessionData.user_guide_generated_at = new Date().toISOString();
    await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });

    res.json({
      success: true,
      user_guide: userGuide
    });

  } catch (error) {
    console.error('User guide generation error:', error);
    res.status(500).json({
      error: `手動実行ガイド生成中にエラーが発生しました: ${error.message}`
    });
  }
});

// システムフローチャート生成（ルールベース・高速・安定）
app.post('/api/ai-flowchart/:sessionId', async (req, res) => {
  try {
    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);
    const solutionName = req.body.solution_name || sessionData.filename || 'Power Automate ソリューション';
    const solutionType = sessionData.solution_type || 'PAD';

    console.log(`Generating flowchart (rule-based) for: ${solutionName} (Type: ${solutionType})`);

    // ルールベース生成（AI不要、瞬時に完了、完全に安定）
    const generator = new MermaidGenerator();
    const structuredData = generator.createStructuredFlowData(sessionData.actions);
    const result = generator.generateFlowchart(structuredData, solutionType);

    // 生成結果をセッションデータに保存
    sessionData.system_flowchart = result.mermaidCode;
    sessionData.flowchart_node_details = result.nodeDetailsMap; // ノード詳細情報も保存
    sessionData.flowchart_generated_at = new Date().toISOString();
    sessionData.flowchart_generation_method = 'rule-based'; // AI不使用を明示
    await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });

    console.log(`Flowchart generated successfully (${result.mermaidCode.split('\n').length} lines)`);

    res.json({
      success: true,
      flowchart: result.mermaidCode,
      nodeDetails: result.nodeDetailsMap, // ノード詳細情報を返す
      method: 'rule-based' // フロントエンドに生成方法を通知
    });

  } catch (error) {
    console.error('Flowchart generation error:', error);
    res.status(500).json({
      error: `フローチャート生成中にエラーが発生しました: ${error.message}`
    });
  }
});

// フローチャート連携（既存機能）
app.post('/api/flowchart/:sessionId', async (req, res) => {
  try {
    if (!flowchartService || !flowchartService.isAvailable()) {
      return res.status(500).json({ error: 'フローチャート作成ツールが利用できません' });
    }

    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    const sessionData = await fs.readJson(sessionFilePath);

    const flowchartData = flowchartService.convertToFlowchartData(sessionData.actions);
    const response = await flowchartService.sendToFlowchartTool(flowchartData);

    if (response) {
      const flowchartId = response.flowchart_id;
      const flowchartUrl = flowchartId ? await flowchartService.getFlowchartUrl(flowchartId) : null;

      sessionData.flowchart = {
        id: flowchartId,
        url: flowchartUrl,
        created_at: new Date().toISOString()
      };
      await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });

      res.json({
        success: true,
        flowchart_id: flowchartId,
        flowchart_url: flowchartUrl
      });
    } else {
      res.status(500).json({ error: 'フローチャート作成ツールでエラーが発生しました' });
    }

  } catch (error) {
    console.error('Flowchart error:', error);
    res.status(500).json({
      error: `フローチャート送信中にエラーが発生しました: ${error.message}`
    });
  }
});

// フローチャートAPI仕様取得
app.get('/api/flowchart/spec', (req, res) => {
  if (flowchartService) {
    res.json(flowchartService.getApiSpecification());
  } else {
    res.json({
      error: "フローチャート機能は現在無効化されています",
      status: "disabled"
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  const flowchartAvailable = flowchartService ? flowchartService.isAvailable() : false;

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!openaiService,
      flowchart: flowchartAvailable
    }
  });
});

// 統合ドキュメント生成・ダウンロード
app.get('/api/export-document/:sessionId', async (req, res) => {
  try {
    const sessionFilePath = path.join(uploadDir, `${req.params.sessionId}.json`);

    if (!await fs.pathExists(sessionFilePath)) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    let sessionData = await fs.readJson(sessionFilePath);

    // OpenAIサービスが利用可能な場合、不足しているコンテンツを自動生成
    if (openaiService) {
      let hasUpdates = false;
      const solutionName = sessionData.filename || 'Power Automate ソリューション';
      const solutionType = sessionData.solution_type || 'PAD';

      // 要件定義が存在しない場合は生成
      if (!sessionData.requirements) {
        console.log('Generating requirements for export...');
        try {
          sessionData.requirements = await openaiService.generateRequirementsDocument(
            sessionData.actions,
            solutionName
          );
          sessionData.requirements_generated_at = new Date().toISOString();
          hasUpdates = true;
        } catch (error) {
          console.error('Failed to generate requirements:', error.message);
        }
      }

      // フローチャートが存在しない場合はルールベース生成
      if (!sessionData.system_flowchart) {
        console.log('Generating flowchart (rule-based) for export...');
        try {
          const generator = new MermaidGenerator();
          const structuredData = generator.createStructuredFlowData(sessionData.actions);
          const result = generator.generateFlowchart(structuredData, solutionType);
          sessionData.system_flowchart = result.mermaidCode;
          sessionData.flowchart_node_details = result.nodeDetailsMap;
          sessionData.flowchart_generated_at = new Date().toISOString();
          sessionData.flowchart_generation_method = 'rule-based';
          hasUpdates = true;
        } catch (error) {
          console.error('Failed to generate flowchart:', error.message);
        }
      }

      // 更新があればセッションデータを保存
      if (hasUpdates) {
        await fs.writeJson(sessionFilePath, sessionData, { spaces: 2 });
        console.log('Session data updated with generated content');
      }
    }

    // ドキュメント生成
    const docGenerator = new DocumentGenerator();
    const htmlContent = docGenerator.generateDocument(sessionData);

    // ファイル名生成
    const filename = `${sessionData.filename.replace(/\.zip$/i, '')}_解析レポート_${new Date().toISOString().slice(0,10)}.html`;

    // HTMLとして返す
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(htmlContent);

    console.log(`Document exported: ${filename}`);

  } catch (error) {
    console.error('Document export error:', error);
    res.status(500).json({
      error: `ドキュメント生成中にエラーが発生しました: ${error.message}`
    });
  }
});

// セッションクリーンアップ
app.post('/api/cleanup', async (req, res) => {
  try {
    const files = await fs.readdir(uploadDir);
    const currentTime = Date.now();
    let cleanupCount = 0;

    for (const file of files) {
      if (file.startsWith('session_') && file.endsWith('.json')) {
        const filePath = path.join(uploadDir, file);
        const stat = await fs.stat(filePath);

        // 1時間以上古いファイルを削除
        if (currentTime - stat.mtime.getTime() > 3600000) {
          await fs.remove(filePath);
          cleanupCount++;
        }
      }
    }

    res.json({
      success: true,
      cleaned_files: cleanupCount
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: `クリーンアップ中にエラーが発生しました: ${error.message}`
    });
  }
});

// エラーハンドリング
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大50MB）' });
    }
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({ error: 'ページが見つかりません' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Power Automate Desktop アクション解析ツール (JavaScript版)`);
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`OpenAI連携: ${openaiService ? '有効' : '無効'}`);
  console.log(`フローチャート連携: ${flowchartService ? '有効' : '無効'}`);
});

module.exports = app;