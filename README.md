# SCU Assistant — 四川大学智能校园助手

基于 **Next.js 16 + FastAPI** 的全栈校园生活助手，为四川大学学生提供课表查询、成绩查看、AI 智能问答、校园通知、天气穿衣建议等一站式服务。

## 功能模块

| 模块 | 说明 |
|------|------|
| **教务数据** | 对接四川大学教务系统 (zhjw.scu.edu.cn)，登录后自动抓取课表、成绩、培养方案完成度并缓存 |
| **AI 对话** | 基于 Anthropic Claude API 的智能助手"小川"，支持 Tool Use 自动调用课表/成绩/DDL 等工具 |
| **RAG 文档问答** | 上传 PDF/PPT 文档，基于 ChromaDB 向量检索 + LLM 生成回答 |
| **智能出题** | AI 根据上传文档自动生成练习题 |
| **复习计划** | AI 生成个性化复习计划 |
| **校园通知** | 教务处、学工部、研究生院通知聚合展示 |
| **DDL 管理** | 作业/考试截止日期管理与提醒 |
| **天气穿衣** | 基于和风天气 API 的实时天气 + 多维穿衣建议（温度/湿度/风力/天况） |
| **校车查询** | 江安↔望江校区校车时刻表 |
| **食堂信息** | 各校区食堂营业状态与推荐 |
| **每日简报** | 聚合今日课表、天气、DDL 等信息的首页仪表盘 |

## 技术栈

### 前端
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + shadcn/ui 组件
- **Zustand** 状态管理（auth 持久化至 localStorage，chat 持久化至 sessionStorage）
- **Axios** HTTP 客户端 + **React Query**

### 后端
- **FastAPI** + **Uvicorn** (ASGI)
- **SQLAlchemy 2.0** (async) + **PostgreSQL 16** + **Alembic** 数据库迁移
- **Redis 7** 会话缓存 + 天气缓存
- **httpx** 异步 HTTP 客户端（教务系统爬虫）
- **ChromaDB** 向量数据库（RAG 文档检索）
- **Anthropic Claude API** (Tool Use)

### 基础设施
- **Docker Compose** 一键启动 PostgreSQL + Redis
- 支持 `.env` 环境变量配置

## 项目结构

```
SCU_Assistant/
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/(main)/         # 主布局下的各页面
│   │   │   ├── page.tsx        # 首页仪表盘
│   │   │   ├── chat/           # AI 对话
│   │   │   ├── academic/       # 课表、成绩、DDL、考试、RAG
│   │   │   ├── campus/         # 校车、校历
│   │   │   ├── food/           # 食堂
│   │   │   ├── weather/        # 天气穿衣
│   │   │   ├── notification/   # 校园通知
│   │   │   ├── dashboard/      # 每日简报
│   │   │   └── settings/       # 设置
│   │   ├── components/layout/  # 侧边栏、顶栏
│   │   ├── lib/                # API 客户端封装
│   │   └── stores/             # Zustand 状态管理
│   └── package.json
├── backend/                    # FastAPI 后端
│   ├── gateway/                # 网关层（入口、认证、中间件）
│   │   ├── main.py             # FastAPI 应用入口
│   │   ├── auth/router.py      # 登录/注册/刷新 Token
│   │   └── middleware/         # CORS 等中间件
│   ├── services/               # 业务服务层
│   │   ├── academic/           # 教务数据（课表、成绩、培养方案）
│   │   ├── chat/               # AI 对话 + Tool Use
│   │   ├── rag/                # RAG 文档问答
│   │   ├── quiz/               # 智能出题
│   │   ├── studyplan/          # 复习计划
│   │   ├── deadline/           # DDL 管理
│   │   ├── notification/       # 校园通知
│   │   ├── weather/            # 天气服务
│   │   ├── briefing/           # 每日简报
│   │   └── memory/             # 用户记忆（AI 个性化）
│   ├── shared/                 # 公共模块（config, models, database, cache）
│   ├── alembic/                # 数据库迁移
│   └── pyproject.toml
├── docker-compose.yml          # PostgreSQL + Redis
└── docs/                       # 项目文档、周报
```

## 快速开始

> **无需 Docker！** 项目支持纯本地开发模式（SQLite + 内存缓存），无需安装 Docker Desktop。详见下方"方式 B"。

### 前置要求

- **Node.js** >= 18（推荐 20+）
- **Python** >= 3.11
- **Docker** 和 **Docker Compose**（可选，仅方式 A 需要）

### 1. 克隆仓库

```bash
git clone https://github.com/Tom-b-w/SCU_Assistant.git
cd SCU_Assistant
```

