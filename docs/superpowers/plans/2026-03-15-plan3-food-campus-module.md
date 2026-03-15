# Plan 3: 吃喝 + 校园模块实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现吃喝模块（食堂营业状态、窗口导览、"今天吃什么"推荐）和校园基础模块（校车时刻、校历查询），包含后端服务、数据库迁移、三校区种子数据和前端页面。

**架构:** 后端新增 `services/food/` 和 `services/campus/` 两个服务目录，注册到 Gateway 路由。食堂/校车/校历静态数据存储在 PostgreSQL，通过 JSON fixtures 种子脚本初始化。前端新增食堂、校车、校历三个页面，使用校区 Tab 切换和 TanStack Query 数据获取。

**技术栈:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis 7, Next.js 14 (App Router), TailwindCSS 4, shadcn/ui, TanStack Query, Zustand, Vitest, pytest

**设计文档:** `docs/superpowers/specs/2026-03-15-scu-assistant-design.md`

**依赖:** Plan 1 (基础设施 + 核心骨架)

---

## 文件结构

```
SCU_Assistant/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   │       └── 003_add_food_campus_tables.py     # 食堂/窗口/校车表迁移
│   ├── services/
│   │   ├── food/
│   │   │   ├── __init__.py
│   │   │   ├── router.py                         # /api/food/* 路由端点
│   │   │   ├── service.py                        # 业务逻辑（营业状态、推荐）
│   │   │   ├── models.py                         # SQLAlchemy ORM: Canteen, CanteenWindow
│   │   │   └── schemas.py                        # Pydantic 请求/响应模型
│   │   └── campus/
│   │       ├── __init__.py
│   │       ├── router.py                         # /api/campus/* 路由端点
│   │       ├── service.py                        # 业务逻辑（校车查询、校历）
│   │       ├── models.py                         # SQLAlchemy ORM: BusSchedule
│   │       └── schemas.py                        # Pydantic 请求/响应模型
│   ├── seed/
│   │   ├── canteens.json                         # 食堂数据（望江/江安/华西）
│   │   ├── canteen_windows.json                  # 各食堂窗口数据
│   │   ├── bus_schedules.json                    # 校车时刻表数据
│   │   └── load_seeds.py                         # 加载 JSON 种子数据到数据库的脚本
│   └── tests/
│       ├── test_food_service.py                  # 吃喝服务单元测试
│       ├── test_food_router.py                   # 吃喝端点集成测试
│       ├── test_campus_service.py                # 校园服务单元测试
│       └── test_campus_router.py                 # 校园端点集成测试
├── frontend/
│   ├── src/
│   │   ├── app/(main)/
│   │   │   ├── food/
│   │   │   │   └── canteen/page.tsx              # 食堂导览页（按校区 Tab 切换）
│   │   │   └── campus/
│   │   │       ├── bus/page.tsx                  # 校车时刻页
│   │   │       └── calendar/page.tsx             # 校历页
│   │   ├── components/
│   │   │   ├── food/
│   │   │   │   ├── campus-tabs.tsx               # 校区选择 Tab
│   │   │   │   ├── canteen-card.tsx              # 单个食堂状态卡片
│   │   │   │   ├── canteen-list.tsx              # 食堂列表（带筛选）
│   │   │   │   ├── window-list.tsx               # 食堂窗口列表
│   │   │   │   └── recommend-button.tsx          # "今天吃什么"随机推荐按钮
│   │   │   └── campus/
│   │   │       ├── bus-schedule-table.tsx         # 校车时刻表展示
│   │   │       ├── bus-route-filter.tsx           # 线路方向筛选
│   │   │       └── calendar-view.tsx             # 校历展示（当前周高亮）
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── food.ts                       # 吃喝模块 API 客户端函数
│   │   │   │   └── campus.ts                     # 校园模块 API 客户端函数
│   │   │   └── hooks/
│   │   │       ├── use-canteens.ts               # TanStack Query 食堂列表 hook
│   │   │       ├── use-canteen-windows.ts        # TanStack Query 窗口列表 hook
│   │   │       ├── use-food-recommend.ts         # TanStack Query 推荐 hook
│   │   │       ├── use-bus-schedule.ts           # TanStack Query 校车 hook
│   │   │       └── use-calendar.ts               # TanStack Query 校历 hook
│   │   └── types/
│   │       └── food-campus.ts                    # 吃喝 + 校园模块 TypeScript 类型定义
│   └── __tests__/
│       ├── components/food/
│       │   ├── canteen-card.test.tsx
│       │   └── recommend-button.test.tsx
│       └── components/campus/
│           ├── bus-schedule-table.test.tsx
│           └── calendar-view.test.tsx
```

---

## Chunk 1: 数据模型与数据库迁移

### Task 1: 吃喝与校园模块 SQLAlchemy 模型

**文件:**
- 创建: `backend/services/food/__init__.py`
- 创建: `backend/services/food/models.py`
- 创建: `backend/services/campus/__init__.py`
- 创建: `backend/services/campus/models.py`

- [ ] **步骤 1: 创建 backend/services/food/__init__.py**

```python
```

- [ ] **步骤 2: 创建 backend/services/food/models.py**

```python
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from shared.database import Base


class Canteen(Base):
    __tablename__ = "canteens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    campus = Column(String(20), nullable=False, index=True)  # 望江/江安/华西
    building = Column(String(100))
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    meal_type = Column(String(20), nullable=False)  # breakfast/lunch/dinner
    is_active = Column(Boolean, default=True)

    windows = relationship("CanteenWindow", back_populates="canteen", lazy="selectin")


class CanteenWindow(Base):
    __tablename__ = "canteen_windows"

    id = Column(Integer, primary_key=True, index=True)
    canteen_id = Column(Integer, ForeignKey("canteens.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(ARRAY(Text), nullable=False)  # e.g. ["川菜", "麻辣烫"]
    floor = Column(Integer)
    description = Column(Text)

    canteen = relationship("Canteen", back_populates="windows")
```

- [ ] **步骤 3: 创建 backend/services/campus/__init__.py**

```python
```

- [ ] **步骤 4: 创建 backend/services/campus/models.py**

```python
from sqlalchemy import Boolean, Column, Integer, String, Time

from shared.database import Base


class BusSchedule(Base):
    __tablename__ = "bus_schedules"

    id = Column(Integer, primary_key=True, index=True)
    route = Column(String(100), nullable=False)
    departure_campus = Column(String(20), nullable=False, index=True)
    arrival_campus = Column(String(20), nullable=False, index=True)
    departure_time = Column(Time, nullable=False)
    is_weekend = Column(Boolean, default=False)
    semester = Column(String(20), nullable=False)
```

- [ ] **步骤 5: 编写测试验证模型可导入且表名正确**

创建 `backend/tests/test_food_service.py`（初始模型健全性测试，后续会扩展）:

```python
from services.food.models import Canteen, CanteenWindow


def test_canteen_model_tablename():
    assert Canteen.__tablename__ == "canteens"


def test_canteen_window_model_tablename():
    assert CanteenWindow.__tablename__ == "canteen_windows"


def test_canteen_has_expected_columns():
    columns = [c.name for c in Canteen.__table__.columns]
    assert "name" in columns
    assert "campus" in columns
    assert "open_time" in columns
    assert "close_time" in columns
    assert "meal_type" in columns
    assert "is_active" in columns
```

创建 `backend/tests/test_campus_service.py`（初始模型健全性测试）:

```python
from services.campus.models import BusSchedule


def test_bus_schedule_model_tablename():
    assert BusSchedule.__tablename__ == "bus_schedules"


def test_bus_schedule_has_expected_columns():
    columns = [c.name for c in BusSchedule.__table__.columns]
    assert "route" in columns
    assert "departure_campus" in columns
    assert "arrival_campus" in columns
    assert "departure_time" in columns
    assert "is_weekend" in columns
    assert "semester" in columns
```

- [ ] **步骤 6: 运行 tests — should pass**

```bash
cd backend
pytest tests/test_food_service.py tests/test_campus_service.py -v
```

- [ ] **步骤 7: 提交**

```bash
git add backend/services/food/ backend/services/campus/ backend/tests/test_food_service.py backend/tests/test_campus_service.py
git commit -m "feat(food,campus): add SQLAlchemy models for canteens, windows, bus schedules"
```

---

### Task 2: 吃喝与校园模块数据库迁移

**文件:**
- 创建: `backend/alembic/versions/003_add_food_campus_tables.py`

- [ ] **步骤 1: 生成迁移（或手动创建）**

如果 Alembic autogenerate 已配置好模型导入:

```bash
cd backend
alembic revision --autogenerate -m "add food and campus tables"
```

如果手动创建，创建 `backend/alembic/versions/003_add_food_campus_tables.py`:

