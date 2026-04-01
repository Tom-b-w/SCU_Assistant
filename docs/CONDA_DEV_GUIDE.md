# Conda 开发环境搭建指南

无需 Docker，使用 Conda 管理 Python 环境，直接在本地开发。

## 前置要求

| 工具 | 下载地址 |
|------|---------|
| Miniconda（推荐）或 Anaconda | https://docs.conda.io/en/latest/miniconda.html |
| Node.js >= 18 | https://nodejs.org/ |

> Miniconda 体积小（约 80MB），推荐用它而不是完整 Anaconda

## 一、搭建环境（首次）

### 1. 克隆项目

```bash
git clone https://github.com/Tom-b-w/SCU_Assistant.git
cd SCU_Assistant
```

### 2. 创建 Conda 虚拟环境

```bash
# 创建名为 scu 的环境，指定 Python 3.11
conda create -n scu python=3.11 -y

# 激活环境
conda activate scu
```

### 3. 安装后端依赖

```bash
cd backend
pip install -e ".[dev]"
```

> 如果 pip 慢，换清华源：`pip install -e ".[dev]" -i https://pypi.tuna.tsinghua.edu.cn/simple`

### 4. 安装前端依赖

```bash
cd ../frontend
npm install
```

> 如果 npm 慢，换淘宝源：`npm config set registry https://registry.npmmirror.com`

## 二、日常启动

每次开发只需以下步骤：

### 终端 1 — 启动后端

```bash
cd backend
conda activate scu
python start_dev.py --reload
```

看到以下输出说明成功：
```
[dev] 热重载已启用 (watchfiles)
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 终端 2 — 启动前端

```bash
cd frontend
npm run dev
```

看到以下输出说明成功：
```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

### 打开浏览器

- 页面：http://localhost:3000
- API 文档：http://localhost:8000/docs

## 三、开发体验

| 你做的事 | 效果 |
|----------|------|
| 修改 `frontend/src/` 下的文件并保存 | 浏览器**自动刷新**，立刻看到变化 |
| 修改 `backend/` 下的 `.py` 文件并保存 | 后端**自动重启**，API 立刻更新 |
| 修改 `.env.dev` | 需要手动重启后端（Ctrl+C → 重新运行） |

## 四、团队 Git 协作

### 分支规范

```bash
# 从 main 创建你的功能分支
git checkout main
git pull origin main
git checkout -b feat/你的功能名

# 例如
git checkout -b feat/exam-page        # 做考试页面
git checkout -b fix/login-error        # 修登录 bug
git checkout -b style/sidebar-color    # 改侧边栏样式
```

### 提交代码

```bash
git add .
git commit -m "feat: 完成了XXX功能"
git push origin feat/你的功能名
```

### 合并流程

1. 在 GitHub 上对你的分支发起 **Pull Request**
2. 通知队友 Review
3. Review 通过后合并到 `main`

### 拉取队友最新代码

```bash
git checkout main
git pull origin main

# 如果你在自己的分支上，想同步 main 的更新
git checkout feat/你的分支
git merge main
```

## 五、常见问题

### Q: `conda activate scu` 提示 "conda 不是内部命令"

需要用 **Anaconda Prompt** 或 **Miniconda Prompt** 打开终端，而不是普通 cmd。

或者初始化 conda 到你的 shell：
```bash
conda init bash    # Git Bash
conda init cmd.exe # CMD
conda init powershell # PowerShell
```
然后**重新打开终端**。

### Q: 忘了环境名，或者想确认环境是否已创建

```bash
conda env list
```

### Q: 想删除重建环境

```bash
conda deactivate
conda remove -n scu --all -y
conda create -n scu python=3.11 -y
```

### Q: 数据库出问题了

直接删除 SQLite 文件，重启后自动重建：
```bash
# 在 backend 目录下
del dev_scu.db        # Windows CMD
rm dev_scu.db         # Git Bash / macOS / Linux
```

### Q: 端口 8000 或 3000 被占用

```bash
# Windows — 找出占用端口的进程并结束
netstat -ano | findstr :8000
taskkill /F /PID <PID号>
```

### Q: git pull 之后报错

可能是依赖更新了，重新安装：
```bash
cd backend && conda activate scu && pip install -e ".[dev]"
cd ../frontend && npm install
```

## 六、技术原理（了解即可）

项目通过 `.env.dev` 配置了轻量替代方案，无需真实数据库服务：

| 生产环境 | 开发替代 | 说明 |
|----------|---------|------|
| PostgreSQL | SQLite (`dev_scu.db`) | 文件数据库，零安装 |
| Redis | fakeredis（内存） | 内存模拟，零安装 |
| 真实教务系统 | Mock 数据 | 14门课 + 20条成绩 |

所有核心功能在此模式下均可正常运行和开发。
