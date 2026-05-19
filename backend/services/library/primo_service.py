"""Primo (明远搜索) 爬虫服务

通过 Playwright 渲染 Primo SPA 页面，使用 JavaScript 直接提取 DOM 数据。
可作为 OPAC 系统在校园网外的替代数据源。
"""

import asyncio
import logging

from playwright.async_api import async_playwright, Browser

from services.library.schemas import BookItem, BookSearchResult

logger = logging.getLogger(__name__)

PRIMO_BASE_URL = "https://scu-primo.hosted.exlibrisgroup.com.cn"
PRIMO_SEARCH_URL = (
    f"{PRIMO_BASE_URL}/primo-explore/search"
    "?query=any,contains,{keyword}"
    "&vid=scu2&lang=zh_CN"
    "&tab=all_tab&search_scope=all_resource"
    "&sortby=rank"
)

EXTRACT_JS = """() => {
    const results = [];
    const containers = document.querySelectorAll('prm-brief-result-container');

    containers.forEach((container) => {
        const text = container.textContent || '';

        if (!text.includes('图书')) return;

        let title = '';
        const checkbox = container.querySelector('md-checkbox');
        if (checkbox) {
            const label = checkbox.getAttribute('aria-label') || '';
            title = label.replace('选择记录', '').trim();
        }

        if (!title) {
            const links = container.querySelectorAll('a');
            for (let i = links.length - 1; i >= 0; i--) {
                const href = links[i].getAttribute('href') || '';
                if (href.includes('fulldisplay')) {
                    title = links[i].textContent.trim();
                    if (title) break;
                }
            }
        }

        const pubMatch = text.match(/([\\u4e00-\\u9fff]{2,4}\\s*:\\s*[\\u4e00-\\u9fff]{2,8}(?:出版社|书店|公司))/);
        const publisher = pubMatch ? pubMatch[1] : '';

        let author = '';
        if (title) {
            const titleEnd = text.indexOf(title) + title.length;
            if (publisher) {
                const pubStart = text.indexOf(publisher);
                if (titleEnd > 0 && pubStart > titleEnd) {
                    author = text.substring(titleEnd, pubStart).trim();
                }
            } else {
                const yearMatch = text.substring(titleEnd).match(/,\\s*(\\d{4})/);
                if (yearMatch) {
                    const yearStart = text.indexOf(yearMatch[0], titleEnd);
                    author = text.substring(titleEnd, yearStart).trim();
                }
            }
            if (author) {
                author = author
                    .replace(/,/g, '')
                    .replace(/\\s+/g, ' ')
                    .trim()
                    .split('\\n').map(l => l.trim()).filter(l => l).join('; ');
            }
        }

        let status = '', location = '', callNumber = '';

        const cnPattern = /\\(([A-Z]{1,3}\\d[\\d\\/.\\w\\[\\]\\-\\s]*)\\)/g;
        let cnMatch;
        while ((cnMatch = cnPattern.exec(text)) !== null) {
            const value = cnMatch[1].trim();
            if (value.length > 3 && /[A-Z]/.test(value[0])) {
                callNumber = value;
            }
        }

        if (text.includes('在架')) {
            status = '在架';
        } else if (text.includes('借出')) {
            status = '借出';
        }

        if (status) {
            const statusIdx = text.indexOf(status) + status.length;
            const afterStatus = text.substring(statusIdx, statusIdx + 30);
            const libMatch = afterStatus.match(/([\\u4e00-\\u9fff]{2,4}馆)/);
            if (libMatch) location = libMatch[1];
        }

        results.push({
            title: title || '',
            author: author || '',
            publisher: publisher || '',
            location: location || '',
            callNumber: callNumber || '',
            status: status || '',
        });
    });

    return results;
}"""

_browser: Browser | None = None
_browser_lock = asyncio.Lock()


async def _get_browser() -> Browser:
    global _browser
    if _browser is None or not _browser.is_connected():
        async with _browser_lock:
            if _browser is None or not _browser.is_connected():
                p = await async_playwright().start()
                _browser = await p.chromium.launch(
                    channel="msedge",
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                )
    return _browser


async def _collect_books_from_pages(page, max_results: int = 20) -> list[dict]:
    """遍历 Primo 搜索结果页，收集图书数据"""
    all_books: list[dict] = []
    max_pages = 3

    for page_num in range(1, max_pages + 1):
        if page_num > 1:
            clicked = await page.evaluate(f"""() => {{
                const links = document.querySelectorAll('a, button');
                for (const el of links) {{
                    if ((el.textContent || '').trim() === '{page_num}' && el.offsetParent !== null) {{
                        el.click();
                        return true;
                    }}
                }}
                return false;
            }}""")
            if not clicked:
                logger.info(f"  无法翻到第 {page_num} 页，停止翻页")
                break
            await page.wait_for_timeout(3000)

        data = await page.evaluate(EXTRACT_JS)
        logger.info(f"  第 {page_num} 页: 提取到 {len(data)} 本图书")

        for item in data:
            all_books.append(item)
            if len(all_books) >= max_results:
                return all_books

    return all_books


async def search_books(keyword: str, max_results: int = 20) -> BookSearchResult:
    """从 Primo 明远搜索检索图书"""
    logger.info(f"Primo 检索图书: {keyword}")

    try:
        browser = await _get_browser()
        page = await browser.new_page()
        page.set_default_timeout(90000)

        try:
            url = PRIMO_SEARCH_URL.format(keyword=keyword)
            logger.info(f"Primo URL: {url}")

            await page.goto(url, wait_until="load", timeout=90000)
            await page.wait_for_timeout(3000)

            data = await _collect_books_from_pages(page, max_results)

            books: list[BookItem] = []
            for item in data[:max_results]:
                book = BookItem(
                    title=item["title"],
                    author=item["author"],
                    publisher=item["publisher"],
                    isbn="",
                    call_number=item["callNumber"],
                    location=item["location"],
                    status=item["status"],
                    available=item["status"] == "在架",
                )
                books.append(book)

            result = BookSearchResult(
                keyword=keyword,
                total=len(books),
                books=books,
            )
            logger.info(f"Primo 检索成功: 共 {result.total} 条结果")
            return result

        except Exception as e:
            logger.warning(f"Primo 页面处理失败: {e}")
            raise

        finally:
            await page.close()

    except Exception as e:
        logger.warning(f"Primo 检索失败: {e}")
        raise


async def cleanup():
    """清理浏览器资源"""
    global _browser
    if _browser and _browser.is_connected():
        await _browser.close()
        _browser = None
        logger.info("Primo browser 已关闭")