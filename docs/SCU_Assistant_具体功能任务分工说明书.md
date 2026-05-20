# SCU Assistant 具体功能任务分工说明书

项目名称：四川大学智能校园助手（SCU Assistant）  
团队名称：谭博文小组  
编制日期：2026年5月13日  
说明：本文档是在原《团队具体分工说明书》的基础上，结合当前代码已经实现的功能，重新拆出来的“可直接开发/验收”的任务清单。这里不再写笼统职责，只写具体要补的功能、涉及文件/API、完成标准。

## 一、当前已完成到什么程度

当前项目不是从零开始，主要功能已经有实现：

| 功能 | 当前状态 |
|---|---|
| 登录认证 | 已有教务密码登录、验证码、JWT、刷新 Token、退出登录、学习通扫码登录入口 |
| 教务数据 | 后端已有课表、成绩、培养方案抓取和缓存；运行日志显示真实教务数据已成功抓取 |
| 首页 | 已有个人学业总览，能展示今日课程、学分、成绩、每日简报入口 |
| 每日简报 | 后端已有 `/api/briefing`，前端有 `/dashboard` 简报页 |
| 课表 | 前端已有课表视图，后端已有 `/api/academic/schedule` |
| 成绩 | 前端已有成绩统计、学期筛选、培养方案进度，后端已有 `/api/academic/scores` 和 `/api/academic/plan-completion` |
| DDL | 后端已有增删改查；前端已有 DDL 页面；学习通同步入口已做 |
| 考试 | 后端已有考试增删查和复习计划接口；前端已有考试倒计时页面 |
| AI 对话 | 已有流式对话、Tool Use、意图路由和前端工具调用展示 |
| RAG | 已有知识库、上传、检索问答、来源展示 |
| 智能出题 | 已接在 RAG 页面中，能基于知识库生成题目 |
| AI 选课推荐 | 已有后端接口和前端页面 |
| 天气 | 后端已有和风天气/Mock 降级，前端已有天气页 |
| 食堂 | 前端已有静态食堂页面，还没有后端接口 |
| 通知 | 后端已有教务处/学工部爬虫和 Mock 兜底，前端已有通知页 |
| 校车/校历 | 前端已有静态页面，还没有后端接口 |
| 设置 | 已有主题切换、学习通绑定、AI 记忆管理入口 |
| 工程 | 已有本地启动脚本、Docker Compose、前后端 CI 配置 |

所以剩下不是“每人负责一个方向”这么虚，而是下面这些具体功能和补漏。

## 二、按成员拆分的实际任务

## 1. 谭博文：项目整合 + AI 对话演示闭环

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| TBW-1 | 整理最终演示链路 | README、答辩 PPT、演示脚本 | 写出完整演示顺序：登录 → 首页 → 课表/成绩 → DDL → AI 对话 → RAG → 天气/通知 → 每日简报 |
| TBW-2 | 准备 AI 对话固定演示问题 | `backend/services/chat/tools.py`、`frontend/src/app/(main)/chat/page.tsx` | 至少准备 6 条能稳定展示工具调用的问题：查今天课表、查成绩概况、查待办 DDL、查天气、问知识库、生成复习建议 |
| TBW-3 | 检查 AI Tool Use 展示闭环 | 聊天页、后端 `/api/chat/stream` | 前端能显示“正在调用工具/调用完成”，后端返回最终回答；失败时有明确提示 |
| TBW-4 | 统一功能口径 | README、需求说明书、系统设计说明书、分工文档、PPT | 文档中功能名称一致，比如“课件问答/RAG 文档问答”不要混用成两个功能 |
| TBW-5 | 收集各成员截图和自测结果 | `docs/` 或答辩材料目录 | 每个模块至少有 1 张页面截图、1 条接口或功能验证记录 |
| TBW-6 | 准备风险兜底话术 | 答辩材料 | 教务系统、LLM、Embedding、学习通、天气、通知抓取失败时都有备用说明 |

### 最终交付

- `docs/SCU_Assistant_最终演示脚本.md`
- AI 对话演示问题清单
- 最终答辩功能边界表
- 风险兜底说明

