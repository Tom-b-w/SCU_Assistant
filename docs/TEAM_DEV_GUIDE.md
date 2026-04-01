# 团队开发指南 — 无需 Docker 的本地开发

本指南帮助团队成员在 **无法安装 Docker Desktop** 的 Windows 电脑上搭建完整开发环境。

## 前置要求

只需安装两样东西：

| 工具 | 版本要求 | 下载地址 |
|------|---------|---------|
| Python | >= 3.11 | https://www.python.org/downloads/ |
| Node.js | >= 18 | https://nodejs.org/ |

> **安装 Python 时**：务必勾选 **"Add Python to PATH"**

---

## 零、Fork 用户必读

如果你是 **fork** 仓库而不是直接 clone，请先做以下设置：

```bash
# 1. 添加上游仓库（只需一次）
git remote add upstream https://github.com/Tom-b-w/SCU_Assistant.git

# 2. 每次开发前，先同步上游最新代码
git fetch upstream
git merge upstream/master

# 3. 同步后重新安装依赖（如果 package.json 或 pyproject.toml 有变动）
cd backend && pip install -e ".[dev]"
cd ../frontend && npm install
```

> **重要**：上游已修复所有 ESLint 和 TypeScript 构建错误。如果你 fork 后遇到 lint 或 build 失败，请先执行上述同步操作。

---

## 一、首次搭建（约 5 分钟）

### 1. 获取代码

```bash
# 直接 clone（推荐）
git clone https://github.com/Tom-b-w/SCU_Assistant.git
cd SCU_Assistant

# 或者 fork 后 clone 你自己的仓库
git clone https://github.com/你的用户名/SCU_Assistant.git
cd SCU_Assistant
git remote add upstream https://github.com/Tom-b-w/SCU_Assistant.git
```

### 2. 安装后端依赖

```bash
cd backend

# 方式一：Conda（推荐，详见 CONDA_DEV_GUIDE.md）
conda create -n scu python=3.11 -y
conda activate scu
pip install -e ".[dev]"

# 方式二：venv
python -m venv .venv
# Windows CMD: .venv\Scripts\activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Git Bash / macOS / Linux: source .venv/bin/activate
pip install -e ".[dev]"
```

> pip 慢？换清华源：`pip install -e ".[dev]" -i https://pypi.tuna.tsinghua.edu.cn/simple`

### 3. 安装前端依赖

```bash
cd ../frontend
npm install
```

> npm 慢？换淘宝源：`npm config set registry https://registry.npmmirror.com && npm install`

### 4. 启动项目

**终端 1 — 后端**（以下两种方式任选其一）

```bash
cd backend

# 方式一：使用启动脚本（自动加载 .env.dev + 热重载）
python start_dev.py --reload

# 方式二：直接用 uvicorn（也会自动加载 .env.dev，无需额外配置）
uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload
```

**终端 2 — 前端**

```bash
cd frontend
npm run dev
```

### 5. 验证启动成功

| 地址 | 预期结果 |
|------|---------|
| http://localhost:3000 | 前端页面正常显示 |
| http://localhost:8000/docs | 后端 Swagger API 文档 |
| http://localhost:8000/health | `{"status":"ok","services":{"database":"ok","redis":"ok"}}` |

### 6. 登录测试

项目默认启用 Mock 模式（`JWC_USE_MOCK=true`），无需真实教务系统账号：

- **学号**：任意 5 位以上数字（如 `20231234567`）
- **密码**：任意字符（如 `123456`）
- **验证码**：任意字符（如 `abcd`）

> 如需使用真实教务系统数据，需在校园网环境下，将 `backend/.env.dev` 中的 `JWC_USE_MOCK` 改为 `false`。

## 二、日常开发流程

### 2.1 修改代码 → 看效果

| 修改位置 | 行为 | 说明 |
|----------|------|------|
| `frontend/src/**` | **自动刷新** | Next.js 热模块替换，保存即生效 |
| `backend/**/*.py` | **自动重启** | watchfiles 监听文件变化（需 `--reload`） |
| `backend/.env.dev` | 手动重启 | 环境变量修改需重启后端 |

**如果后端没有自动重启**：在后端终端按 `Ctrl+C`，然后重新运行 `python start_dev.py --reload`

### 2.2 Git 协作流程

```
main (主分支，保持稳定)
 ├── feat/schedule-ui      ← 张三: 课表页面优化
 ├── feat/chat-stream      ← 李四: AI 对话流式输出
 └── fix/login-bug         ← 王五: 修复登录问题
```

**日常操作：**

```bash
# 1. 开始新功能 — 从 main 创建分支
git checkout main
git pull origin main
git checkout -b feat/你的功能名

# 2. 写代码，保存后浏览器/后端自动更新

# 3. 提交代码
git add .
git commit -m "feat: 添加了XXX功能"

# 4. 推送到远程
git push origin feat/你的功能名

# 5. 在 GitHub 上创建 Pull Request → 让队友 Review → 合并到 main
```

**Commit 消息规范：**
```
feat: 新功能（如 feat: 添加考试倒计时页面）
fix:  修 bug（如 fix: 修复登录时的密码加密问题）
docs: 文档（如 docs: 更新 API 接口说明）
style: 样式调整（如 style: 优化侧边栏间距）
refactor: 重构（如 refactor: 重构天气服务逻辑）
```

### 2.3 解决合并冲突

```bash
# 当你的分支落后于 main 时
git checkout main
git pull origin main
git checkout feat/你的分支
git merge main

# 如果有冲突，手动编辑冲突文件，然后
git add .
git commit -m "merge: 合并 main 分支"
```

## 三、项目结构速查