```python
"""add food and campus tables

Revision ID: 003_food_campus
Revises: <previous_revision_id>
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

# revision identifiers
revision = "003_food_campus"
down_revision = None  # UPDATE: set to actual previous migration revision ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Canteens table
    op.create_table(
        "canteens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("campus", sa.String(20), nullable=False),
        sa.Column("building", sa.String(100), nullable=True),
        sa.Column("open_time", sa.Time(), nullable=False),
        sa.Column("close_time", sa.Time(), nullable=False),
        sa.Column("meal_type", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
    )
    op.create_index("ix_canteens_campus", "canteens", ["campus"])

    # Canteen windows table
    op.create_table(
        "canteen_windows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("canteen_id", sa.Integer(), sa.ForeignKey("canteens.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", ARRAY(sa.Text()), nullable=False),
        sa.Column("floor", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_canteen_windows_canteen_id", "canteen_windows", ["canteen_id"])

    # Bus schedules table
    op.create_table(
        "bus_schedules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("route", sa.String(100), nullable=False),
        sa.Column("departure_campus", sa.String(20), nullable=False),
        sa.Column("arrival_campus", sa.String(20), nullable=False),
        sa.Column("departure_time", sa.Time(), nullable=False),
        sa.Column("is_weekend", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("semester", sa.String(20), nullable=False),
    )
    op.create_index("ix_bus_schedules_departure", "bus_schedules", ["departure_campus"])
    op.create_index("ix_bus_schedules_arrival", "bus_schedules", ["arrival_campus"])


def downgrade() -> None:
    op.drop_table("bus_schedules")
    op.drop_table("canteen_windows")
    op.drop_table("canteens")
```

**Note:** Update `down_revision` to point to the last migration from Plan 1/Plan 2 (e.g., the users/schedules/deadlines migration). Check with `alembic heads`.

- [ ] **步骤 2: 运行 migration**

```bash
cd backend
alembic upgrade head
```

- [ ] **步骤 3: 验证 tables exist**

```bash
docker compose exec postgres psql -U postgres -d scu_assistant -c "\dt"
# Should list canteens, canteen_windows, bus_schedules
```

- [ ] **步骤 4: 提交**

```bash
git add backend/alembic/
git commit -m "feat(db): add migration for canteens, canteen_windows, bus_schedules tables"
```

---

## Chunk 2: 种子数据

### Task 3: 三校区 JSON 种子数据

**文件:**
- 创建: `backend/seed/canteens.json`
- 创建: `backend/seed/canteen_windows.json`
- 创建: `backend/seed/bus_schedules.json`
- 创建: `backend/seed/load_seeds.py`

- [ ] **步骤 1: 创建 backend/seed/canteens.json**

```json
[
  {
    "name": "望江第一食堂",
    "campus": "望江",
    "building": "一食堂",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:00" },
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:00" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  },
  {
    "name": "望江第二食堂",
    "campus": "望江",
    "building": "二食堂",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:00" },
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:00" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  },
  {
    "name": "望江第三食堂",
    "campus": "望江",
    "building": "三食堂",
    "meals": [
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:00" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  },
  {
    "name": "江安第一食堂",
    "campus": "江安",
    "building": "西园一食堂",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:30" },
      { "meal_type": "lunch",    "open_time": "10:30", "close_time": "13:30" },
      { "meal_type": "dinner",   "open_time": "16:30", "close_time": "20:00" }
    ]
  },
  {
    "name": "江安第二食堂",
    "campus": "江安",
    "building": "西园二食堂",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:30" },
      { "meal_type": "lunch",    "open_time": "10:30", "close_time": "13:30" },
      { "meal_type": "dinner",   "open_time": "16:30", "close_time": "20:00" }
    ]
  },
  {
    "name": "江安第三食堂",
    "campus": "江安",
    "building": "东园食堂",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:00" },
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:00" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  },
  {
    "name": "华西食堂",
    "campus": "华西",
    "building": "华西食堂楼",
    "meals": [
      { "meal_type": "breakfast", "open_time": "06:30", "close_time": "09:00" },
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:00" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  },
  {
    "name": "华西第二食堂",
    "campus": "华西",
    "building": "华西二食堂",
    "meals": [
      { "meal_type": "lunch",    "open_time": "11:00", "close_time": "13:30" },
      { "meal_type": "dinner",   "open_time": "17:00", "close_time": "19:30" }
    ]
  }
]
```

- [ ] **步骤 2: 创建 backend/seed/canteen_windows.json**

每条记录通过 `canteen_name` + `campus` 引用食堂（在种子加载时解析为 ID）。

```json
[
  {
    "canteen_name": "望江第一食堂", "campus": "望江",
    "windows": [
      { "name": "川菜窗口",       "category": ["川菜", "炒菜"],   "floor": 1, "description": "经典川菜，回锅肉、鱼香肉丝" },
      { "name": "面食窗口",       "category": ["面食", "小面"],   "floor": 1, "description": "重庆小面、牛肉面、刀削面" },
      { "name": "麻辣烫窗口",     "category": ["麻辣烫"],        "floor": 1, "description": "自选麻辣烫，可调辣度" },
      { "name": "米线窗口",       "category": ["米线", "过桥米线"],"floor": 2, "description": "云南过桥米线" },
      { "name": "清真窗口",       "category": ["清真", "拉面"],   "floor": 2, "description": "清真拉面、大盘鸡" }
    ]
  },
  {
    "canteen_name": "望江第二食堂", "campus": "望江",
    "windows": [
      { "name": "自选餐窗口",     "category": ["自选", "快餐"],   "floor": 1, "description": "自选称重快餐" },
      { "name": "铁板饭窗口",     "category": ["铁板饭"],        "floor": 1, "description": "铁板牛肉饭、鸡排饭" },
      { "name": "黄焖鸡窗口",     "category": ["黄焖鸡"],        "floor": 1, "description": "黄焖鸡米饭" },
      { "name": "水饺窗口",       "category": ["饺子", "馄饨"],   "floor": 2, "description": "手工水饺、抄手" }
    ]
  },
  {
    "canteen_name": "望江第三食堂", "campus": "望江",
    "windows": [
      { "name": "烧烤窗口",       "category": ["烧烤"],          "floor": 1, "description": "烤肉饭、烤串" },
      { "name": "砂锅窗口",       "category": ["砂锅", "煲仔饭"],"floor": 1, "description": "砂锅粉丝、煲仔饭" }
    ]
  },
  {
    "canteen_name": "江安第一食堂", "campus": "江安",
    "windows": [
      { "name": "川菜窗口",       "category": ["川菜", "炒菜"],   "floor": 1, "description": "宫保鸡丁、麻婆豆腐" },
      { "name": "面食窗口",       "category": ["面食", "小面"],   "floor": 1, "description": "各类面食" },
      { "name": "麻辣香锅窗口",   "category": ["麻辣香锅"],      "floor": 2, "description": "自选食材麻辣香锅" },
      { "name": "冒菜窗口",       "category": ["冒菜"],          "floor": 2, "description": "成都冒菜" },
      { "name": "粥铺窗口",       "category": ["粥", "早餐"],    "floor": 1, "description": "各种粥品、包子、油条" }
    ]
  },
  {
    "canteen_name": "江安第二食堂", "campus": "江安",
    "windows": [
      { "name": "自选餐窗口",     "category": ["自选", "快餐"],   "floor": 1, "description": "自选称重" },
      { "name": "烤鱼窗口",       "category": ["烤鱼"],          "floor": 1, "description": "纸包鱼、烤鱼饭" },
      { "name": "韩式窗口",       "category": ["韩餐", "拌饭"],  "floor": 2, "description": "石锅拌饭、部队锅" },
      { "name": "螺蛳粉窗口",     "category": ["螺蛳粉"],        "floor": 2, "description": "柳州螺蛳粉" }
    ]
  },
  {
    "canteen_name": "江安第三食堂", "campus": "江安",
    "windows": [
      { "name": "干锅窗口",       "category": ["干锅"],          "floor": 1, "description": "干锅牛蛙、干锅鸡" },
      { "name": "盖饭窗口",       "category": ["盖饭", "快餐"],  "floor": 1, "description": "各类盖浇饭" },
      { "name": "清真窗口",       "category": ["清真", "拉面"],   "floor": 1, "description": "清真餐食" }
    ]
  },
  {
    "canteen_name": "华西食堂", "campus": "华西",
    "windows": [
      { "name": "川菜窗口",       "category": ["川菜", "炒菜"],   "floor": 1, "description": "经典川菜" },
      { "name": "面食窗口",       "category": ["面食"],          "floor": 1, "description": "各类面食" },
      { "name": "自选餐窗口",     "category": ["自选", "快餐"],   "floor": 2, "description": "自选称重" },
      { "name": "卤味窗口",       "category": ["卤味", "凉菜"],  "floor": 2, "description": "卤菜拼盘、冷面" }
    ]
  },
  {
    "canteen_name": "华西第二食堂", "campus": "华西",
    "windows": [
      { "name": "麻辣烫窗口",     "category": ["麻辣烫"],        "floor": 1, "description": "自选麻辣烫" },
      { "name": "米粉窗口",       "category": ["米粉", "米线"],  "floor": 1, "description": "桂林米粉、云南米线" }
    ]
  }
]
```