## 2. 覃泽锴：学业模块前端功能补齐

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| QZK-1 | DDL 页面补齐错误提示 | `frontend/src/app/(main)/academic/deadline/page.tsx` | 替换当前 `TODO: toast error`，新增/完成/删除/同步失败时都用 `sonner` 或页面提示显示原因 |
| QZK-2 | 考试页面补齐错误提示 | `frontend/src/app/(main)/academic/exam/page.tsx` | 添加考试失败、删除失败、复习计划生成失败时有可见提示 |
| QZK-3 | 课表页增加“刷新教务数据”入口 | `frontend/src/app/(main)/academic/schedule/page.tsx`、`frontend/src/lib/academic.ts` | 页面有刷新按钮，调用 `/api/academic/refresh`，刷新中禁用按钮，刷新成功后重新拉取课表 |
| QZK-4 | 成绩页增加“刷新教务数据”入口 | `frontend/src/app/(main)/academic/scores/page.tsx` | 用户能手动触发后端刷新成绩/培养方案，刷新后更新页面 |
| QZK-5 | 学业页面未登录/Session 过期处理 | 课表页、成绩页、DDL 页、考试页 | API 返回 401 或 `SESSION_EXPIRED` 时跳转登录或显示“请重新登录教务系统” |
| QZK-6 | 学业模块移动端检查 | 课表、成绩、DDL、考试页面 | 手机宽度下表格/卡片/按钮不溢出，课表能横向或自适应展示 |
| QZK-7 | 学业演示数据截图 | 前端页面 | 提交课表、成绩、培养方案、DDL、考试倒计时 5 张截图 |

### 最终交付

- DDL/考试错误提示已补齐
- 课表/成绩刷新入口可用
- 学业前端联调记录
- 学业模块截图材料

## 3. 孔垂骄：认证与教务后端收口

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| KCJ-1 | 补齐后端测试源码 | `backend/tests/` | 当前只有 `__pycache__`，需要新增实际测试文件，至少覆盖 `/health`、验证码、Mock 登录、课表接口、成绩接口 |
| KCJ-2 | 整理 `cache_service.py` 与 `cache_service_new.py` | `backend/services/academic/` | 确认只保留一个实际使用版本，另一个删除或在文档中说明用途，避免交付时出现重复实现 |
| KCJ-3 | 完善 `/api/academic/refresh` 返回值 | `backend/services/academic/router.py`、`cache_service.py` | 返回刷新结果，例如课表/成绩/培养方案是否刷新成功、失败原因 |
| KCJ-4 | 教务异常错误码统一 | `backend/services/academic/jwc_client.py`、`shared/exceptions.py` | 验证码错误、密码错误、Session 过期、教务系统不可用，都有清晰错误码和中文提示 |
| KCJ-5 | Mock/真实教务切换说明 | `docs/`、README | 写清 `JWC_USE_MOCK=true/false` 的使用场景、演示建议、真实教务需要的网络条件 |
| KCJ-6 | JWT 密钥警告处理 | `backend/.env.example`、README | 明确开发密钥仅本地使用，演示/生产环境使用 32 字节以上密钥 |
| KCJ-7 | 认证与教务接口说明 | `docs/API_接口说明.md` 或同类文档 | 列出 `/api/auth/*`、`/api/academic/*` 的路径、参数、返回字段、错误码 |

### 最终交付

- 后端测试文件
- 教务接口联调记录
- Mock/真实教务切换说明
- 认证与教务 API 说明

## 4. 李亚飞：天气与食堂前端功能补齐

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| LYF-1 | 天气页增加城市输入或校区选择 | `frontend/src/app/(main)/weather/page.tsx`、`frontend/src/lib/weather.ts` | 用户可以查询“成都/江安/望江/华西”等预设或输入城市，不再只固定成都 |
| LYF-2 | 天气页显示数据来源状态 | 天气页 | 展示“实时天气”或“示例天气/Mock 数据”，避免演示时解释不清 |
| LYF-3 | 天气页错误提示优化 | 天气页 | 后端失败时显示“天气服务暂不可用”，而不是空白或静默失败 |
| LYF-4 | 食堂页接入后端食堂接口 | `frontend/src/app/(main)/food/canteen/page.tsx`、新增 `frontend/src/lib/canteen.ts` | 如果谭旭睿完成 `/api/canteens`，前端改为接口获取；接口失败时使用本地静态兜底 |
| LYF-5 | 食堂页增加搜索功能 | 食堂页 | 可按食堂名、窗口名、菜品类别搜索，例如“清真”“面条”“奶茶” |
| LYF-6 | 食堂页数据来源说明 | 食堂页底部或说明区域 | 写清数据是整理维护数据，不是实时排队/实时营业系统 |
| LYF-7 | 生活服务截图 | 天气页、食堂页 | 提交天气穿衣建议、食堂筛选、食堂详情截图 |

