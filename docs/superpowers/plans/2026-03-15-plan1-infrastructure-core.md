# Plan 1: 基础设施 + 核心骨架实施计划

> **致 Agent 工作者:** 必须: 使用 superpowers:subagent-driven-development（如果有子代理可用）或 superpowers:executing-plans 来实施本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标:** 构建项目基础 — 单体仓库脚手架、Docker 环境、CI/CD 流水线、认证系统，以及带导航的主应用外壳。

**架构:** Next.js 14 前端与 FastAPI 网关后端通信。所有业务服务作为网关进程中的模块运行。PostgreSQL 用于持久化，Redis 用于缓存。Docker Compose 在本地编排所有服务。

**技术栈:** Next.js 14 (App Router), TailwindCSS 4, shadcn/ui, Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis 7, Docker Compose, GitHub Actions, JWT 认证。

**规范:** `docs/superpowers/specs/2026-03-15-scu-assistant-design.md`

---

## 文件结构

```
SCU_Assistant/
├── .github/
│   └── workflows/
│       ├── ci-frontend.yml        # 前端代码检查 + 测试 + 构建
│       └── ci-backend.yml         # 后端代码检查 + 测试
├── .gitignore
├── docker-compose.yml             # 所有服务编排
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── .env.example
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                 # 根布局（providers、字体）
│   │   │   ├── (auth)/
│   │   │   │   ├── layout.tsx             # 认证布局（居中卡片）
│   │   │   │   └── login/page.tsx         # 登录页面
│   │   │   └── (main)/
│   │   │       ├── layout.tsx             # 主布局（侧边栏 + 顶栏）
│   │   │       └── page.tsx               # 仪表盘占位符
│   │   ├── components/
│   │   │   ├── ui/                        # shadcn/ui 组件（自动生成）
│   │   │   └── layout/
│   │   │       ├── sidebar.tsx            # 侧边栏导航
│   │   │       ├── topbar.tsx             # 顶栏（搜索 + 用户菜单）
│   │   │       └── mobile-nav.tsx         # 移动端底部标签栏
│   │   ├── lib/
│   │   │   ├── api.ts                     # Axios 实例（含拦截器）
│   │   │   ├── auth.ts                    # 认证辅助函数（令牌管理）
│   │   │   └── utils.ts                   # shadcn/ui cn() 工具函数
│   │   ├── stores/
│   │   │   └── auth-store.ts              # Zustand 认证状态
│   │   └── types/
│   │       └── api.ts                     # 共享 API 类型
│   └── __tests__/
│       ├── components/
│       │   └── layout/
│       │       └── sidebar.test.tsx
│       └── lib/
│           ├── api.test.ts
│           └── auth.test.ts
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml                     # Python 项目配置 (uv/pip)
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/                      # 迁移文件
│   ├── .env.example
│   ├── gateway/
│   │   ├── __init__.py
│   │   ├── main.py                        # FastAPI 应用工厂
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── router.py                  # /api/auth/* 端点
│   │   │   ├── service.py                 # 认证业务逻辑
│   │   │   ├── dependencies.py            # get_current_user 依赖
│   │   │   └── schemas.py                 # 登录请求/响应模型
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── cors.py                    # CORS 配置
│   │       └── rate_limit.py              # Redis 滑动窗口限流器
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── database.py                    # SQLAlchemy 引擎 + 会话
│   │   ├── models.py                      # SQLAlchemy ORM 模型（users 表）
│   │   ├── config.py                      # Pydantic Settings 配置
│   │   ├── cache.py                       # Redis 客户端封装
│   │   └── exceptions.py                  # 自定义异常 + 错误处理器
│   └── tests/
│       ├── conftest.py                    # 测试夹具（测试客户端、测试数据库）
│       ├── test_auth_router.py            # 认证端点测试
│       ├── test_auth_service.py           # 认证服务单元测试
│       └── test_rate_limit.py             # 限流器测试
└── docs/
    └── guides/
        └── dev-setup.md                   # 开发环境搭建指南
```

---

## Chunk 1: 项目脚手架与 Docker 环境

### Task 1: 初始化单体仓库与 Git

