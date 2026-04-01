"""开发环境启动脚本 — 自动加载 .env.dev 并启动 uvicorn"""
import os
import sys

# 加载 .env.dev
env_file = os.path.join(os.path.dirname(__file__), ".env.dev")
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#") and line:
                k, v = line.split("=", 1)
                os.environ[k] = v

import uvicorn

# Windows 上 --reload 用 watchfiles 后端（需要 pip install watchfiles）
# 检测是否可用，可用则开启热重载
use_reload = False
if "--reload" in sys.argv or "-r" in sys.argv:
    try:
        import watchfiles  # noqa: F401
        use_reload = True
        print("[dev] 热重载已启用 (watchfiles)")
    except ImportError:
        print("[dev] 提示: 安装 watchfiles 可启用热重载: pip install watchfiles")
        print("[dev] 当前以普通模式启动，修改代码后需手动重启 (Ctrl+C 后重新运行)")

uvicorn.run(
    "gateway.main:app",
    host="0.0.0.0",
    port=8000,
    reload=use_reload,
    reload_dirs=["gateway", "services", "shared"] if use_reload else None,
)
