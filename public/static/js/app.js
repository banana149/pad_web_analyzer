// グローバル変数
let currentSessionId = null;
let currentSolutionType = null; // 'PA' or 'PAD'
let allActions = [];
let filteredActions = [];
let currentPage = 1;
let selectedZipFile = null;
const itemsPerPage = 50;
let isAnalyzing = false; // 二重実行防止フラグ
let currentViewMode = 'group'; // 表示モード: 'list', 'group', 'flowchart', 'aisummary'
let currentZipFile = null; // アップロードされたZIPファイルを保持
let currentNodeDetails = null; // フローチャートのノード詳細情報

console.log('=== app.js v11 読み込み完了 ===');
console.log('機能: ノードクリック完全実装 | ノード形状: actionName対応版 | 条件=◇ ループ=⬡ エラー=⬭');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing app');
    initializeEventListeners();
});

function initializeEventListeners() {
    console.log('Initializing event listeners');
    // ファイル選択
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);

    // ファイル選択ボタン
    const selectFileButton = document.getElementById('selectFileButton');
    if (selectFileButton) {
        selectFileButton.addEventListener('click', (e) => {
            console.log('Select file button clicked');
            e.stopPropagation(); // イベント伝播を停止
            fileInput.click();
        });
    }

    // ドラッグ&ドロップ
    const uploadArea = document.getElementById('uploadArea');
    // uploadArea全体のクリックではなく、背景部分のみクリック可能にする
    uploadArea.addEventListener('click', (e) => {
        // ボタン自体がクリックされた場合は何もしない（ボタンが処理する）
        if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
            console.log('Upload area clicked');
            fileInput.click();
        }
    });
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
}



function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
        document.getElementById('fileInput').files = e.dataTransfer.files;
        displayFileInfo(file);
    } else {
        alert('ZIPファイルを選択してください');
    }
}





function resetResults() {
    console.log('Resetting previous results...');
    // データをクリア
    allActions = [];
    filteredActions = [];
    currentPage = 1;
    currentSessionId = null;
    currentSolutionType = null;

    // 結果エリアを非表示
    document.getElementById('resultsArea').style.display = 'none';

    // 各エリアをクリア
    document.getElementById('statsArea').innerHTML = '';
    document.getElementById('actionsTableBody').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('requirementsContent').innerHTML = '<p class="text-muted">「AI生成」ボタンをクリックして要件定義書を生成してください。</p>';

    // フィルターをクリア
    const flowFilter = document.getElementById('flowFilter');
    const typeFilter = document.getElementById('actionTypeFilter');
    const searchFilter = document.getElementById('searchFilter');
    if (flowFilter) flowFilter.innerHTML = '<option value="">全フロー</option>';
    if (typeFilter) typeFilter.innerHTML = '<option value="">全アクション種類</option>';
    if (searchFilter) searchFilter.value = '';

    console.log('Reset completed');
}

async function analyzeFile() {
    console.log('=== analyzeFile called ===');
    console.log('Current isAnalyzing flag:', isAnalyzing);

    // 二重実行防止
    if (isAnalyzing) {
        console.log('Already analyzing, skipping...');
        return;
    }

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    // --- ★ここからExcelファイル取得のコードを追加 ---
    const excelFileInput = document.getElementById('excelFileInput');
    const excelFile = excelFileInput ? excelFileInput.files[0] : null;
    console.log('File from input:', file ? file.name : 'NO FILE');

    if (!file) {
        alert('ファイルが選択されていません');
        return;
    }

    // ZIPファイルを保存（フローチャート表示用）
    currentZipFile = file;

    // 前回のデータをリセット
    resetResults();

    isAnalyzing = true;
    console.log('Setting isAnalyzing to true');
    console.log('Starting analysis for file:', file.name);

    const formData = new FormData();
    formData.append('file', file);

    if (excelFile) {
        formData.append('excelFile', excelFile);
        console.log('Excel file added to FormData');
    }

    document.getElementById('loading').style.display = 'block';
    document.getElementById('analyzeButton').disabled = true;

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'アップロードに失敗しました');
        }

        const result = await response.json();
        console.log('Response received:', result);
        console.log('Actions count:', result.actions ? result.actions.length : 0);

        currentSessionId = result.session_id;
        currentSolutionType = result.solution_type;
        allActions = result.actions;
        filteredActions = [...allActions];

        console.log(`Solution type: ${currentSolutionType}`);
        console.log(`allActions length: ${allActions.length}`);
        console.log(`filteredActions length: ${filteredActions.length}`);
        console.log('First action sample:', allActions[0]);

        displayResults(result);

    } catch (error) {
        alert('エラー: ' + error.message);
        console.error('Analysis error:', error);
    } finally {
        console.log('Finally block - resetting state');
        document.getElementById('loading').style.display = 'none';
        document.getElementById('analyzeButton').disabled = false;
        isAnalyzing = false;
        console.log('isAnalyzing set to false in finally');
        console.log('=== analyzeFile completed ===');
    }
}

