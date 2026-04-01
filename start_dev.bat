@echo off
chcp 65001 >nul
title SCU Assistant - 开发环境

echo ========================================
echo   SCU Assistant 本地开发环境
echo   无需 Docker / PostgreSQL / Redis
echo ========================================
echo.

:: 检查 Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.11+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 安装后端依赖...
cd /d "%~dp0backend"
if not exist .venv (
    echo      创建 Python 虚拟环境...
    python -m venv .venv
)
call .venv\Scripts\activate
pip install -e ".[dev]" -q 2>nul
echo      后端依赖安装完成

echo [2/4] 安装前端依赖...
cd /d "%~dp0frontend"
if not exist node_modules (
    call npm install
) else (
    echo      node_modules 已存在，跳过
)

echo [3/4] 启动后端 (http://localhost:8000)...
cd /d "%~dp0backend"
start "SCU-Backend" cmd /k "call .venv\Scripts\activate && python start_dev.py --reload"

echo [4/4] 启动前端 (http://localhost:3000)...
cd /d "%~dp0frontend"
start "SCU-Frontend" cmd /k "npm run dev"

timeout /t 3 >nul

echo.
echo ========================================
echo   开发环境已启动！
echo.
echo   前端: http://localhost:3000  (自动热更新)
echo   后端: http://localhost:8000  (自动热重载)
echo   API:  http://localhost:8000/docs
echo.
echo   修改前端代码 → 浏览器自动刷新
echo   修改后端代码 → 服务自动重启
echo ========================================
echo.
echo 关闭方式: 关闭 SCU-Backend 和 SCU-Frontend 两个窗口
pause
