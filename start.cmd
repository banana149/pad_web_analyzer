@echo off
chcp 65001 > nul
echo ================================================
echo Power Automate Desktop アクション解析ツール 起動
echo ================================================
echo.

cd /d "%~dp0"

:: node_modulesの存在確認
if not exist "node_modules" (
    echo [1/3] 依存関係をインストールしています...
    call npm install
    if errorlevel 1 (
        echo.
        echo エラー: npm install に失敗しました
        echo Node.jsがインストールされているか確認してください
        pause
        exit /b 1
    )
    echo 依存関係のインストールが完了しました
    echo.
) else (
    echo [1/3] 依存関係は既にインストール済みです
    echo.
)

:: .envファイルの存在確認
if not exist ".env" (
    echo [2/3] 環境設定ファイルを作成しています...
    if exist ".env.example" (
        copy ".env.example" ".env" > nul
        echo .envファイルを作成しました
    ) else (
        echo 警告: .env.exampleが見つかりません
        echo デフォルト設定でサーバーを起動します
    )
    echo.
) else (
    echo [2/3] 環境設定ファイルは既に存在します
    echo.
)

:: サーバー起動
echo [3/3] サーバーを起動しています...
echo サーバーURL: http://localhost:5000
echo.
echo ブラウザを起動しています...
echo サーバーを停止するには Ctrl+C を押してください
echo ================================================
echo.

:: ブラウザを起動（5秒後）
start "" cmd /c "timeout /t 5 /nobreak > nul && start http://localhost:5000"

:: Node.jsサーバーを起動
call npm start
