"""OPAC 系统爬虫服务

通过 Playwright 访问四川大学图书馆 OPAC 系统，支持完整的图书检索与分页。
OPAC 系统返回纯图书数据（非 Primo 的多资源混合），每页 20 条结果。
"""

import asyncio
import logging
import re
from urllib.parse import quote

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from services.library.schemas import BookItem, BookSearchResult

logger = logging.getLogger(__name__)

OPAC_BASE = "http://opac.scu.edu.cn:8080"
SSO_URL = f"{OPAC_BASE}/F?func=file&file_name=find-b&local_base=SCU01&pds_handle=GUEST"

_browser: Browser | None = None
_context: BrowserContext | None = None
_session_base: str | None = None
_browser_lock = asyncio.Lock()


async def _get_context() -> tuple[BrowserContext, str]:
    """获取或创建 OPAC 浏览器上下文（保持会话）"""
    global _browser, _context, _session_base

    async with _browser_lock:
        if _context and _session_base:
            return _context, _session_base

        logger.info("初始化 OPAC 浏览器会话...")
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
        _context = await _browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        page = await _context.new_page()
        page.set_default_timeout(30000)

        try:
            await page.goto(SSO_URL, wait_until="networkidle", timeout=30000)
            current_url = page.url
            logger.info(f"OPAC SSO 完成: {current_url[:120]}")

            match = re.match(rf"({re.escape(OPAC_BASE)}/F/[A-Z0-9]+)", current_url)
            if match:
                _session_base = match.group(1)
                logger.info(f"OPAC 会话已建立: {_session_base}")
            else:
                raise RuntimeError(f"无法解析 OPAC 会话 URL: {current_url}")

        except Exception as e:
            logger.error(f"OPAC 会话建立失败: {e}")
            raise
        finally:
            await page.close()

        return _context, _session_base