**文件:**
- 创建: `.gitignore`
- 创建: `frontend/package.json`（占位符）
- 创建: `backend/pyproject.toml`（占位符）

- [ ] **步骤 1: 创建 .gitignore**

```gitignore
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Environment
.env
.env.local
.env.production

# Build
.next/
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Docker
*.log

# Superpowers
.superpowers/
```

- [ ] **步骤 2: 提交初始 gitignore**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

### Task 2: 后端项目搭建

**文件:**
- 创建: `backend/pyproject.toml`
- 创建: `backend/.env.example`
- 创建: `backend/gateway/__init__.py`
- 创建: `backend/gateway/main.py`
- 创建: `backend/shared/__init__.py`
- 创建: `backend/shared/config.py`

- [ ] **步骤 1: 创建 backend/pyproject.toml**

```toml
[project]
name = "scu-assistant-backend"
version = "0.1.0"
description = "SCU Assistant Backend API"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pydantic-settings>=2.6.0",
    "redis>=5.2.0",
    "pyjwt>=2.10.0",
    "httpx>=0.28.0",
    "python-multipart>=0.0.18",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
    "ruff>=0.8.0",
    "pytest-cov>=6.0.0",
]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **步骤 2: 创建 backend/.env.example**

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/scu_assistant

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=change-me-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# LLM (P0: Qwen)
LLM_API_KEY=
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
CHAT_RATE_LIMIT_PER_MINUTE=20
```

- [ ] **步骤 3: 创建 backend/shared/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/scu_assistant"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Rate Limiting
    rate_limit_per_minute: int = 60
    chat_rate_limit_per_minute: int = 20

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

- [ ] **步骤 4: 创建 backend/gateway/main.py（最小 FastAPI 应用）**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(
        title="SCU Assistant API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **步骤 5: 创建空的 __init__.py 文件**

创建空的 `backend/gateway/__init__.py` 和 `backend/shared/__init__.py`。

- [ ] **步骤 6: 验证后端在本地启动**

```bash
cd backend
pip install -e ".[dev]"
uvicorn gateway.main:app --reload --port 8000
# 访问 http://localhost:8000/health → {"status": "ok"}
# 访问 http://localhost:8000/docs → Swagger UI
```

- [ ] **步骤 7: 提交**

```bash
git add backend/
git commit -m "feat: initialize backend project with FastAPI"
```

---

### Task 3: 前端项目搭建

**文件:**
- 创建: `frontend/package.json`
- 创建: `frontend/tsconfig.json`
- 创建: `frontend/next.config.ts`
- 创建: `frontend/tailwind.config.ts`
- 创建: `frontend/.env.example`
- 创建: `frontend/src/app/layout.tsx`
- 创建: `frontend/src/app/page.tsx`
- 创建: `frontend/src/lib/utils.ts`

- [ ] **步骤 1: 初始化 Next.js 项目**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **步骤 2: 安装额外依赖**

```bash
cd frontend
npm install zustand @tanstack/react-query axios zod react-hook-form @hookform/resolvers
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

- [ ] **步骤 3: 创建 frontend/.env.example**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **步骤 4: 初始化 shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
# 选择: New York 样式, Zinc 颜色, CSS 变量: yes
```

- [ ] **步骤 5: 添加核心 shadcn/ui 组件**

```bash
cd frontend
npx shadcn@latest add button input card avatar dropdown-menu sheet separator toast
```

- [ ] **步骤 6: 创建 vitest 配置**

创建 `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

创建 `frontend/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

添加到 `frontend/package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **步骤 7: 替换默认页面为占位符**

替换 `frontend/src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">SCU Assistant</h1>
    </main>
  );
}
```

- [ ] **步骤 8: 验证前端构建和运行**

```bash
cd frontend
npm run build
npm run dev
# 访问 http://localhost:3000 → 显示 "SCU Assistant" 标题
```

- [ ] **步骤 9: 提交**

```bash
git add frontend/
git commit -m "feat: initialize frontend with Next.js, TailwindCSS, shadcn/ui"
```

---

### Task 4: Docker Compose 环境

**文件:**
- 创建: `docker-compose.yml`
- 创建: `backend/Dockerfile`
- 创建: `frontend/Dockerfile`

- [ ] **步骤 1: 创建 backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

CMD ["uvicorn", "gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **步骤 2: 创建 frontend/Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

CMD ["npm", "start"]
```

