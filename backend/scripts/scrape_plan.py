"""
用 Playwright 抓取教务系统培养方案完成情况。
注入 session cookie 后访问页面，用 JS 在页面内提取数据。

用法: python scripts/scrape_plan.py
"""
import asyncio
import json
import sys

import redis.asyncio as aioredis
from playwright.async_api import async_playwright

JWC_BASE = "http://zhjw.scu.edu.cn"
PLAN_URL = f"{JWC_BASE}/student/integratedQuery/planCompletion/index"


async def main():
    # 1. 从 Redis 取 session
    r = aioredis.from_url("redis://localhost:6379/0")
    session_value = await r.get("jwc_auth:2023141461122")
    await r.aclose()

    if not session_value:
        print("ERROR: 教务系统 session 不存在，请先在前端登录")
        sys.exit(1)

    cookie_val = session_value.decode("utf-8") if isinstance(session_value, bytes) else session_value
    print(f"Session: {cookie_val[:20]}...")

    async with async_playwright() as p:
        # 用已安装的 Chromium
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()

        # 注入 session cookie
        await context.add_cookies([{
            "name": "student.urpSoft.cn",
            "value": cookie_val,
            "domain": "zhjw.scu.edu.cn",
            "path": "/",
        }])

        page = await context.new_page()

        # 监听所有网络请求，捕获 AJAX 数据
        ajax_data = {}

        async def handle_response(response):
            url = response.url
            if "planCompletion" in url and "callback" in url:
                try:
                    body = await response.json()
                    ajax_data["plan"] = body
                    print(f"  捕获 AJAX: {url[:80]}...")
                except:
                    pass

        page.on("response", handle_response)

        # 访问培养方案页面
        print(f"访问: {PLAN_URL}")
        resp = await page.goto(PLAN_URL, wait_until="networkidle", timeout=30000)

        final_url = page.url
        print(f"最终URL: {final_url}")

        if "login" in final_url:
            print("ERROR: 被重定向到登录页，session 已过期")
            await browser.close()
            sys.exit(1)

        # 等待页面完全渲染
        await page.wait_for_timeout(3000)

        # 截图
        await page.screenshot(path="plan_screenshot.png", full_page=True)
        print("截图已保存: plan_screenshot.png")

        # 保存 HTML
        html = await page.content()
        with open("plan_page.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"HTML已保存: plan_page.html ({len(html)} 字符)")

        # 用 JS 在页面内提取所有表格数据
        table_data = await page.evaluate("""
        () => {
            const result = {tables: [], text_blocks: []};

            // 提取所有表格
            document.querySelectorAll('table').forEach((table, idx) => {
                const rows = [];
                table.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td, th').forEach(cell => {
                        cells.push(cell.innerText.trim());
                    });
                    if (cells.length > 0) rows.push(cells);
                });
                result.tables.push({index: idx, rows: rows});
            });

            // 提取所有包含"学分"的文本块
            const walker = document.createTreeWalker(
                document.body, NodeFilter.SHOW_TEXT, null, false
            );
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text && (text.includes('学分') || text.includes('必修') || text.includes('选修') || text.includes('毕业'))) {
                    result.text_blocks.push(text);
                }
            }

            return result;
        }
        """)

        print(f"\n=== 页面数据 ===")
        print(f"表格数: {len(table_data['tables'])}")
        for t in table_data["tables"]:
            print(f"\n--- 表格 {t['index']+1} ({len(t['rows'])} 行) ---")
            for row in t["rows"][:15]:
                print(f"  {' | '.join(row)}")
            if len(t["rows"]) > 15:
                print(f"  ... 还有 {len(t['rows'])-15} 行")

        if table_data["text_blocks"]:
            print(f"\n--- 学分相关文本 ({len(table_data['text_blocks'])} 条) ---")
            for text in table_data["text_blocks"][:20]:
                print(f"  {text[:100]}")

        # 检查是否有捕获到 AJAX 数据
        if ajax_data:
            print(f"\n=== AJAX 数据 ===")
            with open("plan_data.json", "w", encoding="utf-8") as f:
                json.dump(ajax_data, f, ensure_ascii=False, indent=2)
            print("AJAX数据已保存: plan_data.json")
            # 打印 keys
            for key, val in ajax_data.items():
                if isinstance(val, dict):
                    print(f"  {key}: keys={list(val.keys())}")
                else:
                    print(f"  {key}: type={type(val).__name__}")

        # 也尝试点击页面上的按钮/链接来触发数据加载
        buttons = await page.query_selector_all("button, a.btn, input[type='button']")
        print(f"\n页面上有 {len(buttons)} 个按钮")
        for btn in buttons[:5]:
            text = await btn.inner_text()
            print(f"  按钮: {text}")

        print("\n浏览器 10 秒后关闭...")
        await page.wait_for_timeout(10000)
        await browser.close()

        # 保存完整结果
        with open("plan_extracted.json", "w", encoding="utf-8") as f:
            json.dump(table_data, f, ensure_ascii=False, indent=2)
        print("提取数据已保存: plan_extracted.json")


if __name__ == "__main__":
    asyncio.run(main())