function displayResults(result) {
    console.log('=== displayResults called ===');
    console.log('Result summary:', result.summary);

    // ソリューションタイプのバッジ
    let solutionTypeBadge = '';
    if (result.solution_type === 'PA') {
        solutionTypeBadge = '<span class="badge bg-info">Power Automate (クラウドフロー)</span>';
    } else if (result.solution_type === 'PAD') {
        solutionTypeBadge = '<span class="badge bg-primary">Power Automate Desktop</span>';
    } else if (result.solution_type === 'MIXED') {
        solutionTypeBadge = '<span class="badge bg-success">PA + PAD 混在</span>';
    }

    // MIXEDの場合はPA/PAD別の統計情報も表示
    let statsHTML = `
        <div class="col-12 mb-3">
            <h6 class="text-center">解析タイプ: ${solutionTypeBadge}</h6>
        </div>
        <div class="col-md-3">
            <div class="stat-badge">
                <div class="number text-primary">${result.summary.total_actions}</div>
                <div class="label">総アクション数</div>
            </div>
        </div>
    `;

    // MIXEDの場合はPA/PAD別のアクション数を表示
    if (result.solution_type === 'MIXED') {
        statsHTML += `
            <div class="col-md-3">
                <div class="stat-badge">
                    <div class="number text-info">${result.summary.pa_actions}</div>
                    <div class="label">PA アクション</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-badge">
                    <div class="number text-primary">${result.summary.pad_actions}</div>
                    <div class="label">PAD アクション</div>
                </div>
            </div>
        `;
    } else {
        statsHTML += `
            <div class="col-md-3">
                <div class="stat-badge">
                    <div class="number text-success">${result.summary.flows}</div>
                    <div class="label">フロー数</div>
                </div>
            </div>
        `;
    }

    statsHTML += `
        <div class="col-md-3">
            <div class="stat-badge">
                <div class="number text-warning">${result.summary.action_types}</div>
                <div class="label">アクション種類</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-badge">
                <div class="number text-info">${result.summary.external_apps}</div>
                <div class="label">外部アプリ数</div>
            </div>
        </div>
    `;

    document.getElementById('statsArea').innerHTML = statsHTML;
    console.log('Stats HTML updated');

    // フィルターオプション設定
    console.log('Calling setupFilters...');
    setupFilters();

    // テーブル表示
    console.log('Calling displayTable...');
    displayTable();

    // 結果エリアを表示
    document.getElementById('resultsArea').style.display = 'block';
    console.log('=== displayResults completed ===');
}

function setupFilters() {
    console.log('=== setupFilters called ===');
    console.log('allActions length:', allActions.length);

    try {
        // フロー名フィルター
        const flows = [...new Set(allActions.map(a => a['フロー名']))];
        console.log('Unique flows:', flows);

        const flowFilter = document.getElementById('flowFilter');
        flowFilter.innerHTML = '<option value="">全フロー</option>';
        flows.forEach(flow => {
            flowFilter.innerHTML += `<option value="${escapeHtml(flow)}">${escapeHtml(flow)}</option>`;
        });

        // アクション種類フィルター
        const actionTypes = [...new Set(allActions.map(a => a['アクション種類']))];
        console.log('Unique action types:', actionTypes);

        const typeFilter = document.getElementById('actionTypeFilter');
        typeFilter.innerHTML = '<option value="">全アクション種類</option>';
        actionTypes.forEach(type => {
            typeFilter.innerHTML += `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`;
        });

        console.log('=== setupFilters completed ===');
    } catch (error) {
        console.error('setupFilters error:', error);
        throw error;
    }
}

function toggleFilter() {
    const filterArea = document.getElementById('filterArea');
    filterArea.style.display = filterArea.style.display === 'none' ? 'block' : 'none';
}

function applyFilters() {
    const flowFilter = document.getElementById('flowFilter').value;
    const typeFilter = document.getElementById('actionTypeFilter').value;
    const searchText = document.getElementById('searchFilter').value.toLowerCase();

    filteredActions = allActions.filter(action => {
        const matchFlow = !flowFilter || action['フロー名'] === flowFilter;
        const matchType = !typeFilter || action['アクション種類'] === typeFilter;
        const matchSearch = !searchText ||
            Object.values(action).some(val =>
                String(val).toLowerCase().includes(searchText)
            );

        return matchFlow && matchType && matchSearch;
    });

    currentPage = 1;
    displayTable();
}

function clearFilters() {
    document.getElementById('flowFilter').value = '';
    document.getElementById('actionTypeFilter').value = '';
    document.getElementById('searchFilter').value = '';
    filteredActions = [...allActions];
    currentPage = 1;
    displayTable();
}

function displayTable() {
    console.log('=== displayTable called ===');
    console.log('currentViewMode:', currentViewMode);

    // 表示モードに応じて表示を切り替え
    if (currentViewMode === 'group') {
        displayGroupView();
    } else if (currentViewMode === 'flowchart') {
        displayFlowchartView();
    } else if (currentViewMode === 'aisummary') {
        displayAISummaryView();
    } else if (currentViewMode === 'userguide') {
        displayUserGuideView();
    } else {
        displayListView();
    }
}

async function displayFlowchartView() {
    console.log('=== displayFlowchartView called ===');

    // 表示エリアの切り替え
    document.getElementById('listViewArea').style.display = 'none';
    document.getElementById('groupViewArea').style.display = 'none';
    document.getElementById('flowchartViewArea').style.display = 'block';
    document.getElementById('aisummaryViewArea').style.display = 'none';
    document.getElementById('userGuideViewArea').style.display = 'none';

    // iframeにZIPファイルデータを渡す
    await sendFileToIframe();
}