### 方式 A：Docker 开发（需要 Docker Desktop）

```bash
# 启动数据库服务
docker compose up -d postgres redis

# 配置后端
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"

# 创建 .env 并配置（见下方环境变量说明）
# 执行数据库迁移
alembic upgrade head

# 启动后端
python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000

# 启动前端（新终端）
cd ../frontend
npm install && npm run dev
```

### 方式 B：无 Docker 本地开发（推荐团队协作）

**不需要安装 Docker**，使用 SQLite 替代 PostgreSQL，内存缓存替代 Redis。

提供三种启动方式，任选其一：

#### B-1. 一键启动（双击 bat）

```bash
# Windows：双击根目录的 start_dev.bat
# macOS/Linux：
chmod +x start_dev.sh && ./start_dev.sh
```

自动完成虚拟环境创建、依赖安装、前后端启动，无需手动操作。

#### B-2. Conda 环境（推荐，适合团队统一环境）

> 详细指南见 [docs/CONDA_DEV_GUIDE.md](docs/CONDA_DEV_GUIDE.md)

**首次搭建（只需一次）：**

```bash
# 创建 Conda 环境
conda create -n scu python=3.11 -y
conda activate scu

# 安装后端依赖
cd backend
pip install -e ".[dev]"

# 安装前端依赖
cd ../frontend
npm install
```

**日常开发（每次两个终端）：**

```bash
# 终端 1 — 后端（支持热重载，改代码自动重启）
cd backend
conda activate scu
python start_dev.py --reload

# 终端 2 — 前端（自带热更新，改代码浏览器自动刷新）
cd frontend
npm run dev
```

浏览器打开 http://localhost:3000 即可使用，http://localhost:8000/docs 查看 API 文档。

#### B-3. venv 手动启动

```bash
# 后端
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
python start_dev.py --reload

# 前端（新终端）
cd frontend
npm install
npm run dev
```

#### 开发环境说明

`.env.dev` 已预配置好，**无需修改**，核心配置：
```env
DATABASE_URL=sqlite+aiosqlite:///./dev_scu.db    # SQLite 文件数据库
REDIS_URL=memory://                               # 内存缓存（fakeredis）
JWC_USE_MOCK=true                                 # Mock 教务数据
```

> SQLite 数据库文件 `dev_scu.db` 会自动创建在 backend 目录下，首次启动自动建表。

#### 方式 B 的功能说明

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 对话 / 流式输出 | ✅ | 需配置 LLM API Key |
| 课表 / 成绩 / 培养方案 | ✅ | Mock 模式，14门课 + 20门成绩 |
| DDL 管理 | ✅ | 完全支持 |
| 考试倒计时 | ✅ | 完全支持 |
| 课件问答 (RAG) | ✅ | 需配置 Embedding API Key |
| 天气穿衣 | ✅ | 不配置 API Key 时使用 Mock 数据 |
| 校车 / 校历 / 食堂 | ✅ | 静态数据，完全支持 |
| 选课推荐 | ✅ | 需配置 LLM API Key |
| 校园通知 | ⚠️ | 爬虫依赖外网，校外可能无法抓取 |

### 方式 C：Docker Compose 全量启动

```bash
docker compose up -d
```

一次性启动前端（:3000）、后端（:8000）、PostgreSQL（:5432）、Redis（:6379）。

## 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | `postgresql+asyncpg://postgres:postgres@localhost:5432/scu_assistant` | PostgreSQL 连接串 |
| `REDIS_URL` | 是 | `redis://localhost:6379/0` | Redis 连接串 |
| `JWT_SECRET_KEY` | 是 | 内置默认值 | JWT 签名密钥，**生产环境必须更换** |
| `LLM_API_KEY` | 否 | 空 | Anthropic API Key，AI 对话需要 |
| `LLM_AUTH_TOKEN` | 否 | 空 | 备用认证 Token（与 `LLM_API_KEY` 二选一） |
| `LLM_BASE_URL` | 否 | `https://api3.xhub.chat` | LLM API 基础 URL |
| `LLM_MODEL` | 否 | `claude-sonnet-4-20250514` | 使用的 LLM 模型 |
| `JWC_USE_MOCK` | 否 | `true` | 教务系统 mock 模式开关 |
| `JWC_BASE_URL` | 否 | `http://zhjw.scu.edu.cn` | 教务系统地址 |
| `QWEATHER_API_KEY` | 否 | 空 | 和风天气 API Key，不配置则用 mock 天气数据 |
| `EMBEDDING_MODEL` | 否 | `text-embedding-3-small` | Embedding 模型（RAG 功能） |
| `EMBEDDING_API_KEY` | 否 | 空 | Embedding API Key，留空复用 LLM Key |

