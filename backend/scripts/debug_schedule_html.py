"""
调试脚本：抓取课表 HTML 页面，分析表格结构。
"""
import asyncio
import json
import sys

import redis.asyncio as aioredis
import httpx

JWC_BASE = "http://zhjw.scu.edu.cn"
SCHEDULE_URL = f"{JWC_BASE}/student/courseSelect/thisSemesterCurriculum/index"
COOKIE_NAME = "student.urpSoft.cn"


async def main():
    r = aioredis.from_url("redis://localhost:6379/0")
    session_value = await r.get("jwc_auth:2023141461122")
    await r.aclose()

    if not session_value:
        print("ERROR: 教务 session 不存在，请先登录")
        sys.exit(1)

    cookie_val = session_value.decode("utf-8") if isinstance(session_value, bytes) else session_value
    print(f"Session: {cookie_val[:20]}...")

    async with httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        cookies={COOKIE_NAME: cookie_val},
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        },
    ) as client:
        # 1. 获取课表页面 HTML
        resp = await client.get(SCHEDULE_URL)
        print(f"状态码: {resp.status_code}, URL: {resp.url}")

        if "/login" in str(resp.url):
            print("ERROR: 被重定向到登录页，session 已过期")
            sys.exit(1)

        html = resp.text
        print(f"HTML 长度: {len(html)}")

        # 保存完整 HTML
        with open("schedule_page.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("HTML 已保存: schedule_page.html")

        # 2. 分析页面中的 JS 变量和数据
        import re

        # 查找所有 var xxx = 的 JS 变量
        js_vars = re.findall(r"var\s+(\w+)\s*=\s*(.{1,200})", html)
        print(f"\n=== JS 变量 ({len(js_vars)} 个) ===")
        for name, val in js_vars:
            print(f"  var {name} = {val[:120]}...")

        # 查找 table 标签
        tables = re.findall(r"<table[^>]*>", html)
        print(f"\n=== 表格 ({len(tables)} 个) ===")
        for i, t in enumerate(tables):
            print(f"  [{i}] {t[:120]}")

        # 查找包含课程关键词的文本块
        keywords = ["深度学习", "数据可视化", "形势与政策", "IT企业实训", "软件项目"]
        for kw in keywords:
            idx = html.find(kw)
            if idx >= 0:
                context = html[max(0, idx - 200):idx + 200]
                # 简化显示
                context = re.sub(r"\s+", " ", context)
                print(f"\n--- '{kw}' 上下文 ---")
                print(f"  ...{context}...")

        # 3. 也获取 AJAX 数据看看完整结构
        ajax_resp = await client.get(
            f"{JWC_BASE}/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        if ajax_resp.status_code == 200 and "json" in ajax_resp.headers.get("content-type", ""):
            data = ajax_resp.json()
            with open("schedule_ajax_debug.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"\n=== AJAX 数据 ===")
            print(f"顶层 keys: {list(data.keys())}")
            for k, v in data.items():
                if isinstance(v, list):
                    print(f"  {k}: list[{len(v)}]")
                    if v:
                        first = v[0]
                        if isinstance(first, dict):
                            print(f"    [0] keys: {list(first.keys())}")
                            # 打印第一项完整内容
                            print(f"    [0] = {json.dumps(first, ensure_ascii=False)[:500]}")
                elif isinstance(v, dict):
                    print(f"  {k}: dict, keys={list(v.keys())[:10]}")
                else:
                    print(f"  {k}: {type(v).__name__} = {str(v)[:100]}")
        else:
            print(f"\nAJAX 失败: {ajax_resp.status_code}")


if __name__ == "__main__":
    asyncio.run(main())