### 最终交付

- 天气页城市查询/校区选择
- 食堂搜索功能
- 食堂接口接入或静态兜底
- 生活服务页面截图

## 5. 谭旭睿：天气与食堂后端功能补齐

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| TXR-1 | 天气接口增加数据来源字段 | `backend/services/weather/schemas.py`、`service.py` | `/api/weather` 返回 `source` 或 `is_mock`，前端能知道是真实 API 还是 Mock |
| TXR-2 | 天气服务测试 | `backend/tests/test_weather.py` | 覆盖穿衣建议、无 API Key 降级、第三方 API 失败降级 |
| TXR-3 | 新增食堂后端模块 | 新增 `backend/services/canteen/router.py`、`schemas.py`、`service.py` | 提供 `/api/canteens`，返回食堂、校区、楼栋、营业时间、窗口列表 |
| TXR-4 | 食堂数据结构化 | 可放在 `backend/services/canteen/data.py` 或 JSON | 把当前前端 `CANTEENS` 数据整理到后端，字段稳定，方便前端消费 |
| TXR-5 | 网关注册食堂路由 | `backend/gateway/main.py` | FastAPI docs 中能看到 canteen 接口 |
| TXR-6 | 食堂接口筛选参数 | `/api/canteens` | 支持 `campus`、`keyword` 查询参数，前端可直接筛选 |
| TXR-7 | 生活服务接口说明 | `docs/API_接口说明.md` | 写清 `/api/weather` 和 `/api/canteens` 的字段含义 |

### 最终交付

- `/api/canteens` 后端接口
- 天气接口来源字段
- 天气/食堂接口测试或自测记录
- 生活服务 API 说明

## 6. 徐锐学：首页、通知、校园信息前端收口

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| XRX-1 | 明确首页和每日简报页定位 | `frontend/src/app/(main)/page.tsx`、`dashboard/page.tsx` | 首页展示“学业总览”，每日简报页展示“AI 今日简报”，页面文案不重复 |
| XRX-2 | 首页增加通知/天气/DDL 快捷入口 | 首页 | 从首页能一键进入通知、天气、DDL、AI 对话，形成完整演示路径 |
| XRX-3 | 通知页增加刷新按钮 | `frontend/src/app/(main)/notification/page.tsx`、`frontend/src/lib/notification.ts` | 点击刷新调用 `POST /api/notifications/refresh`，显示新增数量或失败提示 |
| XRX-4 | 通知页显示最近更新时间 | 通知页 | 页面显示“最近刷新时间”，方便演示说明数据来源 |
| XRX-5 | 校车页接入后端接口 | `frontend/src/app/(main)/campus/bus/page.tsx`、新增 `frontend/src/lib/campus.ts` | 如果毛立业提供 `/api/campus/bus`，前端改为接口获取；失败时使用本地静态兜底 |
| XRX-6 | 校历页接入后端接口 | `frontend/src/app/(main)/campus/calendar/page.tsx` | 如果毛立业提供 `/api/campus/calendar`，前端改为接口获取；失败时使用本地静态兜底 |
| XRX-7 | 顶栏搜索补全功能路由 | `frontend/src/components/layout/topbar.tsx` | 搜索关键词能覆盖“食堂、校车、校历、通知、天气、DDL、考试、RAG、选课推荐” |
| XRX-8 | 校园信息截图 | 首页、通知、校车、校历、每日简报 | 提交至少 5 张截图 |

### 最终交付

- 首页演示入口完整
- 通知刷新按钮可用
- 校车/校历接口接入或静态兜底
- 校园信息前端截图和自测记录