```
SCU_Assistant/
├── frontend/                    # 前端（Next.js）
│   └── src/
│       ├── app/(main)/          # 页面（每个文件夹 = 一个页面）
│       │   ├── chat/            #   AI 对话
│       │   ├── academic/        #   课表/成绩/DDL/考试/RAG/选课
│       │   ├── campus/          #   校车/校历
│       │   ├── food/            #   食堂
│       │   ├── weather/         #   天气
│       │   └── settings/        #   设置
│       ├── components/          # 可复用组件
│       ├── lib/                 # API 请求封装
│       └── stores/              # 状态管理（Zustand）
│
├── backend/                     # 后端（FastAPI）
│   ├── gateway/                 #   入口 + 认证
│   ├── services/                #   业务逻辑（每个功能一个文件夹）
│   │   ├── chat/                #     AI 对话
│   │   ├── academic/            #     教务数据
│   │   ├── rag/                 #     课件问答
│   │   ├── deadline/            #     DDL
│   │   ├── weather/             #     天气
│   │   └── ...
│   ├── shared/                  #   公共模块（数据库/缓存/配置）
│   └── .env.dev                 #   开发环境配置
│
├── start_dev.bat                # Windows 一键启动
└── docs/                        # 文档
```

## 四、分工开发示例

### 场景：3 人同时开发不同功能

| 成员 | 分支名 | 工作内容 | 需修改的文件 |
|------|--------|---------|-------------|
| 张三 | `feat/exam-ui` | 优化考试倒计时页面 | `frontend/src/app/(main)/academic/exam/page.tsx` |
| 李四 | `feat/bus-data` | 更新校车时刻数据 | `frontend/src/app/(main)/campus/bus/page.tsx` |
| 王五 | `feat/notif-api` | 完善通知爬虫 | `backend/services/notification/service.py` |

**因为修改的文件不同，三人可以完全独立开发，互不影响。**

### 前后端联调

如果你负责前端页面，对应的后端 API 已经写好（Mock 模式提供测试数据），你可以：

1. 启动项目后，在浏览器打开页面查看效果
2. 在 http://localhost:8000/docs 查看 API 文档和测试 API
3. 修改前端代码，浏览器实时更新

如果你负责后端 API，可以：

1. 在 http://localhost:8000/docs 的 Swagger UI 直接测试接口
2. 或用 Postman / curl 测试

## 五、提交代码前必做检查

**推送代码前请务必确认 lint 和 build 通过**，避免影响其他成员：

```bash
# 前端检查（在 frontend/ 目录下）
npm run lint          # ESLint 检查，应该 0 errors 0 warnings
npm run build         # TypeScript 编译 + 页面生成，应该无报错

# 如果 lint 有报错，尝试自动修复
npx eslint --fix
```

> 如果 `npm run lint` 或 `npm run build` 有错误，**不要推送**，先修复。

## 六、环境配置说明

`.env.dev` 已提交到仓库，clone 后**无需修改**即可启动。核心配置：

```env
DATABASE_URL=sqlite+aiosqlite:///./dev_scu.db    # SQLite，自动创建
REDIS_URL=memory://                               # 内存缓存，无需 Redis
JWC_USE_MOCK=true                                 # Mock 教务数据
LLM_AUTH_TOKEN=sk-xxx...                          # AI 对话 API Key（已配置）
LLM_BASE_URL=https://api3.xhub.chat              # LLM API 地址
LLM_MODEL=claude-sonnet-4-20250514                 # 使用的模型
```

**不要创建 `backend/.env` 文件**（已在 `.gitignore` 中）。如果你本地存在 `backend/.env`，它会覆盖 `.env.dev` 的配置，导致尝试连接 PostgreSQL 而失败。

## 七、常见问题

### Q: ESLint / Build 报错
先同步最新代码：
```bash
git pull origin master           # 或 git fetch upstream && git merge upstream/master
cd frontend && npm install       # 更新依赖
npm run lint                     # 重新检查
```

### Q: 启动后端报 `ModuleNotFoundError`
确保激活了虚拟环境并安装了依赖：
```bash
cd backend
conda activate scu               # 或 .venv\Scripts\activate
pip install -e ".[dev]"
```

### Q: 启动后端报连接 PostgreSQL 失败
检查是否存在 `backend/.env` 文件。如果有，删除它或重命名：
```bash
# 在 backend/ 目录下
mv .env .env.bak                 # 备份
# 或
del .env                         # 直接删除
```
项目会自动使用 `.env.dev`（SQLite + 内存缓存）。

### Q: 端口被占用（8000 或 3000）
```bash
# 查找占用端口的进程
netstat -ano | findstr :8000
# 根据 PID 结束进程
taskkill /F /PID <PID号>
```

### Q: 前端 npm install 很慢
使用国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### Q: pip install 很慢
使用清华镜像：
```bash
pip install -e ".[dev]" -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q: 后端修改代码后没有自动重启
确认启动时用了 `--reload` 参数：
```bash
python start_dev.py --reload
# 或
uvicorn gateway.main:app --reload
```
如果提示缺少 watchfiles，运行 `pip install watchfiles`。

### Q: `dev_scu.db` 数据库出问题了
直接删除重启即可，会自动重建：
```bash
del backend\dev_scu.db           # Windows CMD
rm backend/dev_scu.db            # Git Bash
```

### Q: Git pull 后报错
可能是依赖更新了：
```bash
cd frontend && npm install
cd ../backend && pip install -e ".[dev]"
```

### Q: 登录失败
- Mock 模式：学号需 >= 5 位数字，密码任意
- 真实模式（`JWC_USE_MOCK=false`）：需在校园网环境下，使用真实教务系统学号密码