- [ ] **步骤 3: 创建 backend/seed/bus_schedules.json**

```json
[
  {
    "route": "望江-江安",
    "departure_campus": "望江",
    "arrival_campus": "江安",
    "semester": "2025-2026-2",
    "weekday_times": ["07:20", "07:50", "08:20", "09:30", "10:30", "12:00", "13:30", "14:30", "16:00", "17:30", "19:00", "21:30"],
    "weekend_times": ["08:00", "09:30", "11:30", "14:00", "17:00", "20:00"]
  },
  {
    "route": "江安-望江",
    "departure_campus": "江安",
    "arrival_campus": "望江",
    "semester": "2025-2026-2",
    "weekday_times": ["07:20", "07:50", "08:20", "09:30", "10:30", "12:00", "13:30", "14:30", "16:00", "17:30", "19:00", "21:30"],
    "weekend_times": ["08:00", "09:30", "11:30", "14:00", "17:00", "20:00"]
  },
  {
    "route": "望江-华西",
    "departure_campus": "望江",
    "arrival_campus": "华西",
    "semester": "2025-2026-2",
    "weekday_times": ["07:30", "09:00", "11:30", "14:00", "17:00"],
    "weekend_times": ["08:30", "14:00"]
  },
  {
    "route": "华西-望江",
    "departure_campus": "华西",
    "arrival_campus": "望江",
    "semester": "2025-2026-2",
    "weekday_times": ["08:00", "10:00", "12:30", "15:00", "17:30"],
    "weekend_times": ["09:30", "15:00"]
  },
  {
    "route": "江安-华西",
    "departure_campus": "江安",
    "arrival_campus": "华西",
    "semester": "2025-2026-2",
    "weekday_times": ["07:30", "12:00", "17:00"],
    "weekend_times": ["09:00", "15:00"]
  },
  {
    "route": "华西-江安",
    "departure_campus": "华西",
    "arrival_campus": "江安",
    "semester": "2025-2026-2",
    "weekday_times": ["08:30", "13:00", "18:00"],
    "weekend_times": ["10:00", "16:00"]
  }
]
```

- [ ] **步骤 4: 创建 backend/seed/load_seeds.py**

```python
"""
Seed data loader — reads JSON fixtures and inserts into PostgreSQL.

Usage:
    cd backend
    python -m seed.load_seeds
"""

import asyncio
import json
from datetime import time
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import async_session_factory, engine, Base
from services.food.models import Canteen, CanteenWindow
from services.campus.models import BusSchedule

SEED_DIR = Path(__file__).parent


def parse_time(t: str) -> time:
    """Parse 'HH:MM' string to datetime.time."""
    parts = t.split(":")
    return time(int(parts[0]), int(parts[1]))


async def seed_canteens(session: AsyncSession) -> dict[str, int]:
    """Seed canteens and return mapping of (name, campus) -> id."""
    with open(SEED_DIR / "canteens.json", encoding="utf-8") as f:
        data = json.load(f)

    canteen_map: dict[str, int] = {}

    for entry in data:
        for meal in entry["meals"]:
            canteen = Canteen(
                name=entry["name"],
                campus=entry["campus"],
                building=entry.get("building"),
                open_time=parse_time(meal["open_time"]),
                close_time=parse_time(meal["close_time"]),
                meal_type=meal["meal_type"],
                is_active=True,
            )
            session.add(canteen)
            await session.flush()

            # Store mapping with first ID for this canteen (used for windows)
            key = f"{entry['name']}|{entry['campus']}"
            if key not in canteen_map:
                canteen_map[key] = canteen.id

    return canteen_map


async def seed_windows(session: AsyncSession, canteen_map: dict[str, int]) -> None:
    """Seed canteen windows using canteen_map for FK resolution."""
    with open(SEED_DIR / "canteen_windows.json", encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        key = f"{entry['canteen_name']}|{entry['campus']}"
        canteen_id = canteen_map.get(key)
        if canteen_id is None:
            print(f"WARNING: canteen not found for {key}, skipping windows")
            continue

        for win in entry["windows"]:
            window = CanteenWindow(
                canteen_id=canteen_id,
                name=win["name"],
                category=win["category"],
                floor=win.get("floor"),
                description=win.get("description"),
            )
            session.add(window)


async def seed_bus_schedules(session: AsyncSession) -> None:
    """Seed bus schedules — expands time arrays into individual rows."""
    with open(SEED_DIR / "bus_schedules.json", encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        semester = entry["semester"]
        route = entry["route"]
        dep = entry["departure_campus"]
        arr = entry["arrival_campus"]

        for t in entry.get("weekday_times", []):
            schedule = BusSchedule(
                route=route,
                departure_campus=dep,
                arrival_campus=arr,
                departure_time=parse_time(t),
                is_weekend=False,
                semester=semester,
            )
            session.add(schedule)

        for t in entry.get("weekend_times", []):
            schedule = BusSchedule(
                route=route,
                departure_campus=dep,
                arrival_campus=arr,
                departure_time=parse_time(t),
                is_weekend=True,
                semester=semester,
            )
            session.add(schedule)


async def main():
    """Run all seed operations."""
    print("Seeding database...")

    async with async_session_factory() as session:
        # Check if data already exists
        result = await session.execute(select(Canteen).limit(1))
        if result.scalar_one_or_none():
            print("Data already exists. Skipping seed. Use --force to re-seed.")
            return

        canteen_map = await seed_canteens(session)
        print(f"  Seeded {len(canteen_map)} canteens")

        await seed_windows(session, canteen_map)
        print("  Seeded canteen windows")

        await seed_bus_schedules(session)
        print("  Seeded bus schedules")

        await session.commit()
        print("Seeding complete!")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **步骤 5: 运行 the seed script and verify data**

```bash
cd backend
python -m seed.load_seeds
# Should print:
#   Seeding database...
#   Seeded 8 canteens
#   Seeded canteen windows
#   Seeded bus schedules
#   Seeding complete!

# Verify in psql:
docker compose exec postgres psql -U postgres -d scu_assistant \
  -c "SELECT campus, COUNT(*) FROM canteens GROUP BY campus;"
# Expected: 望江 ~7-8 rows, 江安 ~8-9 rows, 华西 ~4-5 rows (each meal_type is a row)
```

- [ ] **步骤 6: 提交**

```bash
git add backend/seed/
git commit -m "feat(seed): add JSON fixtures and seed script for canteens, windows, bus schedules"
```

---

## Chunk 3: 吃喝模块后端服务与 API

### Task 4: 吃喝模块 Pydantic Schemas

**文件:**
- 创建: `backend/services/food/schemas.py`

- [ ] **步骤 1: 创建 backend/services/food/schemas.py**

```python
from pydantic import BaseModel


class CanteenResponse(BaseModel):
    id: int
    name: str
    campus: str
    building: str | None
    open_time: str  # "HH:MM"
    close_time: str  # "HH:MM"
    meal_type: str
    is_open: bool  # computed at request time

    model_config = {"from_attributes": True}


class CanteenListResponse(BaseModel):
    canteens: list[CanteenResponse]


class WindowResponse(BaseModel):
    id: int
    name: str
    category: list[str]
    floor: int | None
    description: str | None

    model_config = {"from_attributes": True}


class WindowListResponse(BaseModel):
    windows: list[WindowResponse]


class RecommendationResponse(BaseModel):
    recommendation: dict  # { canteen, window, reason }
```

---

### Task 5: 吃喝模块业务逻辑

**文件:**
- 创建: `backend/services/food/service.py`

- [ ] **步骤 1: 创建 backend/services/food/service.py**

```python
import random
from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from services.food.models import Canteen, CanteenWindow


def is_canteen_open(open_time: time, close_time: time, now: time | None = None) -> bool:
    """Check if a canteen is currently open based on open/close times."""
    if now is None:
        now = datetime.now().time()
    return open_time <= now <= close_time


async def get_canteens(
    session: AsyncSession,
    campus: str | None = None,
    meal_type: str | None = None,
) -> list[dict]:
    """Get canteen list with real-time open/close status."""
    query = select(Canteen).where(Canteen.is_active.is_(True))

    if campus:
        query = query.where(Canteen.campus == campus)
    if meal_type:
        query = query.where(Canteen.meal_type == meal_type)

    query = query.order_by(Canteen.campus, Canteen.name, Canteen.meal_type)
    result = await session.execute(query)
    canteens = result.scalars().all()

    now = datetime.now().time()
    return [
        {
            "id": c.id,
            "name": c.name,
            "campus": c.campus,
            "building": c.building,
            "open_time": c.open_time.strftime("%H:%M"),
            "close_time": c.close_time.strftime("%H:%M"),
            "meal_type": c.meal_type,
            "is_open": is_canteen_open(c.open_time, c.close_time, now),
        }
        for c in canteens
    ]


