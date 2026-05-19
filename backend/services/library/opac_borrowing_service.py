"""OPAC 个人借阅数据爬取服务

通过已认证的 OPAC 会话，从 func=bor-info 页面获取个人借阅数据。
"""

import logging
import re
from datetime import date, datetime

from playwright.async_api import BrowserContext, Page

from services.library.schemas import BorrowedBook

logger = logging.getLogger(__name__)


class OPACBorrowingError(Exception):
    """OPAC 借阅数据获取错误"""
    pass


# JavaScript 提取当前借阅数据
EXTRACT_BORROWED_BOOKS_JS = """() => {
    const tables = document.querySelectorAll('table');
    const books = [];
    
    // 查找借阅表格
    for (let ti = 0; ti < tables.length; ti++) {
        const table = tables[ti];
        const text = (table.textContent || '').trim();
        
        // 跳过太小的表格（纯导航/装饰表格）
        if (text.length < 50) continue;
        
        // 检查是否包含借阅相关的表头
        const headerRow = table.querySelector('tr');
        if (!headerRow) continue;
        
        const headerText = (headerRow.textContent || '').trim();
        
        // 检测是否是借阅表格（包含这些关键词）
        const borrowKeywords = ['题名', '著者', '作者', '索书号', '借阅日期', '应还日期', '续借'];
        const hasBorrowHeader = borrowKeywords.some(k => headerText.includes(k));
        
        if (!hasBorrowHeader) continue;
        
        // 遍历数据行（跳过表头行）
        const rows = table.querySelectorAll('tr');
        for (let ri = 1; ri < rows.length; ri++) {
            const row = rows[ri];
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;
            
            // 获取整行文本
            const rowText = (row.textContent || '').trim();
            
            // 提取各字段
            let title = '';
            let author = '';
            let callNumber = '';
            let borrowDate = '';
            let dueDate = '';
            let renewCount = 0;
            let location = '';
            let barcode = '';
            
            // 方式1: 按单元格顺序提取
            const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
            
            // 查找标题（通常是第一个包含较长文本的单元格）
            for (let ci = 0; ci < cellTexts.length; ci++) {
                const ct = cellTexts[ci];
                if (!ct) continue;
                
                // 尝试匹配日期 YYYY-MM-DD 或 YYYY/MM/DD
                const dateMatch = ct.match(/(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
                
                if (dateMatch) {
                    // 这个单元格包含日期
                    if (!borrowDate) {
                        borrowDate = ct;
                    } else if (!dueDate) {
                        dueDate = ct;
                    }
                }
                
                // 匹配续借次数
                const renewMatch = ct.match(/^(\\d+)$/);
                if (renewMatch) {
                    renewCount = parseInt(renewMatch[1]);
                }
                
                // 匹配索书号模式（字母+数字）
                const cnMatch = ct.match(/^[A-Za-z][A-Za-z0-9.\\-=/]+\\d/);
                if (cnMatch && !callNumber && ct.length > 3 && ct.length < 30) {
                    callNumber = ct;
                }
            }
            
            // 方式2: 从行文本中用正则提取
            if (!title) {
                // 综合提取
                const allText = rowText;
                
                // 尝试从链接中提取标题
                const link = row.querySelector('a');
                if (link) {
                    title = (link.textContent || '').trim();
                }
                
                if (!title) {
                    // 取行文本的第一段（通常是标题）
                    const lines = allText.split('\\n').map(l => l.trim()).filter(l => l);
                    if (lines.length > 0) {
                        // 第一个非空且较长的行作为标题
                        for (const line of lines) {
                            if (line.length > 4 && !line.match(/^[\\d\\s]+$/)) {
                                title = line;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (!title) continue;
            
            // 计算日期
            // 尝试标准化日期
            if (borrowDate) {
                const m = borrowDate.match(/(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
                if (m) borrowDate = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
            }
            if (dueDate) {
                const m = dueDate.match(/(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
                if (m) dueDate = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
            }
            
            books.push({
                title: title,
                author: author,
                callNumber: callNumber,
                barcode: barcode,
                borrowDate: borrowDate,
                dueDate: dueDate,
                renewCount: renewCount,
                location: location,
            });
        }
        
        // 如果找到了书籍数据，就不继续查找其他表格
        if (books.length > 0) break;
    }
    
    return books;
}"""