EXTRACT_BOOKS_JS = """() => {
    const tables = document.querySelectorAll('table');
    const books = [];

    for (let i = 0; i < tables.length; i++) {
        const t = tables[i];
        const trs = t.querySelectorAll('tr');
        if (trs.length < 2) continue;

        const firstRow = trs[0];
        const cells = firstRow.cells;
        if (!cells || cells.length < 2) continue;

        const c0 = cells[0];
        const c0text = (c0.textContent || '').trim();
        if (!/^\\d+$/.test(c0text)) continue;

        const c1 = cells[1];
        const titleDiv = c1.querySelector('div.itemtitle');
        if (!titleDiv) continue;
        const titleLink = titleDiv.querySelector('a');
        const title = (titleLink || titleDiv).textContent.replace(/[\\s\\n]+/g, ' ').trim();

        if (!title) continue;

        const fullText = c1.textContent || '';

        // Extract ISBN
        let isbn = '';
        const isbnMatch = fullText.match(/fmt_issn\\s*\\(?"?([^")]*)"?\\)/);
        if (isbnMatch) isbn = isbnMatch[1].trim();

        // Find the detail section: after "fmt_issn)" or after title, before "馆藏地"
        const detailStart = fullText.indexOf('fmt_issn');
        let detailText = '';
        if (detailStart >= 0) {
            const afterIsbn = fullText.substring(detailStart);
            const closeParen = afterIsbn.indexOf(')');
            detailText = closeParen >= 0 ? afterIsbn.substring(closeParen + 1) : afterIsbn;
        } else {
            detailText = fullText;
        }

        // Split into detail part and holdings part
        const holdingsIdx = detailText.indexOf('馆藏地');
        let detailPart = holdingsIdx >= 0 ? detailText.substring(0, holdingsIdx) : detailText;
        let holdingsPart = holdingsIdx >= 0 ? detailText.substring(holdingsIdx) : '';

        // Parse detail labels
        const labels = ['作者', '索书号', '出版社', '年份', '格式'];
        const fieldValues = { '作者': '', '索书号': '', '出版社': '', '年份': '', '格式': '' };

        for (let li = 0; li < labels.length; li++) {
            const label = labels[li];
            const labelIdx = detailPart.indexOf(label + '\\uFF1A');
            if (labelIdx < 0) continue;

            const valueStart = labelIdx + label.length + 1;
            let valueEnd = detailPart.length;

            if (li + 1 < labels.length) {
                const nextLabel = labels[li + 1];
                const nextIdx = detailPart.indexOf(nextLabel + '\\uFF1A', valueStart);
                if (nextIdx >= 0) valueEnd = nextIdx;
            }

            let value = detailPart.substring(valueStart, valueEnd).trim();
            value = value.replace(/[\\s\\n]+/g, ' ').trim();
            fieldValues[label] = value;
        }

        // Parse holdings - handle multiple holdings entries
        let location = '', callNumber = '';
        let totalAvailAvailable = 0, totalAvailTotal = 0;
        let hasHoldings = false;

        if (holdingsPart) {
            const headerEnd = holdingsPart.indexOf('\\n');
            const dataPart = headerEnd >= 0 ? holdingsPart.substring(headerEnd + 1).trim() : '';

            if (dataPart) {
                // Split multiple holdings by newline
                const lines = dataPart.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

                for (const line of lines) {
                    // Match: LocationCallNumber//[year]  X/  Y
                    // Or:    LocationCallNumber//  X/  Y
                    // The avail pattern at end: spaces, digits, spaces, /, spaces, digits
                    const availRe = line.match(/\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*$/);
                    if (!availRe) continue;

                    hasHoldings = true;
                    const availAvailable = parseInt(availRe[1]);
                    const availTotal = parseInt(availRe[2]);
                    totalAvailAvailable += availAvailable;
                    totalAvailTotal += availTotal;

                    // Everything before the avail pattern
                    const idx = line.indexOf(availRe[0]);
                    const locAndCall = line.substring(0, idx).trim();

                    if (locAndCall && !location) {
                        // For the first holding, extract location and call number
                        // Strip //[year] suffix
                        let cleanLocAndCall = locAndCall.replace(/\\/\\/.*$/, '').trim();
                        // Strip trailing year like [2025]
                        cleanLocAndCall = cleanLocAndCall.replace(/\\[\\d{4}\\]\\s*$/, '').trim();

                        const cnMatch = cleanLocAndCall.match(/[A-Za-z0-9].+$/);
                        if (cnMatch) {
                            callNumber = cnMatch[0].trim();
                            const locEnd = cleanLocAndCall.indexOf(cnMatch[0]);
                            location = locEnd > 0 ? cleanLocAndCall.substring(0, locEnd).trim() : '';
                        } else {
                            location = cleanLocAndCall;
                        }
                    }
                }
            }
        }

        // Use callNumber from detail if holdings doesn't have one
        if (!callNumber && fieldValues['索书号']) {
            let cn = fieldValues['索书号'];
            cn = cn.replace(/\\/\\/.*$/, '').trim();
            cn = cn.replace(/\\[\\d{4}\\]\\s*$/, '').trim();
            callNumber = cn;
        }

        // Clean up callNumber from detail section too (remove // suffix)
        if (callNumber) {
            callNumber = callNumber.replace(/\\/\\/.*$/, '').trim();
            callNumber = callNumber.replace(/\\[\\d{4}\\]\\s*$/, '').trim();
        }

        // Determine status
        let status = '借出';
        let available = false;
        if (hasHoldings) {
            available = totalAvailAvailable > 0;
            if (totalAvailTotal > 0 && totalAvailAvailable >= totalAvailTotal) {
                status = '在馆';
            } else if (totalAvailAvailable > 0) {
                status = '部分在馆';
            }
        }

        // Filter year - only keep if it's a valid year (4 digits)
        let year = fieldValues['年份'] || '';
        if (year && !/^\\d{4}$/.test(year)) {
            year = '';
        }

        books.push({
            title: title,
            author: fieldValues['作者'],
            publisher: fieldValues['出版社'],
            isbn: isbn,
            callNumber: callNumber || '',
            location: location,
            status: status,
            available: available,
            year: year,
        });
    }

    return books;
}"""

EXTRACT_TOTAL_JS = """() => {
    const body = document.body.textContent || '';
    // Pattern: "记录         1 -       20 of      7396"
    const m1 = body.match(/记录\\s*\\d+\\s*-\\s*\\d+\\s*of\\s*([\\d,]+)/);
    if (m1) return m1[1].replace(/,/g, '');

    // Other patterns
    const patterns = [
        /找到\\s*([\\d,]+)\\s*条/,
        /共\\s*([\\d,]+)\\s*条/,
        /检索到\\s*([\\d,]+)\\s*个/,
    ];
    for (const p of patterns) {
        const m = body.match(p);
        if (m) return m[1].replace(/,/g, '');
    }
    return null;
}"""

EXTRACT_CURRENT_PAGE_JS = """() => {
    const body = document.body.textContent || '';
    // Get current page from nav: prnnavigate(parseInt("7396"), CURRENT, 20, "...")
    const navMatch = body.match(/prnnavigate\\s*\\(\\s*parseInt\\s*\\(\\s*"[\\s,]*\\d+"\\s*\\)\\s*,\\s*(\\d+)\\s*,/);
    if (navMatch) return parseInt(navMatch[1]);

    // Pattern: "第 X / Y 页"
    const m = body.match(/第\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*页/);
    if (m) return parseInt(m[1]);

    return 1;
}"""