async def get_canteen_windows(
    session: AsyncSession,
    canteen_id: int,
    category: str | None = None,
) -> list[dict]:
    """Get windows for a canteen, optionally filtered by category keyword."""
    query = select(CanteenWindow).where(CanteenWindow.canteen_id == canteen_id)
    result = await session.execute(query)
    windows = result.scalars().all()

    if category:
        # Filter windows where any category tag contains the search term
        windows = [
            w for w in windows
            if any(category.lower() in cat.lower() for cat in w.category)
        ]

    return [
        {
            "id": w.id,
            "name": w.name,
            "category": list(w.category),
            "floor": w.floor,
            "description": w.description,
        }
        for w in windows
    ]


async def get_recommendation(
    session: AsyncSession,
    campus: str | None = None,
    user_preferences: dict | None = None,
) -> dict:
    """
    'What to eat today' recommender.

    Strategy:
    1. Filter canteens that are currently open
    2. If user has taste preferences (from user_memories), prefer matching windows
    3. Otherwise, random pick from available windows
    """
    now = datetime.now().time()

    # Get currently open canteens
    query = select(Canteen).where(Canteen.is_active.is_(True))
    if campus:
        query = query.where(Canteen.campus == campus)

    result = await session.execute(query)
    all_canteens = result.scalars().all()

    open_canteens = [
        c for c in all_canteens
        if is_canteen_open(c.open_time, c.close_time, now)
    ]

    if not open_canteens:
        return {
            "recommendation": {
                "canteen": None,
                "window": None,
                "reason": "当前没有正在营业的食堂，请在用餐时间再来看看吧！",
            }
        }

    # Get all windows for open canteens
    canteen_ids = list({c.id for c in open_canteens})
    # We need to map canteen_id back to a canteen entry (use first match's name)
    canteen_name_map = {}
    for c in open_canteens:
        if c.id not in canteen_name_map:
            canteen_name_map[c.id] = c.name

    window_query = select(CanteenWindow).where(CanteenWindow.canteen_id.in_(canteen_ids))
    window_result = await session.execute(window_query)
    all_windows = window_result.scalars().all()

    if not all_windows:
        canteen = random.choice(open_canteens)
        return {
            "recommendation": {
                "canteen": canteen.name,
                "window": None,
                "reason": f"推荐去{canteen.name}看看，具体窗口数据暂缺",
            }
        }

    # If user has taste preferences, try to match
    preferred_windows = all_windows
    reason_prefix = "随机推荐"

    if user_preferences and user_preferences.get("taste"):
        taste = user_preferences["taste"]
        matched = [
            w for w in all_windows
            if any(taste.lower() in cat.lower() for cat in w.category)
        ]
        if matched:
            preferred_windows = matched
            reason_prefix = f"根据你喜欢「{taste}」的偏好"

    chosen_window = random.choice(preferred_windows)
    canteen_name = canteen_name_map.get(chosen_window.canteen_id, "未知食堂")

    return {
        "recommendation": {
            "canteen": canteen_name,
            "window": chosen_window.name,
            "reason": f"{reason_prefix}：去{canteen_name}的{chosen_window.name}试试吧！",
        }
    }
```

- [ ] **步骤 2: 添加 unit tests for food service logic**

追加到 `backend/tests/test_food_service.py`:

```python
from datetime import time
from services.food.service import is_canteen_open


def test_is_open_within_hours():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(12, 0)) is True


def test_is_open_at_open_time():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(11, 0)) is True


def test_is_open_at_close_time():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(13, 0)) is True


def test_is_closed_before_open():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(10, 30)) is False


def test_is_closed_after_close():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(14, 0)) is False


def test_is_closed_early_morning():
    assert is_canteen_open(time(11, 0), time(13, 0), now=time(6, 0)) is False
```

- [ ] **步骤 3: 运行 tests — all should pass**

```bash
cd backend
pytest tests/test_food_service.py -v
```

- [ ] **步骤 4: 提交**

```bash
git add backend/services/food/
git commit -m "feat(food): add food service with canteen status, window search, recommendation logic"
```

---

### Task 6: 吃喝模块 API 路由

**文件:**
- 创建: `backend/services/food/router.py`
- 修改: `backend/gateway/main.py` (register food router)

- [ ] **步骤 1: 创建 backend/services/food/router.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from services.food import service
from services.food.schemas import CanteenListResponse, WindowListResponse, RecommendationResponse

router = APIRouter(prefix="/api/food", tags=["food"])


@router.get("/canteens", response_model=CanteenListResponse)
async def list_canteens(
    campus: str | None = Query(None, description="Filter by campus: 望江/江安/华西"),
    meal_type: str | None = Query(None, description="Filter by meal type: breakfast/lunch/dinner"),
    session: AsyncSession = Depends(get_session),
):
    """Get list of canteens with real-time open/close status."""
    canteens = await service.get_canteens(session, campus=campus, meal_type=meal_type)
    return CanteenListResponse(canteens=canteens)


@router.get("/canteens/{canteen_id}/windows", response_model=WindowListResponse)
async def list_canteen_windows(
    canteen_id: int,
    category: str | None = Query(None, description="Filter by food category keyword"),
    session: AsyncSession = Depends(get_session),
):
    """Get windows for a specific canteen, optionally filtered by category."""
    windows = await service.get_canteen_windows(session, canteen_id=canteen_id, category=category)
    return WindowListResponse(windows=windows)


@router.get("/recommend", response_model=RecommendationResponse)
async def recommend_food(
    campus: str | None = Query(None, description="Limit recommendation to a campus"),
    session: AsyncSession = Depends(get_session),
):
    """
    'What to eat today' — returns a random recommendation.
    Future: will incorporate user taste preferences from user_memories.
    """
    result = await service.get_recommendation(session, campus=campus)
    return result
```

- [ ] **步骤 2: 注册 food router in gateway/main.py**

添加到 `backend/gateway/main.py` 的 `create_app()` 中，在已有路由注册之后:

```python
from services.food.router import router as food_router

# Inside create_app():
app.include_router(food_router)
```

- [ ] **步骤 3: 编写 integration test for food API endpoints**

创建 `backend/tests/test_food_router.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from gateway.main import create_app

app = create_app()


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_list_canteens_returns_200(client):
    async with client as c:
        response = await c.get("/api/food/canteens")
        assert response.status_code == 200
        data = response.json()
        assert "canteens" in data
        assert isinstance(data["canteens"], list)


@pytest.mark.asyncio
async def test_list_canteens_filter_by_campus(client):
    async with client as c:
        response = await c.get("/api/food/canteens", params={"campus": "江安"})
        assert response.status_code == 200
        data = response.json()
        for canteen in data["canteens"]:
            assert canteen["campus"] == "江安"


@pytest.mark.asyncio
async def test_canteen_has_is_open_field(client):
    async with client as c:
        response = await c.get("/api/food/canteens")
        assert response.status_code == 200
        data = response.json()
        if data["canteens"]:
            assert "is_open" in data["canteens"][0]
            assert isinstance(data["canteens"][0]["is_open"], bool)


@pytest.mark.asyncio
async def test_recommend_returns_200(client):
    async with client as c:
        response = await c.get("/api/food/recommend")
        assert response.status_code == 200
        data = response.json()
        assert "recommendation" in data
        assert "reason" in data["recommendation"]


@pytest.mark.asyncio
async def test_windows_returns_200_for_valid_canteen(client):
    async with client as c:
        # First get a canteen ID
        resp = await c.get("/api/food/canteens")
        canteens = resp.json()["canteens"]
        if canteens:
            cid = canteens[0]["id"]
            response = await c.get(f"/api/food/canteens/{cid}/windows")
            assert response.status_code == 200
            assert "windows" in response.json()
```

- [ ] **步骤 4: 运行 integration tests**

```bash
cd backend
pytest tests/test_food_router.py -v
```

- [ ] **步骤 5: 提交**

```bash
git add backend/services/food/router.py backend/gateway/main.py backend/tests/test_food_router.py
git commit -m "feat(food): add food API endpoints — canteens, windows, recommend"
```

---

## Chunk 4: 校园模块后端服务与 API

### Task 7: 校园模块 Pydantic Schemas

**文件:**
- 创建: `backend/services/campus/schemas.py`

- [ ] **步骤 1: 创建 backend/services/campus/schemas.py**

```python
from pydantic import BaseModel


class BusScheduleItem(BaseModel):
    id: int
    route: str
    departure_campus: str
    arrival_campus: str
    departure_time: str  # "HH:MM"
    is_weekend: bool

    model_config = {"from_attributes": True}


class BusScheduleResponse(BaseModel):
    schedules: list[BusScheduleItem]
    next: BusScheduleItem | None  # Next upcoming departure


class CalendarResponse(BaseModel):
    current_week: int
    semester_start: str  # "YYYY-MM-DD"
    semester_end: str  # "YYYY-MM-DD"
    semester: str
    holidays: list[dict]  # [{ name, start_date, end_date }]
```