- [ ] **步骤 3: 创建 docker-compose.yml**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - gateway

  gateway:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: scu_assistant
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **步骤 4: 创建本地 Docker 用的 backend/.env**

将 `backend/.env.example` 复制为 `backend/.env` 并更新:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/scu_assistant
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=dev-secret-change-in-production
```

- [ ] **步骤 5: 验证 Docker Compose 启动所有服务**

```bash
docker compose up -d --build
docker compose ps
# 所有服务应显示 "Up" / "healthy"
curl http://localhost:8000/health
# → {"status": "ok"}
curl http://localhost:3000
# → HTML with "SCU Assistant"
docker compose down
```

- [ ] **步骤 6: 提交**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile
git commit -m "feat: add Docker Compose with all services"
```

---

### Task 5: CI/CD 流水线 (GitHub Actions)

**文件:**
- 创建: `.github/workflows/ci-backend.yml`
- 创建: `.github/workflows/ci-frontend.yml`

- [ ] **步骤 1: 创建后端 CI 工作流**

创建 `.github/workflows/ci-backend.yml`:

```yaml
name: Backend CI

on:
  push:
    paths: ["backend/**"]
  pull_request:
    paths: ["backend/**"]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff
      - run: ruff check backend/
      - run: ruff format --check backend/

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: scu_assistant_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd backend && pip install -e ".[dev]"
      - run: cd backend && pytest --cov=gateway --cov=shared --cov-report=term-missing -v
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/scu_assistant_test
          REDIS_URL: redis://localhost:6379/0
          JWT_SECRET_KEY: test-secret
```

- [ ] **步骤 2: 创建前端 CI 工作流**

创建 `.github/workflows/ci-frontend.yml`:

```yaml
name: Frontend CI

on:
  push:
    paths: ["frontend/**"]
  pull_request:
    paths: ["frontend/**"]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
```

- [ ] **步骤 3: 验证工作流语法（可选）**

```bash
# 如果已安装 actionlint:
actionlint .github/workflows/ci-backend.yml .github/workflows/ci-frontend.yml
# 否则，推送到分支并在 GitHub 上验证工作流是否触发
```

- [ ] **步骤 4: 提交**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows for frontend and backend"
```

---

## Chunk 2: 数据库与认证后端

### Task 6: 使用 SQLAlchemy + Alembic 搭建数据库

**文件:**
- 创建: `backend/shared/database.py`
- 创建: `backend/shared/models.py`
- 创建: `backend/alembic.ini`
- 创建: `backend/alembic/env.py`

- [ ] **步骤 1: 创建 backend/shared/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

- [ ] **步骤 2: 创建 backend/shared/models.py（users 表）**

```python
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    campus: Mapped[str | None] = mapped_column(String(20))
    major: Mapped[str | None] = mapped_column(String(100))
    grade: Mapped[int | None] = mapped_column(Integer)
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **步骤 3: 初始化 Alembic**

```bash
cd backend
alembic init alembic
```

- [ ] **步骤 4: 配置 alembic/env.py**

替换 `backend/alembic/env.py`:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from shared.config import settings
from shared.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **步骤 5: 更新 alembic.ini**

在 `backend/alembic.ini` 中，将 `sqlalchemy.url` 设为空（我们使用 settings 代替）:

```ini
sqlalchemy.url =
```

- [ ] **步骤 6: 生成初始迁移**

```bash
cd backend
alembic revision --autogenerate -m "create users table"
```

- [ ] **步骤 7: 运行迁移并验证**

```bash
cd backend
alembic upgrade head
# 验证：连接到 PostgreSQL 并检查 users 表是否存在
```

- [ ] **步骤 8: 提交**

```bash
git add backend/shared/database.py backend/shared/models.py backend/alembic.ini backend/alembic/
git commit -m "feat: add SQLAlchemy models and Alembic migrations for users table"
```

---

### Task 7: Redis 缓存搭建

**文件:**
- 创建: `backend/shared/cache.py`