function displayAISummaryView() {
    console.log('=== displayAISummaryView called ===');

    // 表示エリアの切り替え
    document.getElementById('listViewArea').style.display = 'none';
    document.getElementById('groupViewArea').style.display = 'none';
    document.getElementById('flowchartViewArea').style.display = 'none';
    document.getElementById('aisummaryViewArea').style.display = 'block';
    document.getElementById('userGuideViewArea').style.display = 'none';

    console.log('=== displayAISummaryView completed ===');
}

function displayUserGuideView() {
    console.log('=== displayUserGuideView called ===');

    // 表示エリアの切り替え
    document.getElementById('listViewArea').style.display = 'none';
    document.getElementById('groupViewArea').style.display = 'none';
    document.getElementById('flowchartViewArea').style.display = 'none';
    document.getElementById('aisummaryViewArea').style.display = 'none';
    document.getElementById('userGuideViewArea').style.display = 'block';

    console.log('=== displayUserGuideView completed ===');
}

async function sendFileToIframe() {
    if (!currentZipFile) {
        console.warn('No ZIP file available');
        return;
    }

    try {
        // ZIPファイルをArrayBufferとして読み込む
        const arrayBuffer = await currentZipFile.arrayBuffer();

        // Base64エンコード
        const base64String = arrayBufferToBase64(arrayBuffer);

        // LocalStorageに保存
        localStorage.setItem('pendingFlowchartFile', base64String);
        localStorage.setItem('pendingFlowchartFileName', currentZipFile.name);

        // iframeをリロードして自動読み込みをトリガー
        const iframe = document.getElementById('flowchartIframe');
        iframe.src = iframe.src; // リロード

    } catch (error) {
        console.error('Error sending file to iframe:', error);
    }
}

// ArrayBufferをBase64に変換
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}


function setViewMode(mode) {
    console.log('Switching view mode to:', mode);
    currentViewMode = mode;

    // 1. 各モードボタンのアクティブ状態の切り替え
    const buttons = {
        list: document.getElementById('viewModeList'),
        group: document.getElementById('viewModeGroup'),
        flowchart: document.getElementById('viewModeFlowchart'),
        aisummary: document.getElementById('viewModeAISummary'),
        userguide: document.getElementById('viewModeUserGuide')
    };

    Object.values(buttons).forEach(btn => btn?.classList.remove('active'));
    if (buttons[mode]) buttons[mode].classList.add('active');

    // 2. ★ 修正：フィルターボタン（アイコン）のみを制御 ★
    // 「フィルター」というテキストが含まれるボタン、または toggleFilter を呼ぶボタンを特定
    const filterBtn = document.querySelector('button[onclick="toggleFilter()"]');
    
    if (filterBtn) {
        if (mode === 'list' || mode === 'group') {
            // 一覧・グループの時だけボタンを表示
            filterBtn.style.setProperty('display', 'inline-block', 'important');
        } else {
            // それ以外のモードではボタンを消す（エリアの非表示命令は削除）
            filterBtn.style.setProperty('display', 'none', 'important');
        }
    }

    // 3. 表示の更新（フローチャートなどの描画処理へ）
    displayTable();
}

