# SCU Assistant — 系统设计文档

## 1. 项目概述

### 1.1 项目简介

SCU Assistant 是一款面向四川大学在校学生的智能校园助手 Web 应用。通过自然语言对话和传统页面导航的双入口模式，覆盖学业、吃喝、校园基础服务等高频场景，帮助学生高效获取校园信息。

### 1.2 项目背景

- **性质：** 软件工程课程团队项目
- **团队：** 8+ 人，有前端/后端/AI/运维专项分工
- **周期：** 一个学期（~16 周）
- **目标：** 规范的软件开发流程 + 功能完整的智能校园助手

### 1.3 核心设计原则

- **双入口：** 自然语言对话 + 传统页面导航并存
- **模块解耦：** 按领域拆分微服务，团队可并行开发
- **AI 原生：** LLM Function Calling 驱动意图路由，非硬编码规则
- **渐进增强：** MVP 先行，P1/P2 按优先级迭代

---

## 2. 功能优先级

### 2.1 P0 — MVP 必须交付（第 1-10 周）

| 模块 | 功能 | 理由 |
|------|------|------|
| 学业 | 课表查询、DDL 追踪、选课推荐 | 高频刚需，体现核心价值 |
| 吃喝 | 食堂营业状态、窗口导览、"今天吃什么" | 数据静态可控，上手快，演示效果好 |
| 校园基础 | 校车时刻、校历查询 | 简单但实用，撑起基础体验 |
| Agent | 自然语言路由、用户记忆 | 架构核心，所有功能依赖它 |

### 2.2 P1 — 重要扩展（第 10-14 周）

| 模块 | 功能 |
|------|------|
| 学业 | 考试倒计时 + AI 复习计划、课件 RAG 问答 |
| 吃喝 | 校外美食推荐（高德 POI） |
| 校园基础 | 校园通知聚合（爬虫 + AI 摘要） |
| Agent | Morning Briefing、跨源推理 |
| 玩乐 | 天气 + 穿衣建议 |

### 2.3 P2 — 锦上添花（有余力再做）

| 模块 | 功能 |
|------|------|
| 科研 | GPU 监控、训练通知、arXiv 日报、论文 RAG |
| 学业 | 一键评教 |
| 吃喝 | 一卡通余额/消费 |
| 玩乐 | 周末规划、校园活动、快递追踪 |
| 校园基础 | 图书馆查书 |

---

## 3. 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端框架 | Next.js 14 (App Router) | RSC + SSR，SEO 友好，API Routes 可做轻量 BFF |
| 样式 | TailwindCSS 4 | 原子化 CSS，团队协作一致性高 |
| 组件库 | shadcn/ui | 可定制、设计精美、不锁定依赖 |
| 状态管理 | Zustand | 轻量，比 Redux 简洁 |
| 请求层 | TanStack Query | 缓存、重试、乐观更新开箱即用 |
| 表单 | React Hook Form + Zod | 类型安全的表单校验 |
| 图表 | Recharts | 基于 D3，与 React 集成好 |
| 后端框架 | Python FastAPI | AI/爬虫/数据处理最佳生态 |
| 数据库 | PostgreSQL | JSONB 支持，成熟稳定 |
| 缓存 | Redis | 高频查询缓存 + 轻量消息队列 |
| 向量数据库 | Milvus | 开源向量库，RAG 检索 |
| AI 框架 | LangChain | LLM 编排、RAG、工具调用 |
| LLM | 商业 API（OpenAI / 通义千问等） | 开发效率高 |
| 容器化 | Docker Compose | 单机编排，避免 K8s 运维负担 |
| CI/CD | GitHub Actions | 与 GitHub 天然集成 |

---

## 4. 系统架构

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    用户层                             │
│  Next.js 14 (App Router) + TailwindCSS + shadcn/ui  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 学业  │ │ 吃喝  │ │ 校园  │ │ 玩乐  │ │ Agent│      │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘      │
└─────┼────────┼────────┼────────┼────────┼───────────┘
      │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────┐
