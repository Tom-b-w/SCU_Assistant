#!/bin/bash
# SCU Assistant 本地开发环境启动脚本 (macOS/Linux)

set -e

echo "========================================"
echo "  SCU Assistant 本地开发环境"
echo "  无需 Docker / PostgreSQL / Redis"
echo "========================================"
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.11+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/4] 配置后端虚拟环境..."
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -e ".[dev]" -q

echo "[2/4] 安装前端依赖..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "     node_modules 已存在，跳过"
fi

echo "[3/4] 启动后端 (http://localhost:8000)..."
cd "$SCRIPT_DIR/backend"
source .venv/bin/activate
python start_dev.py --reload &
BACKEND_PID=$!

echo "[4/4] 启动前端 (http://localhost:3000)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 2
echo ""
echo "========================================"
echo "  开发环境已启动！"
echo ""
echo "  前端: http://localhost:3000  (自动热更新)"
echo "  后端: http://localhost:8000  (自动热重载)"
echo "  API:  http://localhost:8000/docs"
echo ""
echo "  修改前端代码 → 浏览器自动刷新"
echo "  修改后端代码 → 服务自动重启"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
