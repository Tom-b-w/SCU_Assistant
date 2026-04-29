# LLM 意图路由实现文档

## 概述

LLM 意图路由（Intent Router）是一种基于大语言模型 Function Calling 能力的智能路由机制。它让 LLM 自主判断用户意图并选择合适的工具执行，实现"Reason + Act"（ReAct）模式。

## 核心原理

### 传统方案 vs LLM 意图路由

| 方案 | 实现方式 | 缺点 |
|------|----------|------|
| 关键词匹配 | `if "课表" in query: 查询课表()` | 规则死板、难扩展、无法处理复杂意图 |
| 分类模型 | 训练意图分类器 | 需要标注数据、泛化能力有限 |
| **LLM 意图路由** | Function Calling | 灵活、可扩展、支持复杂推理 |

### 工作流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────┐
│  LLM（携带可用工具列表）              │
│  - get_today_schedule: 查询课表      │
│  - query_weather: 查询天气           │
│  - search_knowledge_base: 知识库搜索 │
│  - ...                              │
└─────────────────────────────────────┘
    │
    ├──► 直接回复文本 ──► 返回给用户
    │
    └──► 调用工具
              │
              ▼
         ┌─────────┐
         │ 执行工具 │
         └─────────┘
              │
              ▼
         工具结果回传 LLM
              │
              ▼
         生成最终回复 ──► 返回给用户
```

## 架构设计

### 文件结构

```
backend/services/chat/
├── intent_router.py    # 核心意图路由器
├── service.py          # 对话服务（集成路由）
├── tools.py            # 工具定义与执行
├── schemas.py          # 数据模型
└── router.py           # API 路由
```

### 核心类

#### IntentRouter

```python
class IntentRouter:
    def __init__(self, student_id, user_id, db, redis_client):
        self.student_id = student_id
        self.user_id = user_id
        self.db = db
        self.redis_client = redis_client

    async def route(self, messages, system, llm_client) -> RouteResult:
        """非流式路由：执行工具调用循环"""

    async def route_stream(self, messages, system, llm_client):
        """流式路由：yield SSE 事件"""
```

#### 工具定义（Anthropic 格式）

```python
TOOL_DEFINITIONS_ANTHROPIC = [
    {
        "name": "get_today_schedule",
        "description": "查询用户今天的课表",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "query_weather",
        "description": "查询指定城市的天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称"}
            },
            "required": []
        }
    },
    # ... 更多工具
]
```

### 多轮工具调用

支持最多 3 轮工具调用循环，防止无限循环：

```python
MAX_ITERATIONS = 3

for iteration in range(MAX_ITERATIONS):
    resp = await llm_client.chat(messages, tools=tools)

    if not resp["tool_calls"]:
        break  # 无工具调用，结束循环

    for tc in resp["tool_calls"]:
        result = await execute_tool(tc["name"], tc["input"])
        messages.append(tool_result_message)
```

## SSE 事件类型

### 后端发送的事件

| 事件类型 | 数据结构 | 说明 |
|----------|----------|------|
| `tool_call` | `{"type": "tool_call", "name": "...", "arguments": {...}}` | 工具调用开始 |
| `tool_result` | `{"type": "tool_result", "name": "..."}` | 工具执行完成 |
| `text` | `{"type": "text", "content": "..."}` | 文本回复（增量） |
| `done` | `{"type": "done"}` | 流结束 |
| `error` | `{"type": "error", "content": "..."}` | 错误信息 |

### 前端处理

```typescript
async for event in parse_sse_stream():
    switch (event.type) {
        case "tool_call":
            showToolCallIndicator(event.name);  // 显示 "正在查询课表..."
            break;
        case "tool_result":
            markToolComplete(event.name);        // 显示 "✅ 查询课表"
            break;
        case "text":
            appendToMessage(event.content);      // 追加文本
            break;
        case "done":
            finishStreaming();                   // 结束
            break;
    }