│               API Gateway (FastAPI)                  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐     │
│  │ Auth (JWT) │ │ Rate Limit│ │ Intent Router  │     │
│  └────────────┘ └──────────┘ └────────────────┘     │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│ 业务微服务    ││   AI 服务     ││  数据服务     │
│              ││              ││              │
│ academic-svc ││ llm-gateway  ││ PostgreSQL   │
│ food-svc     ││ rag-engine   ││ Redis        │
│ campus-svc   ││ intent-cls   ││ Milvus       │
│ crawler-svc  ││              ││              │
└──────────────┘└──────────────┘└──────────────┘
```

### 4.2 微服务拆分

| 服务 | 职责 | 共享数据源 |
|------|------|-----------|
| `academic-svc` | 课表、DDL、选课、考试 | 教务系统数据 |
| `food-svc` | 食堂状态、窗口导览、美食推荐 | 餐饮静态数据 + 高德 POI |
| `campus-svc` | 校车、校历、通知 | 校园基础数据 |
| `crawler-svc` | 统一爬虫服务 | 教务处/学院网站 |
| `llm-gateway` | 封装 LLM API 调用 | 商业 LLM API |
| `rag-engine` | 向量化 + 检索 | Milvus |

### 4.3 服务间通信

- **同步：** 服务间 HTTP 调用（通过 Gateway 内部路由）
- **异步：** Redis Streams 做轻量消息队列（爬虫结果推送、定时任务触发）

---

## 5. 前端架构

### 5.1 页面结构

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (main)/
│   ├── layout.tsx              # 侧边栏 + 顶栏布局
│   ├── page.tsx                # 首页 Dashboard (Morning Briefing)
│   ├── chat/page.tsx           # 主对话页（自然语言入口）
│   ├── academic/
│   │   ├── schedule/page.tsx   # 课表视图
│   │   ├── deadline/page.tsx   # DDL 看板
│   │   └── course-select/page.tsx
│   ├── food/
│   │   ├── canteen/page.tsx    # 食堂导览
│   │   └── recommend/page.tsx
│   ├── campus/
│   │   ├── bus/page.tsx        # 校车时刻
│   │   └── calendar/page.tsx   # 校历
│   └── settings/page.tsx       # 个人设置/偏好
├── api/                        # Next.js API Routes (轻量 BFF)
└── components/
    ├── ui/                     # shadcn/ui 组件
    ├── chat/                   # 对话相关组件
    ├── schedule/               # 课表相关组件
    └── layout/                 # 布局组件
```

### 5.2 UI 设计理念

- **双入口模式：** 顶部搜索栏支持自然语言输入（类 Spotlight），同时保留传统页面导航
- **响应式设计：** 桌面端侧边栏布局，移动端底部 Tab 栏，为小程序适配打基础
- **暗色/亮色主题：** shadcn/ui 原生支持
- **流式对话：** SSE 实现打字机效果，AI 回答实时渲染

---

## 6. 后端架构

### 6.1 项目结构

```
backend/
├── gateway/                    # API Gateway (FastAPI 主服务)
│   ├── main.py
│   ├── auth/                   # JWT 认证
│   ├── middleware/             # 限流、日志、CORS
│   └── router/                # 路由注册
├── services/
│   ├── academic/
│   │   ├── schedule.py
│   │   ├── deadline.py
│   │   ├── course_recommend.py
│   │   └── models.py
│   ├── food/
│   │   ├── canteen.py
│   │   ├── recommend.py
│   │   └── models.py
│   ├── campus/
│   │   ├── bus.py
│   │   ├── calendar.py
│   │   └── models.py
│   ├── crawler/
│   │   ├── jwc.py
│   │   ├── notice.py
│   │   └── scheduler.py
│   └── ai/
│       ├── llm_gateway.py
│       ├── intent_router.py
│       ├── rag_engine.py
│       └── memory.py
├── shared/
│   ├── database.py
│   ├── cache.py
│   ├── config.py
│   └── schemas.py
└── tests/
```

### 6.2 数据模型