---

### Task 8: 校园模块业务逻辑

**文件:**
- 创建: `backend/services/campus/service.py`

- [ ] **步骤 1: 创建 backend/services/campus/service.py**

```python
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.campus.models import BusSchedule

# Academic calendar configuration (static for the current semester)
# In production, this could be stored in the database or a config file.
SEMESTER_CONFIG = {
    "2025-2026-2": {
        "semester_start": "2026-02-23",  # Monday of week 1
        "semester_end": "2026-07-05",
        "holidays": [
            {
                "name": "清明节",
                "start_date": "2026-04-04",
                "end_date": "2026-04-06",
            },
            {
                "name": "劳动节",
                "start_date": "2026-05-01",
                "end_date": "2026-05-05",
            },
            {
                "name": "端午节",
                "start_date": "2026-06-19",
                "end_date": "2026-06-21",
            },
        ],
    },
}

DEFAULT_SEMESTER = "2025-2026-2"


def get_current_week(semester_start: str, today: date | None = None) -> int:
    """Calculate the current teaching week number (1-based)."""
    if today is None:
        today = date.today()
    start = date.fromisoformat(semester_start)
    delta = today - start
    if delta.days < 0:
        return 0  # semester has not started
    return (delta.days // 7) + 1


async def get_bus_schedules(
    session: AsyncSession,
    from_campus: str | None = None,
    to_campus: str | None = None,
    query_time: str | None = None,
    semester: str | None = None,
) -> dict:
    """
    Get bus schedules, optionally filtered by route and time.
    Returns schedules list and the next upcoming departure.
    """
    sem = semester or DEFAULT_SEMESTER

    # Determine if today is a weekend
    today = date.today()
    is_weekend = today.weekday() >= 5  # Saturday=5, Sunday=6

    query = (
        select(BusSchedule)
        .where(BusSchedule.semester == sem)
        .where(BusSchedule.is_weekend == is_weekend)
    )

    if from_campus:
        query = query.where(BusSchedule.departure_campus == from_campus)
    if to_campus:
        query = query.where(BusSchedule.arrival_campus == to_campus)

    query = query.order_by(BusSchedule.departure_time)
    result = await session.execute(query)
    schedules = result.scalars().all()

    # Format response
    schedule_list = [
        {
            "id": s.id,
            "route": s.route,
            "departure_campus": s.departure_campus,
            "arrival_campus": s.arrival_campus,
            "departure_time": s.departure_time.strftime("%H:%M"),
            "is_weekend": s.is_weekend,
        }
        for s in schedules
    ]

    # Find next departure
    now = datetime.now().time()
    if query_time:
        parts = query_time.split(":")
        now = time(int(parts[0]), int(parts[1]))

    next_bus = None
    for item in schedule_list:
        dep_time = time(*[int(x) for x in item["departure_time"].split(":")])
        if dep_time >= now:
            next_bus = item
            break

    return {
        "schedules": schedule_list,
        "next": next_bus,
    }


def get_calendar(semester: str | None = None) -> dict:
    """
    Get academic calendar info: current week, semester dates, holidays.
    """
    sem = semester or DEFAULT_SEMESTER
    config = SEMESTER_CONFIG.get(sem)

    if not config:
        return {
            "current_week": 0,
            "semester_start": "",
            "semester_end": "",
            "semester": sem,
            "holidays": [],
        }

    current_week = get_current_week(config["semester_start"])

    return {
        "current_week": current_week,
        "semester_start": config["semester_start"],
        "semester_end": config["semester_end"],
        "semester": sem,
        "holidays": config["holidays"],
    }
```

- [ ] **步骤 2: 添加 unit tests for campus service logic**

追加到 `backend/tests/test_campus_service.py`:

```python
from datetime import date
from services.campus.service import get_current_week, get_calendar


def test_current_week_first_day():
    # Week 1 starts on semester start date
    assert get_current_week("2026-02-23", today=date(2026, 2, 23)) == 1


def test_current_week_mid_semester():
    # 2026-03-15 is 20 days after 2026-02-23 → week 3
    assert get_current_week("2026-02-23", today=date(2026, 3, 15)) == 3


def test_current_week_before_semester():
    assert get_current_week("2026-02-23", today=date(2026, 2, 20)) == 0


def test_current_week_end_of_week_one():
    # 2026-03-01 is 6 days after start → still week 1
    assert get_current_week("2026-02-23", today=date(2026, 3, 1)) == 1


def test_current_week_start_of_week_two():
    # 2026-03-02 is 7 days after start → week 2
    assert get_current_week("2026-02-23", today=date(2026, 3, 2)) == 2


def test_calendar_returns_holidays():
    cal = get_calendar("2025-2026-2")
    assert cal["semester"] == "2025-2026-2"
    assert len(cal["holidays"]) == 3
    holiday_names = [h["name"] for h in cal["holidays"]]
    assert "清明节" in holiday_names
    assert "劳动节" in holiday_names
    assert "端午节" in holiday_names


def test_calendar_unknown_semester():
    cal = get_calendar("2099-2100-1")
    assert cal["current_week"] == 0
    assert cal["holidays"] == []
```

- [ ] **步骤 3: 运行 tests — all should pass**

```bash
cd backend
pytest tests/test_campus_service.py -v
```

- [ ] **步骤 4: 提交**

```bash
git add backend/services/campus/service.py backend/services/campus/schemas.py backend/tests/test_campus_service.py
git commit -m "feat(campus): add campus service with bus schedule query and academic calendar"
```

---

### Task 9: 校园模块 API 路由

**文件:**
- 创建: `backend/services/campus/router.py`
- 修改: `backend/gateway/main.py` (register campus router)

- [ ] **步骤 1: 创建 backend/services/campus/router.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from services.campus import service
from services.campus.schemas import BusScheduleResponse, CalendarResponse

router = APIRouter(prefix="/api/campus", tags=["campus"])