async def _collect_books_from_page(page: Page) -> list[dict]:
    """从当前页面提取图书数据"""
    return await page.evaluate(EXTRACT_BOOKS_JS)


async def _get_total_count(page: Page) -> int:
    """获取总结果数"""
    total_str = await page.evaluate(EXTRACT_TOTAL_JS)
    if total_str:
        try:
            return int(total_str)
        except ValueError:
            pass
    return 0


async def _get_current_page(page: Page) -> int:
    """获取当前页码"""
    return await page.evaluate(EXTRACT_CURRENT_PAGE_JS)


async def _get_total_pages(page: Page) -> int:
    """从页面获取总页数"""
    total_count = await _get_total_count(page)
    if total_count > 0:
        return (total_count + 19) // 20  # ceil division

    body = await page.evaluate("() => document.body.textContent || ''")
    # Try extracting from the nav element
    m = re.search(r'prnnavigate\s*\(\s*parseInt\s*\(\s*"[\s,]*(\d+)"\s*\)\s*,\s*(\d+)\s*,\s*(\d+)\s*,', body)
    if m:
        total_results = int(m.group(1))
        return (total_results + 19) // 20
    return 1


async def search_books(keyword: str, page_num: int = 1) -> BookSearchResult:
    """从 OPAC 检索图书

    Args:
        keyword: 检索关键词
        page_num: 页码（从 1 开始）
    """
    logger.info(f"OPAC 检索图书: keyword={keyword}, page={page_num}")

    try:
        context, session_base = await _get_context()
        page = await context.new_page()
        page.set_default_timeout(30000)

        try:
            # Always do the search first
            await page.goto(f"{session_base}?func=file&file_name=find-b&local_base=SCU01&pds_handle=GUEST",
                            wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1000)

            await page.evaluate(f"""() => {{
                const inputs = document.querySelectorAll('input[name="request"]');
                if (inputs.length > 0) {{
                    inputs[0].value = '{keyword}';
                    const forms = document.forms;
                    if (forms.length > 0) forms[0].submit();
                }}
            }}""")
            await page.wait_for_timeout(3000)

            # If not page 1, navigate to the target page
            # OPAC pagination uses ?func=short-jump&jump=N where N = (page-1)*20+1
            if page_num > 1:
                jump = (page_num - 1) * 20 + 1
                target_url = f"{page.url.split('?')[0]}?func=short-jump&jump={jump}"
                logger.info(f"  跳转到第 {page_num} 页: jump={jump}")

                await page.goto(target_url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(2000)

            # Extract data
            books_data = await _collect_books_from_page(page)
            total_count = await _get_total_count(page)
            total_pages = await _get_total_pages(page)

            logger.info(f"  OPAC 第 {page_num} 页: 提取到 {len(books_data)} 本图书, "
                        f"共 {total_count} 条结果, 总页数 {total_pages}")

            books: list[BookItem] = []
            for item in books_data:
                books.append(BookItem(
                    title=item["title"],
                    author=item["author"],
                    publisher=item["publisher"],
                    isbn=item.get("isbn", ""),
                    call_number=item.get("callNumber", ""),
                    location=item.get("location", ""),
                    status=item.get("status", ""),
                    available=item.get("available", False),
                    year=item.get("year", ""),
                ))

            result = BookSearchResult(
                keyword=keyword,
                total=len(books),
                books=books,
                page=page_num,
                page_size=20,
                total_count=total_count,
            )
            logger.info(f"OPAC 检索成功: 第 {page_num} 页, 返回 {result.total} 条, 共 {total_count} 条")
            return result

        except Exception as e:
            logger.warning(f"OPAC 页面处理失败: {e}")
            raise
        finally:
            await page.close()

    except Exception as e:
        logger.warning(f"OPAC 检索失败: {e}")
        raise


async def get_session() -> tuple[BrowserContext, str] | None:
    """获取当前的 OPAC 浏览器上下文和会话基础 URL"""
    global _context, _session_base
    if _context and _session_base:
        return _context, _session_base
    return None


async def cleanup():
    """清理浏览器资源"""
    global _browser, _context, _session_base
    if _browser and _browser.is_connected():
        await _browser.close()
    _browser = None
    _context = None
    _session_base = None
    logger.info("OPAC browser 已关闭")