- [ ] **步骤 1: 创建 backend/shared/cache.py**

```python
import redis.asyncio as redis

from shared.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> redis.Redis:
    return redis_client
```

- [ ] **步骤 2: 在 gateway/main.py 中添加 Redis 健康检查**

更新 `backend/gateway/main.py`:

```python
from fastapi import FastAPI
from sqlalchemy import text

from shared.cache import redis_client
from shared.database import engine


def create_app() -> FastAPI:
    app = FastAPI(
        title="SCU Assistant API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.get("/health")
    async def health_check():
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"

        try:
            await redis_client.ping()
            redis_status = "ok"
        except Exception:
            redis_status = "error"

        status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
        return {
            "status": status,
            "services": {"database": db_status, "redis": redis_status},
        }

    return app


app = create_app()
```

- [ ] **步骤 3: 提交**

```bash
git add backend/shared/cache.py backend/gateway/main.py
git commit -m "feat: add Redis cache setup and enhanced health check"
```

---

### Task 8: 错误处理与中间件

**文件:**
- 创建: `backend/shared/exceptions.py`
- 创建: `backend/gateway/middleware/cors.py`
- 创建: `backend/gateway/middleware/rate_limit.py`
- 创建: `backend/gateway/middleware/__init__.py`

- [ ] **步骤 1: 创建 backend/shared/exceptions.py**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(code="NOT_FOUND", message=message, status=404)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(code="UNAUTHORIZED", message=message, status=401)


class RateLimitError(AppError):
    def __init__(self):
        super().__init__(
            code="RATE_LIMITED", message="Too many requests, please try later", status=429
        )


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(code="SERVICE_UNAVAILABLE", message=message, status=503)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code, "message": exc.message, "status": exc.status}},
        )
```

- [ ] **步骤 2: 创建 backend/gateway/middleware/cors.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

- [ ] **步骤 3: 编写限流器的失败测试**

创建 `backend/tests/test_rate_limit.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch

from gateway.middleware.rate_limit import check_rate_limit


@pytest.mark.asyncio
async def test_rate_limit_allows_under_limit():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "5"
    mock_redis.ttl.return_value = 30

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is True


@pytest.mark.asyncio
async def test_rate_limit_blocks_over_limit():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "61"
    mock_redis.ttl.return_value = 30

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is False


@pytest.mark.asyncio
async def test_rate_limit_creates_key_if_not_exists():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is True
    mock_redis.set.assert_called_once()
```

- [ ] **步骤 4: 运行测试验证其失败**

```bash
cd backend
pytest tests/test_rate_limit.py -v
```

**预期:** 失败 — `ModuleNotFoundError: No module named 'gateway.middleware.rate_limit'`

- [ ] **步骤 5: 创建 backend/gateway/middleware/rate_limit.py**

```python
import redis.asyncio as redis


async def check_rate_limit(
    redis_client: redis.Redis,
    key: str,
    limit: int,
    window: int = 60,
) -> bool:
    """Fixed-window counter rate limiter. Returns True if request is allowed."""
    current = await redis_client.get(key)

    if current is None:
        await redis_client.set(key, 1, ex=window)
        return True

    if int(current) >= limit:
        return False

    await redis_client.incr(key)
    return True
```

- [ ] **步骤 6: 创建 backend/gateway/middleware/__init__.py**

空文件。

- [ ] **步骤 7: 运行测试验证其通过**

```bash
cd backend
pytest tests/test_rate_limit.py -v
```

**预期:** 3 个测试通过

- [ ] **步骤 8: 将中间件接入 main.py**

更新 `backend/gateway/main.py`:

```python
from fastapi import FastAPI
from sqlalchemy import text