## 已知问题与注意事项

### 教务系统 (JWC) 相关

1. **XUANKE_LB 负载均衡 Cookie**：四川大学教务系统使用 `XUANKE_LB` cookie 做后端服务器路由（sticky session）。登录时必须同时保存 `JSESSIONID` 和 `XUANKE_LB` 两个 cookie，否则后续请求会被分发到不同后端服务器导致会话失效、数据为空。本项目已将 session 存储格式改为 JSON (`{"session": "xxx", "lb": "yyy"}`) 以携带两个 cookie。

2. **登录重定向检测**：教务系统在会话过期时会重定向到 `/gotoLogin`（注意大写 L），代码中已使用大小写不敏感匹配来检测登录过期。

3. **Mock 模式**：设置 `JWC_USE_MOCK=true` 时使用内置 mock 数据，无需连接真实教务系统，适用于开发和演示。

### AI 对话相关

4. **LLM 未配置**：如果未设置 `LLM_API_KEY` 或 `LLM_AUTH_TOKEN`，AI 对话会返回友好提示"AI 对话功能尚未配置"，不会报错。

5. **Tool Use 条件**：AI 工具调用（查课表、查成绩等）需要用户已登录且有有效的教务系统 session，否则 AI 只提供通用对话能力。

### 前端相关

6. **登录状态持久化**：使用 Zustand `persist` 中间件将认证状态存储在 `localStorage`，刷新页面或切换路由后不会丢失登录态。

7. **聊天记录持久化**：AI 对话记录存储在 `sessionStorage`（关闭浏览器标签页后清除），切换页面后对话记录不会丢失。点击"新对话"按钮可手动清除。

8. **`useSearchParams` 与 SSR**：Next.js 中使用 `useSearchParams` 的组件必须包裹在 `<Suspense>` 中，否则构建时会报错。

### 开发环境

9. **Windows 下 `--reload` 问题**：在 Windows 上使用 `uvicorn --reload` 可能产生僵尸 Python 进程，导致端口占用和旧代码未更新。建议开发时不使用 `--reload`，手动重启；如遇问题用 `taskkill /F /IM python.exe` 清理。

10. **Docker 容器依赖**：后端启动前需确保 PostgreSQL 和 Redis 容器已 healthy。可以通过 `docker compose ps` 查看状态，或用 `curl http://localhost:8000/health` 检查后端连接状态。

## API 文档

后端启动后访问：
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

主要 API 端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 教务系统账号登录 |
| POST | `/api/auth/refresh` | 刷新 JWT Token |
| GET | `/api/academic/schedule` | 获取课表 |
| GET | `/api/academic/scores` | 获取成绩 |
| GET | `/api/academic/plan-completion` | 培养方案完成度 |
| POST | `/api/chat` | AI 对话 |
| GET | `/api/notifications` | 校园通知列表 |
| GET | `/api/weather` | 天气信息 |
| GET | `/api/deadlines` | DDL 列表 |
| POST | `/api/rag/query` | RAG 文档问答 |
| GET | `/api/briefing/today` | 今日简报 |

## 团队协作指南

> - [docs/CONDA_DEV_GUIDE.md](docs/CONDA_DEV_GUIDE.md) — **Conda 环境搭建**（推荐，最直接）
> - [docs/TEAM_DEV_GUIDE.md](docs/TEAM_DEV_GUIDE.md) — 完整团队协作指南（Git 工作流、分工示例、FAQ）

### 环境选择

| 场景 | 推荐方式 | 说明 |
|------|----------|------|
| 无法安装 Docker | **方式 B** | SQLite + fakeredis，零外部依赖 |
| 个人开发 / 功能调试 | **方式 B** | 启动快，资源占用少 |
| 集成测试 / 上线前验证 | **方式 A** | 使用 PostgreSQL + Redis，接近生产环境 |
| 演示 / 部署 | **方式 C** | Docker Compose 一键启动 |

### 注意事项

1. **`.env.dev` 已提交到仓库**，团队成员 clone 后即可使用方式 B 开发
2. **`dev_scu.db` 不要提交**（已在 `.gitignore` 中），每人本地独立数据库
3. **LLM API Key** 需团队内部共享（见 `.env.dev` 中的配置），请勿公开
4. Windows 开发时避免使用 `uvicorn --reload`，可能产生僵尸进程

## 许可证

本项目仅供学习交流使用。