```sql
-- 用户
users (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    campus VARCHAR(20),          -- 望江/江安/华西
    major VARCHAR(100),
    grade INTEGER,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 课表
schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    course_name VARCHAR(200) NOT NULL,
    teacher VARCHAR(100),
    location VARCHAR(200),
    weekday INTEGER NOT NULL,    -- 1-7
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    weeks INTEGER[] NOT NULL,    -- 上课周次
    semester VARCHAR(20) NOT NULL
);

-- DDL
deadlines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    course_name VARCHAR(200),
    due_date TIMESTAMPTZ NOT NULL,
    priority VARCHAR(10) DEFAULT 'medium',  -- low/medium/high
    status VARCHAR(20) DEFAULT 'pending',   -- pending/completed
    source VARCHAR(20) DEFAULT 'manual',    -- manual/crawler
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 食堂
canteens (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    campus VARCHAR(20) NOT NULL,
    building VARCHAR(100),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    meal_type VARCHAR(20) NOT NULL,  -- breakfast/lunch/dinner
    is_active BOOLEAN DEFAULT TRUE
);

-- 食堂窗口
canteen_windows (
    id SERIAL PRIMARY KEY,
    canteen_id INTEGER REFERENCES canteens(id),
    name VARCHAR(100) NOT NULL,
    category TEXT[] NOT NULL,        -- 品类标签
    floor INTEGER,
    description TEXT
);

-- 校车时刻
bus_schedules (
    id SERIAL PRIMARY KEY,
    route VARCHAR(100) NOT NULL,
    departure_campus VARCHAR(20) NOT NULL,
    arrival_campus VARCHAR(20) NOT NULL,
    departure_time TIME NOT NULL,
    is_weekend BOOLEAN DEFAULT FALSE,
    semester VARCHAR(20) NOT NULL
);

-- 用户记忆 (AI)
user_memories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,   -- taste/campus/academic/behavior
    confidence FLOAT DEFAULT 1.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对话历史
conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 认证方案

JWT + Refresh Token 双 token 模式。学号作为唯一标识，首次登录通过教务系统验证身份。

### 6.4 缓存策略

| 数据 | 缓存方式 | TTL |
|------|----------|-----|
| 课表、校历、校车 | Redis | 24h（学期内基本不变） |
| 食堂状态 | 根据营业时间静态计算 | 无需缓存 |
| LLM 响应 | 相似问题哈希缓存 | 1h |

### 6.5 爬虫调度

APScheduler 定时任务：
- 教务通知：每 30 分钟
- 考试安排：每天 1 次

---

## 7. AI 核心层

### 7.1 自然语言路由（Intent Router）

采用 LLM Function Calling 实现意图识别：

```
用户输入 → LLM (function calling) → 识别意图 + 提取参数 → 调用对应服务 → 格式化回答
```

每个功能定义为一个 Tool/Function，LLM 自动选择调用。

**示例：**
- "明天有什么课？" → `query_schedule(date="2026-03-16")`
- "江安哪里有麻辣烫？" → `query_canteen(campus="江安", category="麻辣烫")`

### 7.2 RAG 引擎

```
文档上传 → 分片(chunk) → Embedding → 存入 Milvus
用户提问 → Query Embedding → 向量检索 Top-K → 拼接 Prompt → LLM 生成回答
```

- **分片策略：** 按段落 + 滑动窗口，chunk_size=512 tokens，overlap=64
- **Embedding：** `text-embedding-3-small` 或通义千问 Embedding
- **检索：** 向量检索 + BM25 关键词混合排序（Hybrid Search）

### 7.3 用户记忆系统

```
对话结束 → LLM 提取关键偏好 → 存入 user_memories 表
新对话开始 → 加载用户记忆 → 注入 System Prompt
```

| 记忆类型 | 示例 | 存储方式 |
|---------|------|----------|
| 口味偏好 | "不吃辣"、"喜欢面食" | KV + 置信度 |
| 校区信息 | "住在江安" | KV |
| 学业信息 | "软件工程专业大三" | KV |
| 行为习惯 | "经常问食堂推荐" | 计数器 |

**隐私保护：** 用户可在设置页查看/删除所有记忆条目，记忆仅用于个性化，不跨用户共享。

### 7.4 跨源推理（P1）

多源信息（天气、课表、食堂状态、DDL）聚合后交给 LLM 做综合推理，生成个性化建议。

---

## 8. DevOps 与团队协作

### 8.1 Git 工作流（GitHub Flow）

```
main (保护分支，需 PR + Code Review)
 ├── feat/academic-schedule
 ├── feat/food-canteen
 ├── fix/login-bug
 └── docs/api-spec