# 备用提取方式：从纯文本中解析
EXTRACT_BORROWED_TEXT_JS = """() => {
    const body = document.body.innerText || '';
    const lines = body.split('\\n').map(l => l.trim()).filter(l => l);
    
    const books = [];
    let inTable = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测表头区域
        if (line.includes('当前借阅') || line.includes('借出') || (line.includes('题名') && line.includes('索书号'))) {
            inTable = true;
            continue;
        }
        
        if (inTable && line.includes('页') && line.match(/\\d+/)) {
            // 翻页链接，不是数据
            continue;
        }
        
        if (inTable && line.length > 10) {
            // 可能是数据行
            const dates = line.match(/\\d{4}[-\\/]\\d{1,2}[-\\/]\\d{1,2}/g);
            if (dates && dates.length >= 2) {
                books.push({
                    rawText: line.substring(0, 200),
                    dates: dates,
                });
            }
        }
    }
    
    return books;
}"""


async def fetch_borrowing_data(context: BrowserContext, session_base: str) -> list[BorrowedBook]:
    """从 OPAC 获取当前借阅数据
    
    Args:
        context: 已认证的 Playwright 浏览器上下文
        session_base: OPAC 会话基础 URL
        
    Returns:
        借阅图书列表
    """
    logger.info("从 OPAC 获取个人借阅数据")
    
    page = await context.new_page()
    page.set_default_timeout(30000)
    
    try:
        # 访问我的图书馆页面
        bor_info_url = f"{session_base}?func=bor-info"
        logger.info(f"  访问: {bor_info_url[:100]}")
        
        await page.goto(bor_info_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        
        # 检查是否被重定向到登录页
        current_url = page.url
        if 'func=login-session' in current_url or 'func=login' in current_url:
            raise OPACBorrowingError("会话未认证，需要先登录")
        
        # 获取页面原始 HTML 用于调试
        page_html = await page.content()
        logger.info(f"  当前 URL: {current_url[:120]}")
        logger.info(f"  页面 HTML 长度: {len(page_html)}")
        
        # 尝试用 JS 提取数据
        books_data = await page.evaluate(EXTRACT_BORROWED_BOOKS_JS)
        
        if not books_data:
            # 备用提取方式
            logger.info("  标准提取未找到数据，尝试备用方式...")
            text_data = await page.evaluate(EXTRACT_BORROWED_TEXT_JS)
            if text_data:
                logger.info(f"  备用方式找到 {len(text_data)} 行可能的借阅数据")
                # 记录原始数据用于调试
                for item in text_data[:3]:
                    logger.info(f"    原始: {item['rawText'][:100]}")
            
            # 如果还是没有数据，记录页面结构用于调试
            page_structure = await page.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                const info = [];
                for (let i = 0; i < tables.length; i++) {
                    const t = tables[i];
                    const rows = t.querySelectorAll('tr');
                    info.push({
                        index: i,
                        rows: rows.length,
                        cols: rows[0] ? rows[0].cells.length : 0,
                        text: (t.textContent || '').trim().substring(0, 150)
                    });
                }
                return info.slice(0, 20);
            }""")
            
            logger.info(f"  页面表格结构 ({len(page_structure)} tables):")
            for ps in page_structure[:10]:
                logger.info(f"    Table {ps['index']}: {ps['rows']}行x{ps['cols']}列 = {ps['text'][:80]}")
        
        # 转换为 BorrowedBook 对象
        today = date.today()
        books: list[BorrowedBook] = []
        
        for item in books_data:
            borrow_date_str = item.get('borrowDate', '')
            due_date_str = item.get('dueDate', '')
            
            # 计算天数
            days_remaining = 0
            is_overdue = False
            overdue_days = 0
            
            if due_date_str:
                try:
                    # 解析日期
                    due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
                    delta = (due_date - today).days
                    days_remaining = delta if delta >= 0 else -delta
                    is_overdue = delta < 0
                    overdue_days = -delta if delta < 0 else 0
                except ValueError:
                    pass
            
            books.append(BorrowedBook(
                title=item.get('title', ''),
                author=item.get('author', ''),
                call_number=item.get('callNumber', ''),
                borrow_date=borrow_date_str,
                due_date=due_date_str,
                renew_count=item.get('renewCount', 0),
                days_remaining=days_remaining,
                is_overdue=is_overdue,
                overdue_days=overdue_days,
            ))
        
        logger.info(f"  提取到 {len(books)} 本借阅图书")
        return books
        
    except OPACBorrowingError:
        raise
    except Exception as e:
        logger.error(f"  获取借阅数据失败: {e}")
        raise OPACBorrowingError(f"获取借阅数据失败: {e}")
    finally:
        await page.close()