## 7. 毛立业：通知、校车、校历后端功能补齐

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| MLY-1 | 补齐研究生院通知来源 | `backend/services/notification/crawler.py` | 当前真实抓取主要是教务处、学工部；要么新增研究生院真实抓取，要么把 README/文档口径改成“教务处、学工部为真实抓取，研究生院为后续扩展/Mock” |
| MLY-2 | 通知刷新返回新增数量 | `backend/services/notification/router.py`、`crawler.py` | `POST /api/notifications/refresh` 返回 `new_count`、`total_count`、`sources`，前端可展示 |
| MLY-3 | 通知接口增强筛选 | `/api/notifications` | 支持 `source`、`limit`、`offset` 已有的基础上，确认排序按发布时间倒序 |
| MLY-4 | 新增校车后端接口 | 新增 `backend/services/campus/router.py`、`schemas.py`、`service.py` | `/api/campus/bus` 返回路线、方向、发车时间、数据来源、更新时间 |
| MLY-5 | 新增校历后端接口 | 同上 | `/api/campus/calendar` 返回学期事件、当前教学周、下一个事件 |
| MLY-6 | 网关注册 campus 路由 | `backend/gateway/main.py` | FastAPI docs 中能看到 campus 接口 |
| MLY-7 | 校园信息数据维护说明 | `docs/` | 写清校车、校历数据来源、更新时间、是否实时 |
| MLY-8 | 通知/校园信息后端自测 | `backend/tests/` 或自测记录 | 至少验证通知列表、通知刷新、校车接口、校历接口 4 个功能 |

### 最终交付

- 研究生院通知口径处理完成
- `/api/campus/bus`
- `/api/campus/calendar`
- 通知刷新返回值增强
- 校园信息后端说明和自测记录

## 8. 张傲楚：RAG、智能出题、复习计划功能收口

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| ZAC-1 | RAG 页面补齐错误提示 | `frontend/src/app/(main)/academic/rag/page.tsx` | 创建知识库失败、删除失败、上传失败、查询失败都有可见提示，不再静默失败或只留 TODO |
| ZAC-2 | 修正 RAG 支持文件格式口径 | `rag/page.tsx`、`backend/services/rag/parser.py`、README | 前端不要写不稳定的 `.ppt`，建议明确支持 PDF、PPTX、TXT、MD |
| ZAC-3 | Embedding 未配置友好提示 | `backend/services/rag/embedding.py`、`rag/router.py` | 未配置 Embedding Key 时返回中文错误，前端显示“请配置 Embedding API Key” |
| ZAC-4 | RAG 演示资料准备 | `docs/demo/` 或单独资料文件夹 | 准备 1 个 PDF/PPTX 样例，能上传并问出答案 |
| ZAC-5 | 智能出题 JSON 解析增强 | `backend/services/quiz/service.py` | LLM 返回带代码块、前后多余文本或字段缺失时尽量解析；解析失败返回可读错误 |
| ZAC-6 | 智能出题前端空结果提示 | RAG 页面 Quiz Tab | 生成失败时明确提示原因，不只是“未能生成题目” |
| ZAC-7 | 复习计划演示样例 | `frontend/src/app/(main)/academic/exam/page.tsx`、后端 studyplan | 准备一个考试记录，点击生成复习计划后能展示 Markdown/结构化结果 |
| ZAC-8 | AI 功能评估表 | `docs/AI_功能评估样例.md` | 记录至少 8 条：问题、期望、实际、是否通过、备注 |

### 最终交付

- RAG 演示资料
- RAG/Quiz 错误提示补齐
- 智能出题和复习计划演示记录
- AI 功能评估表

## 9. 朱圣相：测试、CI、启动和演示环境

### 具体要做的功能/工作

| 编号 | 具体任务 | 涉及位置 | 完成标准 |
|---|---|---|---|
| ZSX-1 | 从零启动验证 | `docs/CONDA_DEV_GUIDE.md`、`start_dev.bat`、`start_dev.sh` | 按文档从新环境启动，记录 Python/Node 版本、命令、结果 |
| ZSX-2 | 前端检查跑通 | `frontend/` | 执行 `npm run lint`、`npm test`、`npm run build`，保存结果 |
| ZSX-3 | 后端检查跑通 | `backend/` | 执行 `ruff check`、`pytest`，如果失败，记录失败原因并推动对应负责人修复 |
| ZSX-4 | 修正后端 CI 与测试实际情况 | `.github/workflows/ci-backend.yml`、`backend/tests/` | CI 不能引用不存在的测试；和孔垂骄一起补齐测试后跑通 |
| ZSX-5 | 启动脚本增加端口占用提示 | `start_dev.bat`、`start_dev.sh` | 如果 3000/8000 被占用，脚本能提示用户，避免演示时启动失败 |
| ZSX-6 | 演示环境检查表 | `docs/SCU_Assistant_演示环境检查表.md` | 包含前端、后端、API Key、Mock 开关、数据库、Redis/内存缓存、浏览器登录状态 |
| ZSX-7 | 测试报告 | `docs/SCU_Assistant_测试报告.md` | 汇总前后端检查结果、接口自测结果、已知问题、负责人 |
| ZSX-8 | 最终交付清单 | `docs/SCU_Assistant_最终交付清单.md` | 列清源码、文档、PPT、周报、测试报告、演示脚本 |

