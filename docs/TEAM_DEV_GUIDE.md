# 团队开发指南 — 无需 Docker 的本地开发

本指南帮助团队成员在 **无法安装 Docker Desktop** 的 Windows 电脑上搭建完整开发环境。

## 前置要求

只需安装两样东西：

| 工具 | 版本要求 | 下载地址 |
|------|---------|---------|
| Python | >= 3.11 | https://www.python.org/downloads/ |
| Node.js | >= 18 | https://nodejs.org/ |

> **安装 Python 时**：务必勾选 **"Add Python to PATH"**

## 一、首次搭建（约 5 分钟）

### 方法 A：一键启动（推荐）

```bash
# 双击项目根目录的 start_dev.bat
# 会自动完成：创建虚拟环境 → 安装依赖 → 启动前后端
```

### 方法 B：手动启动

**终端 1 — 后端**
```bash
cd backend

# 首次：创建虚拟环境
python -m venv .venv
.venv\Scripts\activate

# 安装依赖（含 SQLite 和内存缓存支持）
pip install -e ".[dev]"

# 启动（带热重载）
python start_dev.py --reload
```

**终端 2 — 前端**
```bash
cd frontend
npm install    # 首次
npm run dev
```

### 启动成功后

- 前端页面：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

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

## 五、常见问题

### Q: 启动后端报 `ModuleNotFoundError`
确保激活了虚拟环境并安装了依赖：
```bash
cd backend
.venv\Scripts\activate
pip install -e ".[dev]"
```

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
```
如果提示缺少 watchfiles，运行 `pip install watchfiles`。

### Q: `dev_scu.db` 数据库出问题了
直接删除重启即可，会自动重建：
```bash
del backend\dev_scu.db
python start_dev.py --reload
```

### Q: Git pull 后前端报错
可能是依赖更新了：
```bash
cd frontend && npm install
cd ../backend && pip install -e ".[dev]"
```