from gateway.middleware.cors import setup_cors
from shared.cache import redis_client
from shared.database import engine
from shared.exceptions import register_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(
        title="SCU Assistant API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    setup_cors(app)
    register_error_handlers(app)

    @app.get("/health")
    async def health_check():
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"

        try:
            await redis_client.ping()
            redis_status = "ok"
        except Exception:
            redis_status = "error"

        status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
        return {
            "status": status,
            "services": {"database": db_status, "redis": redis_status},
        }

    return app


app = create_app()
```

- [ ] **步骤 9: 提交**

```bash
git add backend/shared/exceptions.py backend/gateway/middleware/ backend/tests/test_rate_limit.py backend/gateway/main.py
git commit -m "feat: add error handling, CORS, and rate limiting middleware"
```

---

### Task 9: JWT 认证服务

**文件:**
- 创建: `backend/gateway/auth/__init__.py`
- 创建: `backend/gateway/auth/schemas.py`
- 创建: `backend/gateway/auth/service.py`
- 创建: `backend/gateway/auth/dependencies.py`
- 创建: `backend/tests/test_auth_service.py`

- [ ] **步骤 1: 创建 backend/gateway/auth/schemas.py**

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    student_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    student_id: str
    name: str
    campus: str | None
    major: str | None
    grade: int | None

    model_config = {"from_attributes": True}
```

- [ ] **步骤 2: 编写认证服务的失败测试**

创建 `backend/tests/test_auth_service.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from gateway.auth.service import AuthService


@pytest.fixture
def auth_service():
    db = AsyncMock()
    redis = AsyncMock()
    return AuthService(db=db, redis_client=redis)


@pytest.mark.asyncio
async def test_create_access_token(auth_service):
    token = auth_service.create_access_token(user_id=1, student_id="2022141461001")
    assert isinstance(token, str)
    assert len(token) > 0


@pytest.mark.asyncio
async def test_create_refresh_token(auth_service):
    token = await auth_service.create_refresh_token(user_id=1)
    assert isinstance(token, str)
    assert len(token) > 0


@pytest.mark.asyncio
async def test_verify_access_token(auth_service):
    token = auth_service.create_access_token(user_id=1, student_id="2022141461001")
    payload = auth_service.verify_access_token(token)
    assert payload["sub"] == 1
    assert payload["student_id"] == "2022141461001"


@pytest.mark.asyncio
async def test_verify_invalid_token(auth_service):
    payload = auth_service.verify_access_token("invalid-token")
    assert payload is None
```

- [ ] **步骤 3: 运行测试验证其失败**

```bash
cd backend
pytest tests/test_auth_service.py -v
```

**预期:** 失败 — `ModuleNotFoundError: No module named 'gateway.auth.service'`

- [ ] **步骤 4: 创建 backend/gateway/auth/service.py**

```python
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import User


class AuthService:
    def __init__(self, db: AsyncSession, redis_client: redis.Redis):
        self.db = db
        self.redis = redis_client

    def create_access_token(self, user_id: int, student_id: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
        payload = {
            "sub": user_id,
            "student_id": student_id,
            "exp": expire,
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")

    async def create_refresh_token(self, user_id: int) -> str:
        token = str(uuid.uuid4())
        key = f"refresh_token:{token}"
        ttl = settings.jwt_refresh_token_expire_days * 86400
        await self.redis.set(key, str(user_id), ex=ttl)
        return token

    def verify_access_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
            return payload
        except jwt.PyJWTError:
            return None

    async def verify_refresh_token(self, token: str) -> int | None:
        key = f"refresh_token:{token}"
        user_id = await self.redis.get(key)
        return int(user_id) if user_id else None

    async def revoke_refresh_token(self, token: str) -> None:
        key = f"refresh_token:{token}"
        await self.redis.delete(key)

    async def get_user_by_student_id(self, student_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.student_id == student_id))
        return result.scalar_one_or_none()

    async def create_or_update_user(
        self, student_id: str, name: str, campus: str | None = None,
        major: str | None = None, grade: int | None = None,
    ) -> User:
        user = await self.get_user_by_student_id(student_id)
        if user:
            user.name = name
            if campus:
                user.campus = campus
            if major:
                user.major = major
            if grade:
                user.grade = grade
        else:
            user = User(
                student_id=student_id, name=name,
                campus=campus, major=major, grade=grade,
            )
            self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
```

- [ ] **步骤 5: 创建 backend/gateway/auth/__init__.py**

空文件。

- [ ] **步骤 6: 运行测试验证其通过**

```bash
cd backend
pytest tests/test_auth_service.py -v
```

**预期:** 4 个测试通过

- [ ] **步骤 7: 提交**

```bash
git add backend/gateway/auth/ backend/tests/test_auth_service.py
git commit -m "feat: add JWT auth service with token creation and verification"
```

---

### Task 10: 认证 API 端点

**文件:**
- 创建: `backend/gateway/auth/router.py`
- 创建: `backend/gateway/auth/dependencies.py`
- 创建: `backend/tests/test_auth_router.py`
- 修改: `backend/gateway/main.py`

- [ ] **步骤 1: 创建 backend/gateway/auth/dependencies.py**

```python
from fastapi import Depends, Request

from gateway.auth.service import AuthService
from shared.cache import redis_client
from shared.database import get_db
from shared.exceptions import UnauthorizedError


async def get_auth_service(db=Depends(get_db)):
    return AuthService(db=db, redis_client=redis_client)


async def get_current_user(request: Request, auth_service: AuthService = Depends(get_auth_service)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")

    token = auth_header.split(" ")[1]
    payload = auth_service.verify_access_token(token)
    if payload is None:
        raise UnauthorizedError("Invalid or expired token")

    user = await auth_service.get_user_by_student_id(payload["student_id"])
    if user is None:
        raise UnauthorizedError("User not found")

    return user
```

- [ ] **步骤 2: 向 AuthService 添加 `get_user_by_id` 方法**

将此方法添加到 `backend/gateway/auth/service.py`:

```python
    async def get_user_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
```

- [ ] **步骤 3: 创建 backend/gateway/auth/router.py**

```python
from fastapi import APIRouter, Depends, Request, Response

from gateway.auth.dependencies import get_auth_service, get_current_user
from gateway.auth.schemas import LoginRequest, TokenResponse, UserResponse
from gateway.auth.service import AuthService
from shared.config import settings
from shared.exceptions import UnauthorizedError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    # Dev stub: accepts password "dev123" for any student_id.
    # Real educational system verification is implemented in Plan 2
    # (academic module) which integrates the existing jwc crawler.
    if body.password != "dev123":
        raise UnauthorizedError("Invalid credentials")

    user = await auth_service.create_or_update_user(
        student_id=body.student_id,
        name=f"Student {body.student_id}",
    )

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    refresh_token = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=dict)
async def refresh_token(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    token = request.cookies.get("refresh_token")
    if not token:
        raise UnauthorizedError("No refresh token")

    user_id = await auth_service.verify_refresh_token(token)
    if user_id is None:
        raise UnauthorizedError("Invalid or expired refresh token")

    await auth_service.revoke_refresh_token(token)

    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise UnauthorizedError("User not found")

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    new_refresh = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    return {"access_token": access_token}


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    token = request.cookies.get("refresh_token")
    if token:
        await auth_service.revoke_refresh_token(token)
    response.delete_cookie("refresh_token")


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return UserResponse.model_validate(user)
```

- [ ] **步骤 4: 在 main.py 中注册认证路由**

更新 `backend/gateway/main.py`，在 `register_error_handlers(app)` 之后添加:

```python
from gateway.auth.router import router as auth_router
app.include_router(auth_router)
```

- [ ] **步骤 5: 编写认证端点的集成测试**

创建 `backend/tests/test_auth_router.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from gateway.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_login_missing_body(client):
    response = await client.post("/api/auth/login", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_me_without_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
```

- [ ] **步骤 6: 运行测试**

```bash
cd backend
pytest tests/test_auth_router.py -v
```

**预期:** 3 个测试通过

- [ ] **步骤 7: 提交**

```bash
git add backend/gateway/auth/ backend/gateway/main.py backend/tests/test_auth_router.py
git commit -m "feat: add auth API endpoints (login, refresh, logout, me)"
```

---

## Chunk 3: 前端认证与主布局

### Task 11: 前端认证 — API 客户端与认证状态管理

**文件:**
- 创建: `frontend/src/lib/api.ts`
- 创建: `frontend/src/lib/auth.ts`
- 创建: `frontend/src/stores/auth-store.ts`
- 创建: `frontend/src/types/api.ts`
- 创建: `frontend/__tests__/lib/auth.test.ts`

- [ ] **步骤 1: 创建 frontend/src/types/api.ts**

```typescript
export interface User {
  id: number;
  student_id: string;
  name: string;
  campus: string | null;
  major: string | null;
  grade: number | null;
}

export interface LoginRequest {
  student_id: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
  };
}
```

- [ ] **步骤 2: 创建 frontend/src/lib/api.ts**

```typescript
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach access token from Zustand store (in-memory)
api.interceptors.request.use((config) => {
  // Lazy import to avoid circular dependency
  const { useAuthStore } = require("@/stores/auth-store");
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → try refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post("/api/auth/refresh");
        const { useAuthStore } = require("@/stores/auth-store");
        useAuthStore.getState().setAccessToken(data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch {
        const { useAuthStore } = require("@/stores/auth-store");
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
```

- [ ] **步骤 3: 创建 frontend/src/stores/auth-store.ts**

```typescript
import { create } from "zustand";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setUser: (user, token) => {
    set({ user, accessToken: token, isAuthenticated: true });
  },
  setAccessToken: (token) => {
    set({ accessToken: token });
  },
  logout: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
```

- [ ] **步骤 4: 创建 frontend/src/lib/auth.ts**

```typescript
import { api } from "./api";
import type { LoginRequest, TokenResponse, User } from "@/types/api";

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/api/auth/login", data);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>("/api/auth/me");
  return response.data;
}
```

- [ ] **步骤 5: 编写认证辅助函数的测试**

创建 `frontend/__tests__/lib/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it("should set user and token on login", () => {
    const user = {
      id: 1,
      student_id: "2022141461001",
      name: "Test",
      campus: null,
      major: null,
      grade: null,
    };
    useAuthStore.getState().setUser(user, "test-token");

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("test-token");
  });

  it("should clear state on logout", () => {
    const user = {
      id: 1,
      student_id: "2022141461001",
      name: "Test",
      campus: null,
      major: null,
      grade: null,
    };
    useAuthStore.getState().setUser(user, "test-token");
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **步骤 6: 运行测试**

```bash
cd frontend
npm test -- __tests__/lib/auth.test.ts
```

**预期:** 2 个测试通过

- [ ] **步骤 7: 提交**

```bash
git add frontend/src/lib/ frontend/src/stores/ frontend/src/types/ frontend/__tests__/
git commit -m "feat: add frontend API client, auth store, and auth helpers"
```

---

### Task 12: 登录页面

**文件:**
- 创建: `frontend/src/app/(auth)/layout.tsx`
- 创建: `frontend/src/app/(auth)/login/page.tsx`

- [ ] **步骤 1: 创建 frontend/src/app/(auth)/layout.tsx**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  );
}
```

- [ ] **步骤 2: 创建 frontend/src/app/(auth)/login/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ student_id: studentId, password });
      setUser(data.user, data.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">SCU Assistant</CardTitle>
        <CardDescription>Sign in with your student ID</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="studentId" className="text-sm font-medium">
              Student ID
            </label>
            <Input
              id="studentId"
              placeholder="Enter your student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Educational system password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 3: 验证登录页面渲染**

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000/login → 显示带表单的登录卡片
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/app/\(auth\)/
git commit -m "feat: add login page with auth form"
```

---

### Task 13: 主布局 — 侧边栏 + 顶栏

**文件:**
- 创建: `frontend/src/app/(main)/layout.tsx`
- 修改: `frontend/src/app/(main)/page.tsx`
- 创建: `frontend/src/components/layout/sidebar.tsx`
- 创建: `frontend/src/components/layout/topbar.tsx`
- 创建: `frontend/src/components/layout/mobile-nav.tsx`

- [ ] **步骤 1: 创建 frontend/src/components/layout/sidebar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  Bus,
  UtensilsCrossed,
  MessageSquare,
  Settings,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/academic/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/academic/deadline", label: "Deadlines", icon: BookOpen },
  { href: "/food/canteen", label: "Canteen", icon: UtensilsCrossed },
  { href: "/campus/bus", label: "Bus", icon: Bus },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-white dark:bg-gray-950">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">SCU Assistant</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **步骤 2: 创建 frontend/src/components/layout/topbar.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/lib/auth";
import { LogOut, Search, User } from "lucide-react";

export function Topbar() {
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-gray-950">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Ask anything... (e.g., 'What classes do I have tomorrow?')"
            className="pl-10"
          />
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.name?.charAt(0) || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="font-medium">
            {user?.name || "Guest"}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-gray-500">
            {user?.student_id}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **步骤 3: 创建 frontend/src/components/layout/mobile-nav.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  UtensilsCrossed,
  Settings,
} from "lucide-react";

const mobileItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/academic/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/food/canteen", label: "Food", icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-white dark:bg-gray-950 md:hidden">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              isActive
                ? "text-gray-900 dark:text-gray-50"
                : "text-gray-400 dark:text-gray-500"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **步骤 4: 创建 frontend/src/app/(main)/layout.tsx**

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
```

- [ ] **步骤 5: 更新 frontend/src/app/(main)/page.tsx**

```tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      <p className="text-gray-500">
        Welcome to SCU Assistant. Your personalized campus companion.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder cards for future modules */}
        {["Today's Schedule", "Upcoming Deadlines", "Canteen Status", "Next Bus"].map(
          (title) => (
            <div
              key={title}
              className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-950"
            >
              <h3 className="text-sm font-medium text-gray-500">{title}</h3>
              <p className="mt-2 text-2xl font-bold">--</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **步骤 6: 安装 lucide-react 图标库**

```bash
cd frontend
npm install lucide-react
```

- [ ] **步骤 7: 验证主布局渲染**

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000 → 侧边栏 + 顶栏 + 仪表盘占位符
# 将浏览器调整为移动端宽度 → 底部标签栏出现，侧边栏隐藏
# 注意：侧边栏链接如 /academic/schedule 会 404 — 页面将在 Plan 2-4 中创建
```

- [ ] **步骤 8: 提交**

```bash
git add frontend/src/app/\(main\)/ frontend/src/components/layout/
git commit -m "feat: add main layout with sidebar, topbar, and mobile navigation"
```

---

### Task 14: 开发环境搭建文档

**文件:**
- 创建: `docs/guides/dev-setup.md`

- [ ] **步骤 1: 创建 docs/guides/dev-setup.md**

```markdown
# Development Environment Setup

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Git

## Quick Start (Docker)

```bash
# Clone the repo
git clone <repo-url>
cd SCU_Assistant

# Copy env files
cp backend/.env.example backend/.env

# Start all services
docker compose up -d

# Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# Health check: http://localhost:8000/health
```

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Start PostgreSQL and Redis (via Docker or locally)
docker compose up -d postgres redis

# Run migrations
cp .env.example .env  # Edit DATABASE_URL if needed
alembic upgrade head

# Start server
uvicorn gateway.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Running Tests

```bash
# Backend
cd backend
pytest -v --cov

# Frontend
cd frontend
npm test
```

## Code Quality

```bash
# Backend linting
cd backend
ruff check .
ruff format .

# Frontend linting
cd frontend
npm run lint
```

- [ ] **步骤 2: 提交**

```bash
git add docs/guides/dev-setup.md
git commit -m "docs: add development environment setup guide"
```

---

### Task 15: 最终验证

- [ ] **步骤 1: 运行完整 Docker Compose 并进行端到端验证**

```bash
docker compose up -d --build
# 等待服务健康就绪
docker compose ps

# 测试后端健康检查
curl http://localhost:8000/health
# 预期: {"status":"ok","services":{"database":"ok","redis":"ok"}}

# 测试前端
curl -s http://localhost:3000 | head -5
# 预期: HTML 输出

# 测试 Swagger 文档
curl -s http://localhost:8000/docs | head -5
# 预期: HTML (Swagger UI)
```

- [ ] **步骤 2: 运行所有后端测试**

```bash
cd backend
pytest -v
# 预期: 所有测试通过
```

- [ ] **步骤 3: 运行所有前端测试**

```bash
cd frontend
npm test
# 预期: 所有测试通过
```

- [ ] **步骤 4: 验证构建成功**

```bash
cd frontend
npm run build
# 预期: 构建成功完成，无错误
```

- [ ] **步骤 5: 清理**

```bash
docker compose down
```