function displayListView() {
    console.log('=== displayListView called ===');
    console.log('currentPage:', currentPage);
    console.log('itemsPerPage:', itemsPerPage);
    console.log('filteredActions length:', filteredActions.length);

    // 表示エリアの切り替え
    document.getElementById('listViewArea').style.display = 'block';
    document.getElementById('groupViewArea').style.display = 'none';
    document.getElementById('flowchartViewArea').style.display = 'none';
    document.getElementById('aisummaryViewArea').style.display = 'none';
    document.getElementById('userGuideViewArea').style.display = 'none';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageActions = filteredActions.slice(start, end);

    console.log('pageActions length:', pageActions.length);
    if (pageActions.length > 0) {
        console.log('First page action:', pageActions[0]);
    }

    const tbody = document.getElementById('actionsTableBody');
    tbody.innerHTML = pageActions.map((action, index) => `
        <tr class="action-row">
            <td>${start + index + 1}</td>
            <td>${escapeHtml(action['フロー名'] || '-')}</td>
            <td>${escapeHtml(action['サブフロー名'] || '-')}</td>
            <td>${escapeHtml(action['アクション名'] || '-')}</td>
            <td>
                <span class="badge badge-action-type bg-primary">
                    ${escapeHtml(action['アクション種類'] || '-')}
                </span>
            </td>
            <td>${escapeHtml(action['外部アプリケーション名'] || '-')}</td>
            <td><small>${escapeHtml(action['変数名'] || '-')}</small></td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="showDetail(${start + index})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');

    console.log('Table HTML generated, length:', tbody.innerHTML.length);

    // ページネーション表示
    displayPagination();

    console.log('=== displayListView completed ===');
}

function displayGroupView() {
    console.log('=== displayGroupView called ===');

    // 表示エリアの切り替え設定
    document.getElementById('listViewArea').style.display = 'none';
    document.getElementById('groupViewArea').style.display = 'block';
    document.getElementById('flowchartViewArea').style.display = 'none';
    document.getElementById('aisummaryViewArea').style.display = 'none';
    document.getElementById('userGuideViewArea').style.display = 'none';

    // 1. データのグループ化（既存の処理）
    const flowGroups = {};
    filteredActions.forEach((action, index) => {
        const flowName = action['フロー名'] || '不明なフロー';
        if (!flowGroups[flowName]) {
            flowGroups[flowName] = {};
        }
        const subflowName = action['サブフロー名'] || 'メインフロー';
        if (!flowGroups[flowName][subflowName]) {
            flowGroups[flowName][subflowName] = [];
        }
        flowGroups[flowName][subflowName].push({ ...action, originalIndex: index });
    });

    // --- ★ここからが「全フローの流れ」を一番上に持ってくるための追加コード ★ ---
    const allKeys = Object.keys(flowGroups);
    
    // 「全フローの流れ」という名前を「含む」キーを検索（部分一致で確実に取得）
    const priorityKey = allKeys.find(key => key.includes('全フローの流れ'));
    
    let sortedFlowNames;
    if (priorityKey) {
        // 優先キー（全フローの流れ）を先頭にし、残りを名前順でソートして合体させる
        const otherKeys = allKeys.filter(key => key !== priorityKey).sort((a, b) => a.localeCompare(b));
        sortedFlowNames = [priorityKey, ...otherKeys];
    } else {
        // 見つからない場合は通常通り名前順でソート
        sortedFlowNames = allKeys.sort((a, b) => a.localeCompare(b));
    }
    // --- ★ここまで★ ---

    // 2. HTMLの生成（ソート済みの sortedFlowNames を使用してループを回す）
    let html = '<div class="accordion flow-accordion" id="flowAccordion">';

    sortedFlowNames.forEach((flowName, flowIndex) => {
        const subflows = flowGroups[flowName];
        const totalActions = Object.values(subflows).reduce((sum, actions) => sum + actions.length, 0);

        html += `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-flow-${flowIndex}">
                    <button class="accordion-button ${flowIndex === 0 ? '' : 'collapsed'}" type="button"
                            data-bs-toggle="collapse" data-bs-target="#collapse-flow-${flowIndex}"
                            aria-expanded="${flowIndex === 0 ? 'true' : 'false'}" aria-controls="collapse-flow-${flowIndex}">
                        <i class="fas fa-project-diagram me-2"></i>
                        ${escapeHtml(flowName)}
                        <span class="badge bg-primary ms-2">${totalActions} アクション</span>
                    </button>
                </h2>
                <div id="collapse-flow-${flowIndex}" class="accordion-collapse collapse ${flowIndex === 0 ? 'show' : ''}"
                     aria-labelledby="heading-flow-${flowIndex}" data-bs-parent="#flowAccordion">
                    <div class="accordion-body">
        `;

        // サブフロー表示部分は既存のロジックを継続
        Object.keys(subflows).forEach((subflowName) => {
            const actions = subflows[subflowName];
            html += `
                <div class="card subflow-card">
                    <div class="subflow-header">
                        <span><i class="fas fa-layer-group me-2"></i>${escapeHtml(subflowName)}</span>
                        <span class="badge bg-secondary action-count-badge">${actions.length} アクション</span>
                    </div>
                    <div class="card-body p-0">
                        <table class="table compact-table table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th style="width: 40px;">#</th>
                                    <th>アクション名</th>
                                    <th style="width: 150px;">種類</th>
                                    <th style="width: 150px;">外部アプリ</th>
                                    <th style="width: 120px;">変数</th>
                                    <th style="width: 60px;">詳細</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            actions.forEach((action, actionIndex) => {
                html += `
                    <tr class="action-row">
                        <td>${actionIndex + 1}</td>
                        <td>${escapeHtml(action['アクション名'] || '-')}</td>
                        <td><span class="badge badge-action-type bg-primary">${escapeHtml(action['アクション種類'] || '-')}</span></td>
                        <td><small>${escapeHtml(action['外部アプリケーション名'] || '-')}</small></td>
                        <td><small>${escapeHtml(action['変数名'] || '-')}</small></td>
                        <td>
                            <button class="btn btn-sm btn-outline-info" onclick="showDetail(${action.originalIndex})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div></div>`;
        });

        html += `</div></div></div>`;
    });

    html += '</div>';
    document.getElementById('groupViewArea').innerHTML = html;
}

function displayPagination() {
    const pagination = document.getElementById('pagination');

    // グループ表示の場合はページネーション不要
    if (currentViewMode === 'group') {
        pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredActions.length / itemsPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // 前へボタン
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">前へ</a>
        </li>
    `;

    // ページ番号
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1); return false;">1</a></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
            </li>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a></li>`;
    }

    // 次へボタン
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">次へ</a>
        </li>
    `;

    pagination.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredActions.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    displayTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDetail(index) {
    const action = filteredActions[index];

    const detailHTML = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <h6>フロー名</h6>
                <p>${escapeHtml(action['フロー名'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>サブフロー名</h6>
                <p>${escapeHtml(action['サブフロー名'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>アクション名</h6>
                <p>${escapeHtml(action['アクション名'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>アクション種類</h6>
                <p><span class="badge bg-primary">${escapeHtml(action['アクション種類'] || '-')}</span></p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>外部アプリケーション名</h6>
                <p>${escapeHtml(action['外部アプリケーション名'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>接続情報</h6>
                <p>${escapeHtml(action['接続情報'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>変数名</h6>
                <p>${escapeHtml(action['変数名'] || '-')}</p>
            </div>
            <div class="col-md-6 mb-3">
                <h6>参照情報</h6>
                <p>${escapeHtml(action['参照情報'] || '-')}</p>
            </div>
            <div class="col-12 mb-3">
                <h6>アクション内容</h6>
                <div class="action-detail">${escapeHtml(action['アクション内容'] || '-')}</div>
            </div>
            <div class="col-12 mb-3">
                <h6>備考</h6>
                <p>${escapeHtml(action['備考'] || '-')}</p>
            </div>
        </div>
    `;

    document.getElementById('detailModalBody').innerHTML = detailHTML;
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();
}

