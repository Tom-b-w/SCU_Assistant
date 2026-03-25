"""
用 Playwright 抓取教务系统课表页面，截图 + 提取渲染后的表格数据。
"""
import asyncio
import json
import sys

import redis.asyncio as aioredis
from playwright.async_api import async_playwright

JWC_BASE = "http://zhjw.scu.edu.cn"
SCHEDULE_URL = f"{JWC_BASE}/student/courseSelect/thisSemesterCurriculum/index"


async def main():
    # 1. 从 Redis 取 session
    r = aioredis.from_url("redis://localhost:6379/0")
    session_value = await r.get("jwc_auth:2023141461122")
    await r.aclose()

    if not session_value:
        print("ERROR: session 不存在，请先登录")
        sys.exit(1)

    cookie_val = session_value.decode("utf-8") if isinstance(session_value, bytes) else session_value
    print(f"Session: {cookie_val[:20]}...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()

        # 注入 cookie
        await context.add_cookies([{
            "name": "student.urpSoft.cn",
            "value": cookie_val,
            "domain": "zhjw.scu.edu.cn",
            "path": "/",
        }])

        page = await context.new_page()

        # 捕获 AJAX
        ajax_responses = []
        async def on_response(resp):
            if "thisSemesterCurriculum" in resp.url and "callback" in resp.url:
                try:
                    body = await resp.json()
                    ajax_responses.append({"url": resp.url, "data": body})
                except:
                    pass
        page.on("response", on_response)

        print(f"访问: {SCHEDULE_URL}")
        await page.goto(SCHEDULE_URL, wait_until="networkidle", timeout=30000)

        final_url = page.url
        print(f"最终URL: {final_url}")
        if "login" in final_url:
            print("ERROR: session 过期")
            await browser.close()
            sys.exit(1)

        await page.wait_for_timeout(3000)

        # 截图
        await page.screenshot(path="schedule_screenshot.png", full_page=True)
        print("截图: schedule_screenshot.png")

        # 提取页面上渲染的课表格数据
        schedule_data = await page.evaluate("""
        () => {
            const result = {
                grid_courses: [],
                list_courses: [],
                all_text: [],
                tables: [],
            };

            // 提取课表格中的课程块（通常是 div 或 td 中的彩色块）
            // 先找主课表 table
            const tables = document.querySelectorAll('table');
            tables.forEach((table, tidx) => {
                const rows = [];
                table.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td, th').forEach(cell => {
                        const text = cell.innerText.trim();
                        const html = cell.innerHTML;
                        cells.push({text, hasContent: text.length > 0, html: html.substring(0, 200)});
                    });
                    rows.push(cells);
                });
                result.tables.push({index: tidx, rowCount: rows.length, rows: rows.slice(0, 20)});
            });

            // 查找包含课程信息的元素
            document.querySelectorAll('.course-item, .schedule-item, [class*="course"], [class*="kc"]').forEach(el => {
                result.grid_courses.push(el.innerText.trim());
            });

            // 查找所有带课程名的文本
            const bodyText = document.body.innerText;
            const courseKeywords = ['深度学习', '数据可视化', '形势与政策', 'IT企业实训', '软件项目'];
            courseKeywords.forEach(kw => {
                const idx = bodyText.indexOf(kw);
                if (idx >= 0) {
                    result.all_text.push(bodyText.substring(Math.max(0, idx-50), idx+100));
                }
            });

            return result;
        }
        """)

        print(f"\n=== 页面分析 ===")
        print(f"表格数: {len(schedule_data['tables'])}")
        for t in schedule_data["tables"]:
            print(f"\n--- 表格 {t['index']+1} ({t['rowCount']} 行) ---")
            for i, row in enumerate(t["rows"][:8]):
                texts = [c["text"][:30] for c in row if c["text"]]
                if texts:
                    print(f"  行{i}: {' | '.join(texts)}")

        if schedule_data["grid_courses"]:
            print(f"\n课程元素: {schedule_data['grid_courses']}")

        if schedule_data["all_text"]:
            print(f"\n课程文本:")
            for t in schedule_data["all_text"]:
                print(f"  {t}")

        # AJAX 数据
        if ajax_responses:
            print(f"\n=== AJAX 数据 ({len(ajax_responses)} 个) ===")
            for resp in ajax_responses:
                data = resp["data"]
                with open("schedule_ajax.json", "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"已保存: schedule_ajax.json")
                if isinstance(data, dict):
                    print(f"Keys: {list(data.keys())}")
                    # 检查 xkxx
                    xkxx = data.get("xkxx", [])
                    if isinstance(xkxx, list):
                        print(f"xkxx: {len(xkxx)} 门课")
                        for item in xkxx:
                            if isinstance(item, dict):
                                for k, v in item.items():
                                    if isinstance(v, dict):
                                        print(f"  {v.get('courseName','')} | dgFlag={v.get('dgFlag','')} | {v.get('attendClassTeacher','')}")

        print("\n10 秒后关闭...")
        await page.wait_for_timeout(10000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