```

---

## 百炼平台 API 适配

### 问题背景

项目最初为 Anthropic Claude API 设计，使用 `/v1/messages` 端点和特定的请求格式。阿里云百炼平台（DashScope）提供 OpenAI 兼容模式，但格式有所不同。

### API 格式对比

| 项目 | Anthropic API | 百炼 OpenAI 兼容 |
|------|---------------|------------------|
| 端点 | `/v1/messages` | `/v1/chat/completions` |
| 认证 | `x-api-key: {key}` 或 `Authorization: Bearer {token}` | `Authorization: Bearer {token}` |
| System Prompt | `{"system": "..."}` | `{"messages": [{"role": "system", "content": "..."}]}` |
| 流式事件 | `content_block_delta` | `choices[0].delta.content` |
| Function Calling | 支持 | 部分模型支持 |

### LLMClient 适配实现

```python
class LLMClient:
    def __init__(self, api_key, base_url, model, auth_token=""):
        self._is_openai_compatible = self._detect_openai_compatible(base_url)

        # 根据类型设置认证头
        if self._is_openai_compatible:
            headers["Authorization"] = f"Bearer {auth_token or api_key}"
        else:
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"

    def _detect_openai_compatible(self, base_url: str) -> bool:
        """检测是否为 OpenAI 兼容 API"""
        indicators = [
            "dashscope.aliyuncs.com",  # 阿里云百炼
            "api.openai.com",          # OpenAI
            "api.deepseek.com",        # DeepSeek
        ]
        return any(i in base_url.lower() for i in indicators)
```

### 配置方式

#### 阿里云百炼（通义千问）

```bash
LLM_AUTH_TOKEN=sk-xxxxxxxx           # API Key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode
LLM_MODEL=qwen-max                   # 模型名称
```

#### Anthropic Claude（官方）

```bash
LLM_API_KEY=sk-ant-xxxxxxxx
LLM_BASE_URL=https://api.anthropic.com
LLM_MODEL=claude-sonnet-4-20250514
```

#### DeepSeek

```bash
LLM_AUTH_TOKEN=sk-xxxxxxxx
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

### 注意事项

1. **URL 不要包含 `/v1`**：代码会自动添加
   - ✅ `https://dashscope.aliyuncs.com/compatible-mode`
   - ❌ `https://dashscope.aliyuncs.com/compatible-mode/v1`

2. **认证方式**：
   - 百炼使用 `LLM_AUTH_TOKEN`（Bearer 认证）
   - Anthropic 使用 `LLM_API_KEY`（x-api-key header）

3. **Function Calling 限制**：
   - 通义千问 OpenAI 兼容模式暂不支持 Function Calling
   - 意图路由会退化为纯 RAG 模式（依赖预注入的用户数据）

---

## 安全注意事项

### 环境变量保护

**`.env` 和 `.env.*` 文件已被 `.gitignore` 忽略，不会被上传到 Git：**

```gitignore
# Environment
.env
.env.*
!.env.example
```

### 检查敏感信息是否被追踪

```bash
# 检查文件状态
git status backend/.env.dev

# 如果已被追踪，从 Git 中移除（保留本地文件）
git rm --cached backend/.env.dev

# 提交更改
git add .gitignore
git commit -m "chore: ignore all .env files"
```

### 最佳实践

1. **使用 `.env.example`**：提供配置模板，不包含真实密钥
2. **定期轮换 API Key**：如果密钥曾泄露，立即更换
3. **检查 Git 历史**：确保没有提交过敏感信息
4. **使用环境变量注入**：生产环境通过 CI/CD 或容器环境变量注入

---

## 测试

### 运行测试

```bash
# 单元测试
cd backend
python tests/simple_test.py

# API 连接测试
python tests/standalone_test.py
```

### 手动测试

```bash
# 启动后端
uvicorn gateway.main:app --reload

# 测试对话
curl -X POST http://localhost:8000/api/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "今天有什么课？"}]}'
```

---

## 参考资料

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [阿里云百炼 OpenAI 兼容模式](https://help.aliyun.com/zh/model-studio/developer-reference/openai-api)
- [ReAct 论文](https://arxiv.org/abs/2210.03629)