function downloadCSV() {
    if (!currentSessionId) {
        alert('セッションIDが見つかりません');
        return;
    }
    window.location.href = `/api/download/csv/${currentSessionId}`;
}

function exportDocument() {
    if (!currentSessionId) {
        alert('セッションIDが見つかりません');
        return;
    }

    // 統合ドキュメントをダウンロード
    window.location.href = `/api/export-document/${currentSessionId}`;
}

async function generateRequirements() {
    if (!currentSessionId) {
        alert('セッションIDが見つかりません');
        return;
    }

    const btn = document.getElementById('generateReqBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>生成中...';

    try {
        const response = await fetch(`/api/requirements/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solution_name: document.getElementById('fileName').textContent || 'PADソリューション'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '要件定義生成に失敗しました');
        }

        const result = await response.json();
        displayRequirements(result.requirements);

    } catch (error) {
        if (error.message.includes('OpenAI')) {
            document.getElementById('requirementsContent').innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    OpenAI APIキーが設定されていないため、AI要件定義生成機能は利用できません。
                    <br><small>.envファイルでOPENAI_API_KEYを設定してください。</small>
                </div>
            `;
        } else {
            alert('エラー: ' + error.message);
        }
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot me-1"></i>AI生成';
    }
}

function displayRequirements(requirements) {
    // AIからの応答は文字列なので、そのまま表示
    if (typeof requirements === 'string') {
        const html = `
            <div class="border rounded p-3 bg-light">
                <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0;">${escapeHtml(requirements)}</pre>
            </div>
        `;
        document.getElementById('requirementsContent').innerHTML = html;
    } else if (typeof requirements === 'object' && requirements !== null) {
        // オブジェクト形式の場合（後方互換性のため）
        let html = '';
        for (const [section, content] of Object.entries(requirements)) {
            html += `
                <div class="mb-4">
                    <h6 class="text-primary">${section}</h6>
                    <div class="border rounded p-3 bg-light">
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }
        document.getElementById('requirementsContent').innerHTML = html;
    }
}

async function generateFlowchart() {
    if (!currentSessionId) {
        alert('セッションIDが見つかりません');
        return;
    }

    const btn = document.getElementById('generateFlowchartBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>生成中...';

    try {
        const response = await fetch(`/api/ai-flowchart/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solution_name: document.getElementById('fileName').textContent || 'PAソリューション'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'フローチャート生成に失敗しました');
        }

        const result = await response.json();
        currentNodeDetails = result.nodeDetails || {}; // ノード詳細情報を保存
        console.log(`フローチャート生成完了: ${Object.keys(currentNodeDetails).length}個のノード詳細を取得`);
        displayFlowchartMermaid(result.flowchart);

    } catch (error) {
        if (error.message.includes('OpenAI')) {
            document.getElementById('flowchartContent').innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    OpenAI APIキーが設定されていないため、AIフローチャート生成機能は利用できません。
                    <br><small>.envファイルでOPENAI_API_KEYを設定してください。</small>
                </div>
            `;
        } else {
            alert('エラー: ' + error.message);
        }
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot me-1"></i>フローチャート生成';
    }
}

function displayFlowchartMermaid(mermaidCode) {
    const flowchartContainer = document.getElementById('flowchartContent');

    // Mermaid用のユニークIDを生成
    const mermaidId = `mermaid-${Date.now()}`;

    // Mermaidコンテナを作成
    flowchartContainer.innerHTML = `
        <div class="alert alert-success mb-3">
            <i class="fas fa-check-circle me-2"></i>
            フローチャートが生成されました
        </div>
        <div class="mermaid" id="${mermaidId}">
            ${mermaidCode}
        </div>
        <details class="mt-3">
            <summary class="btn btn-sm btn-outline-secondary">生成されたMermaidコードを表示</summary>
            <pre class="mt-2 p-2 bg-light border rounded" style="max-height: 400px; overflow-y: auto;"><code>${escapeHtml(mermaidCode)}</code></pre>
        </details>
    `;

    // Mermaid.jsで再レンダリング（非同期処理）
    setTimeout(() => {
        try {
            const element = document.getElementById(mermaidId);
            if (element) {
                // Mermaidを再初期化
                mermaid.init(undefined, element).then(() => {
                    console.log('Mermaid rendering successful');
                    // レンダリング後にクリックイベントを追加
                    attachFlowchartClickEvents(mermaidId);
                }).catch(error => {
                    console.error('Mermaid rendering error:', error);
                    showMermaidError(flowchartContainer, error, mermaidCode);
                });
            }
        } catch (error) {
            console.error('Mermaid rendering error:', error);
            showMermaidError(flowchartContainer, error, mermaidCode);
        }
    }, 100);
}

// フローチャートのノードにクリックイベントを追加
function attachFlowchartClickEvents(mermaidId) {
    setTimeout(() => {
        const container = document.getElementById(mermaidId);
        if (!container) {
            console.error('フローチャートコンテナが見つかりません:', mermaidId);
            return;
        }

        // SVG内の全ノードを取得
        const nodes = container.querySelectorAll('.node');

        let attachedCount = 0;
        nodes.forEach((node) => {
            // ノードのIDを取得（Mermaidが生成したID）
            const flowchartId = node.getAttribute('id');
            if (!flowchartId) return;

            // flowchart-NodeName-Number形式からNodeName（実際のノードID）を抽出
            const match = flowchartId.match(/^flowchart-(.+)-\d+$/);
            if (!match) return;

            const nodeId = match[1];

            // 詳細情報が存在する場合のみクリック可能にする
            if (currentNodeDetails && currentNodeDetails[nodeId]) {
                // ノード全体とその子要素すべてにカーソルを設定
                node.style.cursor = 'pointer';
                const allElements = node.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.cursor = 'pointer';
                });

                // イベントキャプチャフェーズでリスナーを追加（子要素のクリックも確実に捕捉）
                const clickHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('ノードクリック:', nodeId, currentNodeDetails[nodeId]);
                    showNodeDetailsModal(nodeId, currentNodeDetails[nodeId]);
                };

                // 親ノードに追加
                node.addEventListener('click', clickHandler, true); // キャプチャフェーズ

                // 子要素にも追加して確実に捕捉
                allElements.forEach(el => {
                    el.addEventListener('click', clickHandler, true);
                });

                attachedCount++;
            }
        });

        console.log(`${attachedCount}個のノードにクリックイベントを追加しました`);
    }, 500); // Mermaidのレンダリング完了を待つ
}

function showMermaidError(container, error, mermaidCode) {
    container.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-circle me-2"></i>
            <strong>フローチャートの描画に失敗しました</strong>
            <br><small>Mermaid記法にエラーがある可能性があります。</small>
            <hr>
            <strong>エラー詳細:</strong>
            <pre class="mt-2" style="white-space: pre-wrap;">${escapeHtml(error.message || error.toString())}</pre>
        </div>
        <div class="alert alert-info">
            <strong>対処方法:</strong>
            <ul class="mb-0">
                <li>もう一度「フローチャート生成」ボタンをクリックしてください</li>
                <li>以下のMermaidコードをコピーして、<a href="https://mermaid.live" target="_blank">Mermaid Live Editor</a>で確認できます</li>
            </ul>
        </div>
        <details open class="mt-3">
            <summary class="btn btn-sm btn-outline-secondary">生成されたMermaidコード</summary>
            <div class="mt-2">
                <button class="btn btn-sm btn-primary mb-2" onclick="copyMermaidCode('${btoa(encodeURIComponent(mermaidCode))}')">
                    <i class="fas fa-copy me-1"></i>コピー
                </button>
                <pre class="p-2 bg-light border rounded" style="max-height: 400px; overflow-y: auto;"><code>${escapeHtml(mermaidCode)}</code></pre>
            </div>
        </details>
    `;
}

function copyMermaidCode(base64Code) {
    try {
        const code = decodeURIComponent(atob(base64Code));
        navigator.clipboard.writeText(code).then(() => {
            alert('Mermaidコードをクリップボードにコピーしました');
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('コピーに失敗しました');
        });
    } catch (error) {
        console.error('Decode error:', error);
        alert('コピーに失敗しました');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ノード詳細情報をモーダルで表示
function showNodeDetailsModal(nodeId, details) {
    const modal = document.getElementById('nodeDetailsModal');
    if (!modal) {
        console.error('nodeDetailsModal not found');
        return;
    }

    const modalBody = document.getElementById('nodeDetailsModalBody');

    // 詳細情報を整形して表示
    let html = `
        <table class="table table-bordered">
            <tbody>
    `;

    // アクション番号（一覧表示の番号）
    if (details.actionIndex !== null && details.actionIndex !== undefined) {
        html += `
                <tr>
                    <th style="width: 30%;">アクション番号</th>
                    <td><strong class="text-primary">#${details.actionIndex}</strong> <small class="text-muted">(一覧表示の番号)</small></td>
                </tr>
        `;
    }

    html += `
                <tr>
                    <th>ノードID</th>
                    <td><code>${escapeHtml(nodeId)}</code></td>
                </tr>
                <tr>
                    <th>アクション種類</th>
                    <td><span class="badge bg-primary">${escapeHtml(details.actionType)}</span></td>
                </tr>
    `;

    if (details.actionName) {
        html += `
                <tr>
                    <th>アクション名</th>
                    <td>${escapeHtml(details.actionName)}</td>
                </tr>
        `;
    }

    if (details.externalApp) {
        html += `
                <tr>
                    <th>外部アプリケーション</th>
                    <td><i class="fas fa-external-link-alt me-2"></i>${escapeHtml(details.externalApp)}</td>
                </tr>
        `;
    }

    if (details.label) {
        html += `
                <tr>
                    <th>表示ラベル</th>
                    <td>${escapeHtml(details.label.replace(/\\n/g, ' '))}</td>
                </tr>
        `;
    }

    html += `
            </tbody>
        </table>
    `;

    modalBody.innerHTML = html;

    // Bootstrap 5のモーダルを表示
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// 緊急時手動実行ガイド生成（PA/PAD不使用）
// PA/PADが使えない場合に、自動化されていた業務を手作業で行うためのガイドを生成
async function generateUserGuide() {
    if (!currentSessionId) {
        alert('セッションIDが見つかりません');
        return;
    }

    const btn = document.getElementById('generateUserGuideBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>生成中...';

    try {
        const response = await fetch(`/api/user-guide/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                solution_name: document.getElementById('fileName').textContent || 'PAソリューション'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'ユーザーガイド生成に失敗しました');
        }

        const result = await response.json();
        displayUserGuide(result.user_guide);

    } catch (error) {
        if (error.message.includes('OpenAI')) {
            document.getElementById('userGuideContent').innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    OpenAI APIキーが設定されていないため、手動実行ガイド生成機能は利用できません。
                    <br><small>.envファイルでOPENAI_API_KEYを設定してください。</small>
                </div>
            `;
        } else {
            alert('エラー: ' + error.message);
        }
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot me-1"></i>ガイド生成';
    }
}

// 手動実行ガイドを表示
function displayUserGuide(userGuide) {
    if (typeof userGuide === 'string') {
        const html = `
            <div class="border rounded p-4 bg-white">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0"><i class="fas fa-book-open me-2"></i>緊急時手動実行ガイド（PA/PAD不使用）</h5>
                    <button class="btn btn-sm btn-outline-primary" onclick="copyUserGuideToClipboard()">
                        <i class="fas fa-copy me-1"></i>コピー
                    </button>
                </div>
                <div class="user-guide-content" style="white-space: pre-wrap; line-height: 1.8; font-size: 0.95rem;">
${userGuide}
                </div>
            </div>
        `;
        document.getElementById('userGuideContent').innerHTML = html;
    } else {
        document.getElementById('userGuideContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                手動実行ガイドの形式が不正です
            </div>
        `;
    }
}

// 手動実行ガイドをクリップボードにコピー
async function copyUserGuideToClipboard() {
    const content = document.querySelector('.user-guide-content');
    if (content) {
        try {
            await navigator.clipboard.writeText(content.textContent);
            alert('手動実行ガイドをクリップボードにコピーしました');
        } catch (err) {
            console.error('コピーに失敗しました:', err);
            alert('コピーに失敗しました');
        }
    }
}

/**
 * ファイル選択時の表示更新 (追加分)
 */
/**
 * ファイル選択時の表示更新（イベントからも直接呼び出しからも対応）
 */
function handleFileSelect(e) {
    // 1. 引数がイベント(e)ならファイルを取得、そうでなければ引数そのものがファイル
    const file = (e && e.target && e.target.files) ? e.target.files[0] : e;
    
    if (!file) return;

    console.log("handleFileSelect processing:", file.name);

    // 2. ZIPファイルチェック
    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert('ZIPファイルを選択してください。');
        clearFile();
        return;
    }

    // 3. グローバル変数に保持
    selectedZipFile = file;

    // 4. ボタンの下の青枠エリア（selectedFileNameContainer）に名前を表示
    const container = document.getElementById('selectedFileNameContainer');
    const nameSpan = document.getElementById('targetFileName');
    
    if (container && nameSpan) {
        nameSpan.textContent = file.name;
        container.style.display = 'block'; 
    }
    
    // 5. 解析開始ボタンを有効化
    const analyzeButton = document.getElementById('analyzeButton');
    if (analyzeButton) {
        analyzeButton.disabled = false; 
    }

    console.log('File selection UI updated and Analyze button enabled');
}

/**
 * ファイル解除時の表示リセット (追加分)
 */
function clearFile(event) {
    if (event && event.stopPropagation) event.stopPropagation(); 
    
    selectedZipFile = null;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    const container = document.getElementById('selectedFileNameContainer');
    if (container) container.style.display = 'none'; 
    
    const analyzeButton = document.getElementById('analyzeButton');
    if (analyzeButton) analyzeButton.disabled = true; 
}

//function downloadAsCSV(aiResponseText) {
    //const rows = [
        //["作業ステップ", "手順詳細", "仕様アプリシステム", "インプット", "アウトプット"]
    //];

    //if (!aiResponseText || aiResponseText.includes("AI生成」ボタンをクリック") || aiResponseText.trim().length < 10) {
        //alert("先にAI生成を完了させてください。内容が空の状態では出力できません。");
        //return;
    //}

    //const lines = aiResponseText.split('\n');
    //let stepData = { name: "", detail: "", system: "", input: "", output: "" };

    //const pushCurrentStep = () => {
        //if (stepData.name) {
            //rows.push([
                //stepData.name,
                //stepData.detail || "なし",
                //stepData.system || "なし",
                //stepData.input  || "なし",
                //stepData.output || "なし"
            //]);
        //}
    //};

    //lines.forEach(line => {
        //const trimmed = line.trim();
        //if (!trimmed) return;

      
        //const stepMatch = trimmed.match(/^(?:###\s*|\d+\.\s*|\*\*\d+\.\s*)(.+)/);
        //if (stepMatch) {
            //pushCurrentStep();
            // ステップ名から余計な記号(**や[])を削除
            //const cleanName = stepMatch[1].replace(/[\*\[\]]/g, '').trim();
            //stepData = { name: cleanName, detail: "", system: "", input: "", output: "" };
            //return;
        //}

        // 2. 各項目の検出 (ラベルが含まれているかチェック)
        // AIが古いラベル「具体的な操作」等で出力しても、自動で新しい列にマッピングします
        //if (trimmed.match(/手順詳細|具体的な操作/)) {
            //stepData.detail = trimmed.split(/[:：]/)[1]?.trim() || "";
        //} else if (trimmed.match(/仕様アプリシステム|使用システム|サイト名|外部アプリ/)) {
            //stepData.system = trimmed.split(/[:：]/)[1]?.trim() || "";
        //} else if (trimmed.match(/インプット|使用データ|参照データ/)) {
            //stepData.input = trimmed.split(/[:：]/)[1]?.trim() || "";
        //} else if (trimmed.match(/アウトプット|データ連携|保存先/)) {
            //stepData.output = trimmed.split(/[:：]/)[1]?.trim() || "";
        //}
    //});

    //pushCurrentStep(); // 最後のステップを追加

    // データがヘッダーしかない場合は警告
    //if (rows.length <= 1) {
        //alert("解析可能なデータが見つかりませんでした。AI生成を再度行い、フォーマットを確認してください。");
        //return;
    //}

    // CSV文字列作成
    //const csvContent = rows.map(r => 
        //r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")
    //).join("\n");

    //const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    //const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
    //const link = document.createElement("a");
    //link.href = URL.createObjectURL(blob);
    //link.download = `業務要件定義書_${new Date().getTime()}.csv`;
    //link.click();
//}
//0309追加開く
/**
 * AIの回答をExcelに変換（コロン分割の不具合修正・パス情報保持版）
 */
function downloadAsExcel(aiResponseText) {
    if (typeof XLSX === 'undefined') {
        alert("Excelライブラリが読み込まれていません。");
        return;
    }
    //Excel出力リスト
    const header = ["No","業務観点", "作業ステップ", "手順詳細", "仕様アプリシステム", "インプット", "アウトプット","フロー名"];
    const rows = [];

    if (!aiResponseText || aiResponseText.trim().length < 10) {
        alert("データが空か、解析可能な形式ではありません。");
        return;
    }

    const lines = aiResponseText.split('\n');
    let stepData = { name: "", detail: "", system: "", input: "", output: "" , flowname: ""};
    let noCounter = 1;

    // 項目を抽出するための補助関数（最初のコロン以降をすべて取得）
    const extractContent = (line) => {
        const colonIndex = line.indexOf(':') !== -1 ? line.indexOf(':') : line.indexOf('：');
        if (colonIndex === -1) return "";
        return line.substring(colonIndex + 1).trim();
    };

    const pushCurrentStep = () => {
        if (stepData.name && !stepData.name.includes("一連の流れ")) {
            if (stepData.name.includes("補足")) {
                let supplementaryDetail = stepData.detail || "";
                if (stepData.input && stepData.input !== "なし") supplementaryDetail += "\n" + stepData.input;
                rows.push([noCounter++, "補足", supplementaryDetail.trim(), "なし", "なし", "なし"]);
            } else {
                rows.push([
                    noCounter++, 
                    stepData.name,
                    stepData.detail || "なし",
                    stepData.system || "なし",
                    stepData.input || "なし",
                    stepData.output || "なし",
                    stepData.flowname || "なし"
                ]);
            }
        }
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // ステップ名/セクションタイトルの検出
        const stepMatch = trimmed.match(/^(?:###\s*|\d+\.\s*|\*\*\d+\.\s*|#\s*)(.+)/);
        if (stepMatch) {
            pushCurrentStep();
            const cleanName = stepMatch[1].replace(/[\*\[\]【】]/g, '').trim();
            stepData = { name: cleanName, detail: "", system: "", input: "", output: "" };
            return;
        }

        // データのマッピング（extractContent関数を使用してコロンが複数あっても対応）
        if (trimmed.match(/手順詳細|具体的な操作/)) {
            stepData.detail = extractContent(trimmed);
        } else if (trimmed.match(/仕様アプリシステム|使用システム/)) {
            stepData.system = extractContent(trimmed);
        } else if (trimmed.match(/インプット|使用データ/)) {
            stepData.input = extractContent(trimmed);
        } else if (trimmed.match(/アウトプット|実行結果/)) {
            stepData.output = extractContent(trimmed);
        } else if (trimmed.match(/フロー名/)) {
            stepData.flowname = extractContent(trimmed);
        } else if (trimmed.startsWith('- ') && stepData.name.includes("補足")) {
            stepData.detail = (stepData.detail ? stepData.detail + "\n" : "") + trimmed;
        }
    });

    pushCurrentStep();

    // --- 以降、Excel生成とスタイル設定 ---
    const wsData = [header, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
            if (!worksheet[cell_ref]) continue;

            worksheet[cell_ref].s = {
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                },
                alignment: { vertical: "top", horizontal: "left", wrapText: true }
            };

            if (R === 0) {
                worksheet[cell_ref].s.fill = { fgColor: { rgb: "FFFF00" } };
                worksheet[cell_ref].s.font = { sz: 16, bold: true };
                worksheet[cell_ref].s.alignment.horizontal = "center";
            }
            if (C === 0 && R > 0) {
                worksheet[cell_ref].s.alignment.horizontal = "center";
            }
        }
    }

    worksheet['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 65 }, { wch: 25 }, { wch: 35 }, { wch: 35 },{ wch: 40 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "業務要件定義");
    XLSX.writeFile(workbook, `業務要件定義書_${new Date().getTime()}.xlsx`);
}
//0309追加閉じ