### 最终交付

- 前端 lint/test/build 结果
- 后端 ruff/pytest 结果
- 演示环境检查表
- 测试报告
- 最终交付清单

## 三、按功能模块汇总还要做什么

| 功能模块 | 具体还缺什么 | 负责人 |
|---|---|---|
| 登录认证 | Session 过期提示、登录失败提示、JWT 密钥说明、认证测试 | 覃泽锴、孔垂骄 |
| 教务数据 | 手动刷新入口、刷新结果返回、Mock/真实切换说明、接口测试 | 覃泽锴、孔垂骄 |
| DDL | 错误 toast、学习通同步失败提示、同步结果展示 | 覃泽锴 |
| 考试 | 错误 toast、复习计划演示样例 | 覃泽锴、张傲楚 |
| AI 对话 | 固定演示问题、工具调用成功样例、失败兜底话术 | 谭博文、张傲楚 |
| RAG | 文件格式统一、Embedding 未配置提示、演示资料、错误提示 | 张傲楚 |
| 智能出题 | JSON 解析增强、空结果提示、演示样例 | 张傲楚 |
| 天气 | 城市/校区选择、数据来源字段、真实/Mock 验证、测试 | 李亚飞、谭旭睿 |
| 食堂 | 后端接口、前端接口接入、搜索、数据来源说明 | 李亚飞、谭旭睿 |
| 通知 | 刷新按钮、刷新返回新增数量、研究生院来源口径、最近更新时间 | 徐锐学、毛立业 |
| 校车 | 后端接口、前端接入、数据来源和更新时间 | 徐锐学、毛立业 |
| 校历 | 后端接口、前端接入、当前教学周和下一个事件 | 徐锐学、毛立业 |
| 首页/简报 | 首页和简报页定位、快捷入口、演示路径 | 徐锐学、谭博文 |
| 工程测试 | 后端测试源码、CI 跑通、启动脚本端口检查、测试报告 | 朱圣相 |

## 四、建议优先级

### 第一优先级：答辩前必须做

1. DDL、考试、RAG 页面错误提示补齐。
2. 后端测试源码补齐，至少让 CI 不再是假配置。
3. RAG 演示资料、AI 对话固定问题、教务真实数据演示样例准备好。
4. 通知来源口径改准确，研究生院通知要么实现，要么文档不要写成已真实抓取。
5. 首页、通知、天气、DDL、AI、RAG 的演示路径跑通。

### 第二优先级：能显著加分

1. 食堂后端接口和前端接入。
2. 校车、校历后端接口和前端接入。
3. 天气城市/校区选择。
4. 通知刷新按钮和最近更新时间。
5. 启动脚本端口占用提示。

### 第三优先级：有时间再做

1. 更多前端单元测试。
2. 更细的 AI 评估指标。
3. 食堂收藏、常用路线、通知关键词搜索。
4. 部署到公网或内网服务器进行演示。

## 五、每个人答辩时可以讲什么

| 成员 | 答辩可讲的实际功能 |
|---|---|
| 谭博文 | 项目整体架构、AI 对话、Tool Use、演示链路、风险兜底 |
| 覃泽锴 | 登录前端、课表、成绩、DDL、考试页面和学业前端交互 |
| 孔垂骄 | 教务系统对接、验证码登录、课表/成绩抓取、缓存、认证 API |
| 李亚飞 | 天气穿衣页面、食堂页面、生活服务前端体验 |
| 谭旭睿 | 天气 API、Mock 降级、食堂后端接口和数据结构 |
| 徐锐学 | 首页、每日简报、通知、校车、校历、全站导航 |
| 毛立业 | 通知爬虫、通知聚合、校车/校历后端接口、校园信息数据维护 |
| 张傲楚 | RAG 文档问答、智能出题、复习计划、AI 评估样例 |
| 朱圣相 | 本地启动、Docker/CI、测试报告、演示环境保障 |