```

**分支命名规范：**
- `feat/<module>-<feature>` — 新功能
- `fix/<description>` — Bug 修复
- `refactor/<description>` — 重构
- `docs/<description>` — 文档
- `test/<description>` — 测试

**Commit 规范（Conventional Commits）：**
```
feat(academic): 添加课表查询接口
fix(food): 修复食堂营业时间判断逻辑
docs(api): 更新选课推荐接口文档
test(campus): 添加校车时刻单元测试
```

**PR 规范：**
- 至少 1 人 Code Review 通过才能合并
- CI 全部通过（lint + test + build）
- PR 描述模板：改了什么 / 为什么改 / 怎么测试

### 8.2 CI/CD Pipeline (GitHub Actions)

```yaml
# 触发: 每次 Push / PR
jobs:
  lint:        # ESLint + Ruff (Python linter)
  test:        # pytest + vitest，覆盖率 > 70%
  build:       # Docker 构建
  deploy-dev:  # PR 合并到 main → 自动部署到开发环境
```

### 8.3 Docker Compose 编排

```yaml
services:
  frontend:      # Next.js, port 3000
  gateway:       # FastAPI Gateway, port 8000
  academic-svc:  # port 8001
  food-svc:      # port 8002
  campus-svc:    # port 8003
  crawler-svc:   # port 8004
  ai-svc:        # port 8005
  postgres:      # port 5432
  redis:         # port 6379
  milvus:        # port 19530
```

### 8.4 团队分工

| 角色 | 人数 | 职责 |
|------|------|------|
| 前端组 | 2-3 人 | Next.js 页面、组件开发、对话 UI |
| 后端组 | 2-3 人 | FastAPI 服务、数据库、爬虫 |
| AI 组 | 1-2 人 | LLM 集成、RAG、意图路由、记忆 |
| 基建/PM | 1 人 | CI/CD、Docker、项目管理、文档 |

### 8.5 文档规范

```
docs/
├── api/                  # API 文档 (OpenAPI/Swagger 自动生成)
├── architecture/         # 架构设计文档
├── guides/
│   ├── dev-setup.md      # 开发环境搭建
│   ├── git-workflow.md   # Git 协作规范
│   └── coding-style.md   # 代码风格指南
└── meeting-notes/        # 周会记录
```

### 8.6 项目管理

- GitHub Projects 看板（To Do / In Progress / Review / Done）
- 周迭代：周一定计划，周五 Demo
- GitHub Issues 跟踪 Bug 和需求

---

## 9. 开发时间线（16 周）

| 阶段 | 周次 | 目标 | 交付物 |
|------|------|------|--------|
| Sprint 0 — 基建 | W1-2 | 项目脚手架、CI/CD、开发环境 | Git 仓库、Docker Compose、CI 流水线、开发文档 |
| Sprint 1 — 核心骨架 | W3-4 | 前端框架 + Gateway + 认证 + 数据库 | 登录注册、主布局、API Gateway、数据库 migration |
| Sprint 2 — 学业 MVP | W5-6 | 课表查询 + DDL 追踪 | 课表页面、DDL 看板、教务系统对接 |
| Sprint 3 — 吃喝 + 校园 | W7-8 | 食堂导览 + 校车校历 | 食堂查询页、校车时刻页、校历页 |
| Sprint 4 — AI 对话 | W9-10 | 自然语言路由 + 对话 UI + 用户记忆 | Chat 页面、意图路由、P0 功能接入对话 |
| Sprint 5 — P1 扩展 | W11-12 | 选课推荐 + 考试倒计时 + RAG + 天气 | 选课推荐页、AI 复习计划、课件问答 |
| Sprint 6 — 打磨 | W13-14 | Morning Briefing + 跨源推理 + 通知聚合 | Dashboard、爬虫通知、UI 打磨 |
| Sprint 7 — 收尾 | W15-16 | 测试、修 Bug、文档完善、答辩准备 | 测试报告、用户手册、答辩 PPT |

### 里程碑

- **W4：** 骨架验收 — 能登录，能看到主界面
- **W8：** 半程验收 — 课表、食堂、校车可用
- **W10：** MVP 验收 — 自然语言对话完成所有 P0 功能
- **W14：** 功能冻结 — P1 完成，UI 精美
- **W16：** 最终交付 — Bug 清零，文档齐全