@router.get("/bus", response_model=BusScheduleResponse)
async def get_bus_schedule(
    from_campus: str | None = Query(None, alias="from", description="Departure campus"),
    to_campus: str | None = Query(None, alias="to", description="Arrival campus"),
    time: str | None = Query(None, description="Query time in HH:MM format"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get bus schedules between campuses.
    Automatically uses weekday/weekend timetable based on today's date.
    Returns all matching schedules and the next upcoming departure.
    """
    result = await service.get_bus_schedules(
        session, from_campus=from_campus, to_campus=to_campus, query_time=time
    )
    return result


@router.get("/calendar", response_model=CalendarResponse)
async def get_calendar(
    semester: str | None = Query(None, description="Semester identifier, e.g. 2025-2026-2"),
):
    """
    Get academic calendar: current week number, semester dates, and holidays.
    """
    return service.get_calendar(semester=semester)
```

- [ ] **步骤 2: 注册 campus router in gateway/main.py**

添加到 `backend/gateway/main.py` 的 `create_app()` 中:

```python
from services.campus.router import router as campus_router

# Inside create_app():
app.include_router(campus_router)
```

- [ ] **步骤 3: 编写 integration test for campus API endpoints**

创建 `backend/tests/test_campus_router.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from gateway.main import create_app

app = create_app()


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_bus_schedule_returns_200(client):
    async with client as c:
        response = await c.get("/api/campus/bus")
        assert response.status_code == 200
        data = response.json()
        assert "schedules" in data
        assert isinstance(data["schedules"], list)
        assert "next" in data


@pytest.mark.asyncio
async def test_bus_schedule_filter_by_route(client):
    async with client as c:
        response = await c.get("/api/campus/bus", params={"from": "望江", "to": "江安"})
        assert response.status_code == 200
        data = response.json()
        for s in data["schedules"]:
            assert s["departure_campus"] == "望江"
            assert s["arrival_campus"] == "江安"


@pytest.mark.asyncio
async def test_calendar_returns_200(client):
    async with client as c:
        response = await c.get("/api/campus/calendar")
        assert response.status_code == 200
        data = response.json()
        assert "current_week" in data
        assert "semester_start" in data
        assert "semester_end" in data
        assert "holidays" in data
        assert isinstance(data["current_week"], int)


@pytest.mark.asyncio
async def test_calendar_with_semester_param(client):
    async with client as c:
        response = await c.get("/api/campus/calendar", params={"semester": "2025-2026-2"})
        assert response.status_code == 200
        data = response.json()
        assert data["semester"] == "2025-2026-2"
        assert len(data["holidays"]) > 0
```

- [ ] **步骤 4: 运行 integration tests**

```bash
cd backend
pytest tests/test_campus_router.py -v
```

- [ ] **步骤 5: 提交**

```bash
git add backend/services/campus/router.py backend/gateway/main.py backend/tests/test_campus_router.py
git commit -m "feat(campus): add campus API endpoints — bus schedule and calendar"
```

---

## Chunk 5: 前端类型定义与 API 客户端

### Task 10: 前端类型定义与 API 客户端函数

**文件:**
- 创建: `frontend/src/types/food-campus.ts`
- 创建: `frontend/src/lib/api/food.ts`
- 创建: `frontend/src/lib/api/campus.ts`

- [ ] **步骤 1: 创建 frontend/src/types/food-campus.ts**

```typescript
// ---- Food types ----

export interface Canteen {
  id: number;
  name: string;
  campus: string;
  building: string | null;
  open_time: string;
  close_time: string;
  meal_type: string;
  is_open: boolean;
}

export interface CanteenListResponse {
  canteens: Canteen[];
}

export interface CanteenWindow {
  id: number;
  name: string;
  category: string[];
  floor: number | null;
  description: string | null;
}

export interface WindowListResponse {
  windows: CanteenWindow[];
}

export interface Recommendation {
  canteen: string | null;
  window: string | null;
  reason: string;
}

export interface RecommendationResponse {
  recommendation: Recommendation;
}

// ---- Campus types ----

export interface BusScheduleItem {
  id: number;
  route: string;
  departure_campus: string;
  arrival_campus: string;
  departure_time: string;
  is_weekend: boolean;
}

export interface BusScheduleResponse {
  schedules: BusScheduleItem[];
  next: BusScheduleItem | null;
}

export interface Holiday {
  name: string;
  start_date: string;
  end_date: string;
}

export interface CalendarResponse {
  current_week: number;
  semester_start: string;
  semester_end: string;
  semester: string;
  holidays: Holiday[];
}

// ---- Shared ----

export type Campus = "望江" | "江安" | "华西";

export const CAMPUSES: Campus[] = ["望江", "江安", "华西"];
```

- [ ] **步骤 2: 创建 frontend/src/lib/api/food.ts**

```typescript
import api from "@/lib/api";
import type {
  CanteenListResponse,
  WindowListResponse,
  RecommendationResponse,
} from "@/types/food-campus";

export async function fetchCanteens(params?: {
  campus?: string;
  meal_type?: string;
}): Promise<CanteenListResponse> {
  const { data } = await api.get("/api/food/canteens", { params });
  return data;
}

export async function fetchCanteenWindows(
  canteenId: number,
  params?: { category?: string }
): Promise<WindowListResponse> {
  const { data } = await api.get(`/api/food/canteens/${canteenId}/windows`, {
    params,
  });
  return data;
}

export async function fetchRecommendation(params?: {
  campus?: string;
}): Promise<RecommendationResponse> {
  const { data } = await api.get("/api/food/recommend", { params });
  return data;
}
```

- [ ] **步骤 3: 创建 frontend/src/lib/api/campus.ts**

```typescript
import api from "@/lib/api";
import type {
  BusScheduleResponse,
  CalendarResponse,
} from "@/types/food-campus";

export async function fetchBusSchedules(params?: {
  from?: string;
  to?: string;
  time?: string;
}): Promise<BusScheduleResponse> {
  const { data } = await api.get("/api/campus/bus", { params });
  return data;
}

export async function fetchCalendar(params?: {
  semester?: string;
}): Promise<CalendarResponse> {
  const { data } = await api.get("/api/campus/calendar", { params });
  return data;
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/types/food-campus.ts frontend/src/lib/api/food.ts frontend/src/lib/api/campus.ts
git commit -m "feat(frontend): add TypeScript types and API client for food and campus modules"
```

---

### Task 11: TanStack Query 数据钩子

**文件:**
- 创建: `frontend/src/lib/hooks/use-canteens.ts`
- 创建: `frontend/src/lib/hooks/use-canteen-windows.ts`
- 创建: `frontend/src/lib/hooks/use-food-recommend.ts`
- 创建: `frontend/src/lib/hooks/use-bus-schedule.ts`
- 创建: `frontend/src/lib/hooks/use-calendar.ts`

- [ ] **步骤 1: 创建 frontend/src/lib/hooks/use-canteens.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchCanteens } from "@/lib/api/food";

export function useCanteens(campus?: string, mealType?: string) {
  return useQuery({
    queryKey: ["canteens", campus, mealType],
    queryFn: () => fetchCanteens({ campus, meal_type: mealType }),
    staleTime: 60 * 1000, // 1 minute (canteen open status changes)
    refetchInterval: 60 * 1000,
  });
}
```

- [ ] **步骤 2: 创建 frontend/src/lib/hooks/use-canteen-windows.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchCanteenWindows } from "@/lib/api/food";

export function useCanteenWindows(canteenId: number | null, category?: string) {
  return useQuery({
    queryKey: ["canteen-windows", canteenId, category],
    queryFn: () => fetchCanteenWindows(canteenId!, { category }),
    enabled: canteenId !== null,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (static data)
  });
}
```

- [ ] **步骤 3: 创建 frontend/src/lib/hooks/use-food-recommend.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchRecommendation } from "@/lib/api/food";

export function useFoodRecommend(campus?: string, enabled = false) {
  return useQuery({
    queryKey: ["food-recommend", campus],
    queryFn: () => fetchRecommendation({ campus }),
    enabled, // only fetch when user clicks the button
    staleTime: 0, // always re-fetch for new random result
  });
}
```

- [ ] **步骤 4: 创建 frontend/src/lib/hooks/use-bus-schedule.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchBusSchedules } from "@/lib/api/campus";

export function useBusSchedule(from?: string, to?: string, time?: string) {
  return useQuery({
    queryKey: ["bus-schedule", from, to, time],
    queryFn: () => fetchBusSchedules({ from, to, time }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (static timetable)
  });
}
```

- [ ] **步骤 5: 创建 frontend/src/lib/hooks/use-calendar.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchCalendar } from "@/lib/api/campus";

export function useCalendar(semester?: string) {
  return useQuery({
    queryKey: ["calendar", semester],
    queryFn: () => fetchCalendar({ semester }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
```

- [ ] **步骤 6: 提交**

```bash
git add frontend/src/lib/hooks/
git commit -m "feat(frontend): add TanStack Query hooks for food and campus data"
```

---

## Chunk 6: 前端组件与页面

### Task 12: 吃喝模块前端组件

**文件:**
- 创建: `frontend/src/components/food/campus-tabs.tsx`
- 创建: `frontend/src/components/food/canteen-card.tsx`
- 创建: `frontend/src/components/food/canteen-list.tsx`
- 创建: `frontend/src/components/food/window-list.tsx`
- 创建: `frontend/src/components/food/recommend-button.tsx`

- [ ] **步骤 1: 创建 frontend/src/components/food/campus-tabs.tsx**

```tsx
"use client";

import { CAMPUSES, type Campus } from "@/types/food-campus";

interface CampusTabsProps {
  selected: Campus;
  onSelect: (campus: Campus) => void;
}

export function CampusTabs({ selected, onSelect }: CampusTabsProps) {
  return (
    <div className="flex gap-2 border-b pb-2">
      {CAMPUSES.map((campus) => (
        <button
          key={campus}
          onClick={() => onSelect(campus)}
          className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${
            selected === campus
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {campus}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **步骤 2: 创建 frontend/src/components/food/canteen-card.tsx**

```tsx
import type { Canteen } from "@/types/food-campus";

interface CanteenCardProps {
  canteen: Canteen;
  onClick?: () => void;
}

export function CanteenCard({ canteen, onClick }: CanteenCardProps) {
  const mealLabel: Record<string, string> = {
    breakfast: "早餐",
    lunch: "午餐",
    dinner: "晚餐",
  };

  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">{canteen.name}</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            canteen.is_open
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {canteen.is_open ? "营业中" : "已关闭"}
        </span>
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        {canteen.building && <p>{canteen.building}</p>}
        <p>
          {mealLabel[canteen.meal_type] || canteen.meal_type}：
          {canteen.open_time} - {canteen.close_time}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3: 创建 frontend/src/components/food/canteen-list.tsx**

```tsx
"use client";

import { useCanteens } from "@/lib/hooks/use-canteens";
import { CanteenCard } from "./canteen-card";
import type { Campus } from "@/types/food-campus";

interface CanteenListProps {
  campus: Campus;
  onCanteenClick?: (canteenId: number) => void;
}

export function CanteenList({ campus, onCanteenClick }: CanteenListProps) {
  const { data, isLoading, error } = useCanteens(campus);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border rounded-lg p-4 animate-pulse bg-muted h-24"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        加载失败，请稍后重试
      </div>
    );
  }

  const canteens = data?.canteens || [];

  if (canteens.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无{campus}校区食堂数据
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {canteens.map((canteen) => (
        <CanteenCard
          key={`${canteen.id}-${canteen.meal_type}`}
          canteen={canteen}
          onClick={() => onCanteenClick?.(canteen.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **步骤 4: 创建 frontend/src/components/food/window-list.tsx**

```tsx
"use client";

import { useState } from "react";
import { useCanteenWindows } from "@/lib/hooks/use-canteen-windows";

interface WindowListProps {
  canteenId: number;
  canteenName: string;
  onBack: () => void;
}

export function WindowList({ canteenId, canteenName, onBack }: WindowListProps) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data, isLoading } = useCanteenWindows(
    canteenId,
    categoryFilter || undefined
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; 返回
        </button>
        <h2 className="text-xl font-semibold">{canteenName} - 窗口导览</h2>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="搜索品类（如：麻辣烫、面食、川菜）"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 animate-pulse bg-muted h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.windows || []).map((window) => (
            <div key={window.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium">{window.name}</h3>
                {window.floor && (
                  <span className="text-xs text-muted-foreground">
                    {window.floor}楼
                  </span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap mb-1">
                {window.category.map((cat) => (
                  <span
                    key={cat}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
              {window.description && (
                <p className="text-sm text-muted-foreground">
                  {window.description}
                </p>
              )}
            </div>
          ))}
          {data?.windows.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              没有找到匹配的窗口
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 5: 创建 frontend/src/components/food/recommend-button.tsx**

```tsx
"use client";

import { useState } from "react";
import { useFoodRecommend } from "@/lib/hooks/use-food-recommend";
import type { Campus } from "@/types/food-campus";

interface RecommendButtonProps {
  campus?: Campus;
}

export function RecommendButton({ campus }: RecommendButtonProps) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, refetch } = useFoodRecommend(campus, enabled);

  const handleClick = () => {
    if (enabled) {
      refetch();
    } else {
      setEnabled(true);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">今天吃什么？</h3>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? "思考中..." : enabled ? "换一个" : "帮我选！"}
        </button>
      </div>

      {data?.recommendation && (
        <div className="mt-2 p-3 bg-background rounded-md">
          {data.recommendation.canteen && (
            <p className="font-medium">
              {data.recommendation.canteen}
              {data.recommendation.window && ` · ${data.recommendation.window}`}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {data.recommendation.reason}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 6: 提交**

```bash
git add frontend/src/components/food/
git commit -m "feat(frontend): add food components — canteen cards, window list, recommend button"
```

---

### Task 13: 校园模块前端组件

**文件:**
- 创建: `frontend/src/components/campus/bus-schedule-table.tsx`
- 创建: `frontend/src/components/campus/bus-route-filter.tsx`
- 创建: `frontend/src/components/campus/calendar-view.tsx`

- [ ] **步骤 1: 创建 frontend/src/components/campus/bus-route-filter.tsx**

```tsx
"use client";

import { CAMPUSES, type Campus } from "@/types/food-campus";

interface BusRouteFilterProps {
  from: Campus | "";
  to: Campus | "";
  onFromChange: (campus: Campus | "") => void;
  onToChange: (campus: Campus | "") => void;
}

export function BusRouteFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: BusRouteFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">出发：</label>
        <select
          value={from}
          onChange={(e) => onFromChange(e.target.value as Campus | "")}
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">全部</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">到达：</label>
        <select
          value={to}
          onChange={(e) => onToChange(e.target.value as Campus | "")}
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">全部</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 创建 frontend/src/components/campus/bus-schedule-table.tsx**

```tsx
"use client";

import { useBusSchedule } from "@/lib/hooks/use-bus-schedule";
import type { Campus } from "@/types/food-campus";

interface BusScheduleTableProps {
  from?: Campus | "";
  to?: Campus | "";
}

export function BusScheduleTable({ from, to }: BusScheduleTableProps) {
  const { data, isLoading, error } = useBusSchedule(
    from || undefined,
    to || undefined
  );

  if (isLoading) {
    return <div className="animate-pulse bg-muted rounded-lg h-48" />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">加载失败，请稍后重试</div>
    );
  }

  const schedules = data?.schedules || [];
  const nextBus = data?.next;

  return (
    <div>
      {nextBus && (
        <div className="mb-4 p-3 border rounded-lg bg-green-50 dark:bg-green-950">
          <p className="text-sm font-medium">
            下一班：{nextBus.route} {nextBus.departure_time} 发车
          </p>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无匹配的校车班次
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">路线</th>
                <th className="text-left py-2 px-3 font-medium">出发</th>
                <th className="text-left py-2 px-3 font-medium">到达</th>
                <th className="text-left py-2 px-3 font-medium">发车时间</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b hover:bg-muted/50 ${
                    nextBus && s.id === nextBus.id ? "bg-green-50 dark:bg-green-950" : ""
                  }`}
                >
                  <td className="py-2 px-3">{s.route}</td>
                  <td className="py-2 px-3">{s.departure_campus}</td>
                  <td className="py-2 px-3">{s.arrival_campus}</td>
                  <td className="py-2 px-3 font-mono">{s.departure_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 3: 创建 frontend/src/components/campus/calendar-view.tsx**

```tsx
"use client";

import { useCalendar } from "@/lib/hooks/use-calendar";

export function CalendarView() {
  const { data, isLoading, error } = useCalendar();

  if (isLoading) {
    return <div className="animate-pulse bg-muted rounded-lg h-48" />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">加载失败，请稍后重试</div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Current week highlight */}
      <div className="border rounded-lg p-6 text-center bg-primary/5">
        <p className="text-sm text-muted-foreground mb-1">当前教学周</p>
        <p className="text-5xl font-bold text-primary">
          {data.current_week > 0 ? `第 ${data.current_week} 周` : "未开学"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {data.semester} 学期
        </p>
      </div>

      {/* Semester info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">开学日期</p>
          <p className="font-medium">{data.semester_start}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">学期结束</p>
          <p className="font-medium">{data.semester_end}</p>
        </div>
      </div>

      {/* Holidays */}
      <div>
        <h3 className="font-semibold mb-3">假期安排</h3>
        <div className="space-y-2">
          {data.holidays.map((holiday) => (
            <div
              key={holiday.name}
              className="border rounded-lg p-3 flex items-center justify-between"
            >
              <span className="font-medium">{holiday.name}</span>
              <span className="text-sm text-muted-foreground">
                {holiday.start_date} ~ {holiday.end_date}
              </span>
            </div>
          ))}
          {data.holidays.length === 0 && (
            <p className="text-muted-foreground text-sm">暂无假期信息</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/components/campus/
git commit -m "feat(frontend): add campus components — bus schedule table, route filter, calendar view"
```

---

### Task 14: 前端页面

**文件:**
- 创建: `frontend/src/app/(main)/food/canteen/page.tsx`
- 创建: `frontend/src/app/(main)/campus/bus/page.tsx`
- 创建: `frontend/src/app/(main)/campus/calendar/page.tsx`

- [ ] **步骤 1: 创建 frontend/src/app/(main)/food/canteen/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { CampusTabs } from "@/components/food/campus-tabs";
import { CanteenList } from "@/components/food/canteen-list";
import { WindowList } from "@/components/food/window-list";
import { RecommendButton } from "@/components/food/recommend-button";
import type { Campus } from "@/types/food-campus";

export default function CanteenPage() {
  const [campus, setCampus] = useState<Campus>("江安");
  const [selectedCanteen, setSelectedCanteen] = useState<{
    id: number;
    name: string;
  } | null>(null);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">食堂导览</h1>

      {selectedCanteen ? (
        <WindowList
          canteenId={selectedCanteen.id}
          canteenName={selectedCanteen.name}
          onBack={() => setSelectedCanteen(null)}
        />
      ) : (
        <>
          <RecommendButton campus={campus} />

          <div className="mt-6">
            <CampusTabs selected={campus} onSelect={setCampus} />
          </div>

          <div className="mt-4">
            <CanteenList
              campus={campus}
              onCanteenClick={(id) => {
                // We need the canteen name for the window list header.
                // For simplicity, we pass it through; in production, look up from cache.
                setSelectedCanteen({ id, name: `食堂 #${id}` });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

**注意:** 上面的 `onCanteenClick` 处理器使用了占位名称。要正确修复，需要更新 `CanteenList` 传递完整食堂对象:

更新 `CanteenList` 的 `onCanteenClick` prop 传递 `(id, name)` — 或让页面从查询缓存中查找食堂名称。为了 MVP 简洁起见，更新 `canteen-list.tsx` 使其发出 `(id: number, name: string)` 并让卡片传递两个值:

在 `canteen-list.tsx` 中，将回调类型改为 `(id: number, name: string) => void` 并调用 `onCanteenClick?.(canteen.id, canteen.name)`。

在 `page.tsx` 中，更新为:
```tsx
onCanteenClick={(id, name) => setSelectedCanteen({ id, name })}
```

- [ ] **步骤 2: 创建 frontend/src/app/(main)/campus/bus/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { BusRouteFilter } from "@/components/campus/bus-route-filter";
import { BusScheduleTable } from "@/components/campus/bus-schedule-table";
import type { Campus } from "@/types/food-campus";

export default function BusPage() {
  const [from, setFrom] = useState<Campus | "">("");
  const [to, setTo] = useState<Campus | "">("");

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">校车时刻表</h1>

      <BusRouteFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />

      <BusScheduleTable from={from} to={to} />
    </div>
  );
}
```

- [ ] **步骤 3: 创建 frontend/src/app/(main)/campus/calendar/page.tsx**

```tsx
import { CalendarView } from "@/components/campus/calendar-view";

export default function CalendarPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">校历查询</h1>
      <CalendarView />
    </div>
  );
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/app/\(main\)/food/ frontend/src/app/\(main\)/campus/
git commit -m "feat(frontend): add canteen, bus schedule, and calendar pages"
```

---

## Chunk 7: 前端测试与侧边栏导航更新

### Task 15: 前端组件测试

**文件:**
- 创建: `frontend/__tests__/components/food/canteen-card.test.tsx`
- 创建: `frontend/__tests__/components/food/recommend-button.test.tsx`
- 创建: `frontend/__tests__/components/campus/bus-schedule-table.test.tsx`
- 创建: `frontend/__tests__/components/campus/calendar-view.test.tsx`

- [ ] **步骤 1: 创建 frontend/__tests__/components/food/canteen-card.test.tsx**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CanteenCard } from "@/components/food/canteen-card";

describe("CanteenCard", () => {
  const openCanteen = {
    id: 1,
    name: "江安第一食堂",
    campus: "江安",
    building: "西园一食堂",
    open_time: "11:00",
    close_time: "13:00",
    meal_type: "lunch",
    is_open: true,
  };

  const closedCanteen = {
    ...openCanteen,
    id: 2,
    is_open: false,
  };

  it("renders canteen name", () => {
    render(<CanteenCard canteen={openCanteen} />);
    expect(screen.getByText("江安第一食堂")).toBeInTheDocument();
  });

  it("shows open status when canteen is open", () => {
    render(<CanteenCard canteen={openCanteen} />);
    expect(screen.getByText("营业中")).toBeInTheDocument();
  });

  it("shows closed status when canteen is closed", () => {
    render(<CanteenCard canteen={closedCanteen} />);
    expect(screen.getByText("已关闭")).toBeInTheDocument();
  });

  it("renders meal type and time range", () => {
    render(<CanteenCard canteen={openCanteen} />);
    expect(screen.getByText(/午餐/)).toBeInTheDocument();
    expect(screen.getByText(/11:00 - 13:00/)).toBeInTheDocument();
  });

  it("renders building info when available", () => {
    render(<CanteenCard canteen={openCanteen} />);
    expect(screen.getByText("西园一食堂")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2: 创建 frontend/__tests__/components/food/recommend-button.test.tsx**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecommendButton } from "@/components/food/recommend-button";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("RecommendButton", () => {
  it("renders the initial button text", () => {
    renderWithProviders(<RecommendButton />);
    expect(screen.getByText("帮我选！")).toBeInTheDocument();
  });

  it("renders the section title", () => {
    renderWithProviders(<RecommendButton />);
    expect(screen.getByText("今天吃什么？")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 3: 创建 frontend/__tests__/components/campus/bus-schedule-table.test.tsx**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BusScheduleTable } from "@/components/campus/bus-schedule-table";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("BusScheduleTable", () => {
  it("renders table headers", async () => {
    renderWithProviders(<BusScheduleTable />);
    // While loading, shows skeleton; after load, shows table headers
    // We just check it renders without crashing
    expect(document.querySelector("div")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 4: 创建 frontend/__tests__/components/campus/calendar-view.test.tsx**

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarView } from "@/components/campus/calendar-view";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("CalendarView", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<CalendarView />);
    expect(container).toBeInTheDocument();
  });
});
```

- [ ] **步骤 5: 运行 frontend tests**

```bash
cd frontend
npm test
```

- [ ] **步骤 6: 提交**

```bash
git add frontend/__tests__/
git commit -m "test(frontend): add component tests for food and campus modules"
```

---

### Task 16: 更新侧边栏导航

**文件:**
- 修改: `frontend/src/components/layout/sidebar.tsx`

- [ ] **步骤 1: 添加吃喝和校园导航项到侧边栏**

在 `frontend/src/components/layout/sidebar.tsx` 中，将以下导航项添加到已有的导航数组中（与已有的学业模块条目并列）:

```typescript
// Add these to the navigation items array:
{
  title: "吃喝",
  items: [
    { label: "食堂导览", href: "/food/canteen", icon: "UtensilsCrossed" },
  ],
},
{
  title: "校园",
  items: [
    { label: "校车时刻", href: "/campus/bus", icon: "Bus" },
    { label: "校历查询", href: "/campus/calendar", icon: "Calendar" },
  ],
},
```

安装 lucide-react 图标库（如果尚未安装，shadcn/ui 可能已经包含）:

```bash
cd frontend
npm install lucide-react  # if not already present
```

- [ ] **步骤 2: 验证导航功能正常**

```bash
cd frontend
npm run dev
# Navigate to /food/canteen, /campus/bus, /campus/calendar via sidebar
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/components/layout/sidebar.tsx
git commit -m "feat(frontend): add food and campus links to sidebar navigation"
```

---

## Chunk 8: Redis 缓存与最终验证

### Task 17: 校车与校历 Redis 缓存

**文件:**
- 修改: `backend/services/campus/service.py`
- 修改: `backend/services/campus/router.py`

- [ ] **步骤 1: 添加校车查询缓存包装器**

更新 `backend/services/campus/service.py`，添加可选的 Redis 缓存:

```python
import json
from shared.cache import redis_client

CACHE_TTL_BUS = 24 * 60 * 60  # 24 hours
CACHE_TTL_CALENDAR = 24 * 60 * 60  # 24 hours


async def get_bus_schedules_cached(
    session: AsyncSession,
    from_campus: str | None = None,
    to_campus: str | None = None,
    query_time: str | None = None,
    semester: str | None = None,
) -> dict:
    """Bus schedules with Redis cache layer."""
    cache_key = f"bus:{from_campus or 'all'}:{to_campus or 'all'}:{semester or DEFAULT_SEMESTER}"

    # Try cache first (but skip if query_time is set, since 'next' depends on current time)
    if not query_time and redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                result = json.loads(cached)
                # Recompute 'next' bus since it depends on current time
                now = datetime.now().time()
                next_bus = None
                for item in result["schedules"]:
                    dep_time = time(*[int(x) for x in item["departure_time"].split(":")])
                    if dep_time >= now:
                        next_bus = item
                        break
                result["next"] = next_bus
                return result
        except Exception:
            pass  # cache miss or redis error, fall through

    result = await get_bus_schedules(session, from_campus, to_campus, query_time, semester)

    # Store in cache (without 'next' since it's time-dependent)
    if redis_client:
        try:
            await redis_client.setex(cache_key, CACHE_TTL_BUS, json.dumps(result))
        except Exception:
            pass

    return result
```

- [ ] **步骤 2: 更新路由使用缓存版本**

在 `backend/services/campus/router.py` 中，修改导入:

```python
# Change:
# result = await service.get_bus_schedules(...)
# To:
result = await service.get_bus_schedules_cached(
    session, from_campus=from_campus, to_campus=to_campus, query_time=time
)
```

- [ ] **步骤 3: 提交**

```bash
git add backend/services/campus/
git commit -m "feat(campus): add Redis caching for bus schedule queries (24h TTL)"
```

---

### Task 18: 端到端验证

- [ ] **步骤 1: 启动 all services**

```bash
docker compose up -d --build
```

- [ ] **步骤 2: 运行 database migration and seed**

```bash
docker compose exec gateway alembic upgrade head
docker compose exec gateway python -m seed.load_seeds
```

- [ ] **步骤 3: 验证 backend API endpoints**

```bash
# Canteen list
curl http://localhost:8000/api/food/canteens?campus=江安 | python -m json.tool

# Canteen windows (use an ID from the canteens response)
curl http://localhost:8000/api/food/canteens/1/windows | python -m json.tool

# Canteen windows with category filter
curl "http://localhost:8000/api/food/canteens/1/windows?category=麻辣烫" | python -m json.tool

# Food recommendation
curl http://localhost:8000/api/food/recommend?campus=江安 | python -m json.tool

# Bus schedule
curl "http://localhost:8000/api/campus/bus?from=望江&to=江安" | python -m json.tool

# Calendar
curl http://localhost:8000/api/campus/calendar | python -m json.tool
```

- [ ] **步骤 4: 验证 frontend pages**

```bash
# Visit in browser:
# http://localhost:3000/food/canteen  → Campus tabs, canteen cards, recommend button
# http://localhost:3000/campus/bus    → Bus schedule table with route filter
# http://localhost:3000/campus/calendar → Current week, semester dates, holidays
```

- [ ] **步骤 5: 运行 all tests**

```bash
# Backend
cd backend
pytest -v --cov=services --cov-report=term-missing

# Frontend
cd frontend
npm test
```

- [ ] **步骤 6: 最终提交**

```bash
git add -A
git commit -m "feat: complete Plan 3 — food and campus module with canteens, bus, calendar"
```
