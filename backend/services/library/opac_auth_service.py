"""OPAC 用户认证服务

通过 SSO (id.scu.edu.cn) 统一身份认证登录，
登录后 Playwright 浏览器上下文保持认证状态。
"""

import logging

from playwright.async_api import BrowserContext, Page

logger = logging.getLogger(__name__)


class OPACAuthError(Exception):
    """OPAC 认证相关错误"""
    pass


async def login_user(context: BrowserContext, session_base: str, student_id: str, password: str) -> bool:
    """使用学号和密码通过 SSO 登录 OPAC
    
    流程:
    1. 访问 bor-info → 被重定向到 SSO 登录页
    2. 在 SSO 登录页填写学号和密码
    3. 提交 SSO 登录表单
    4. 等待 SSO 验证完成并重定向回 OPAC
    
    Returns:
        登录是否成功
    """
    logger.info(f"OPAC SSO 登录: student_id={student_id}")
    
    page = await context.new_page()
    page.set_default_timeout(60000)
    
    try:
        # 1. 访问 bor-info，触发 SSO 重定向
        bor_info_url = f"{session_base}?func=bor-info"
        logger.info(f"  访问 bor-info (将触发 SSO): {bor_info_url[:100]}")
        
        await page.goto(bor_info_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        
        current_url = page.url
        logger.info(f"  当前 URL: {current_url[:120]}")
        
        # 2. 检查是否被重定向到 SSO 登录页
        if 'id.scu.edu.cn' in current_url:
            logger.info("  检测到 SSO 登录页面，准备登录...")
            
            # 等待 SSO 页面加载
            await page.wait_for_timeout(2000)
            
            # 尝试多种可能的 SSO 登录表单字段
            # 四川大学 SSO 通常使用以下字段名之一
            sso_logged_in = await _handle_sso_login(page, student_id, password)
            
            if not sso_logged_in:
                raise OPACAuthError("SSO 登录失败")
            
            # 等待 SSO 验证完成后重定向回 OPAC
            logger.info("  SSO 登录成功，等待重定向回 OPAC...")
            await page.wait_for_timeout(5000)
            
            # 等待页面稳定
            for _ in range(10):
                await page.wait_for_timeout(2000)
                current_url = page.url
                logger.info(f"  当前 URL: {current_url[:120]}")
                
                if 'func=bor-info' in current_url and 'id.scu.edu.cn' not in current_url:
                    logger.info("  已成功重定向回 OPAC bor-info!")
                    return True
                
                if 'id.scu.edu.cn' in current_url:
                    continue
            
            # 超时后检查当前状态
            current_url = page.url
            logger.warning(f"  重定向超时，当前 URL: {current_url[:100]}")
            
            if 'func=bor-info' in current_url:
                return True
            
            # 尝试直接导航回 bor-info
            logger.info("  尝试直接导航回 bor-info...")
            await page.goto(bor_info_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            
            current_url = page.url
            if 'func=bor-info' in current_url:
                logger.info("  导航回 bor-info 成功")
                return True
            
            raise OPACAuthError("SSO 登录后无法访问 bor-info")
            
        elif 'func=bor-info' in current_url:
            # 已经在 bor-info 页面，无需登录
            logger.info("  已在 bor-info 页面，无需登录")
            return True
        else:
            logger.warning(f"  无法识别的跳转: {current_url[:100]}")
            raise OPACAuthError(f"无法跳转到 SSO 登录页: {current_url[:80]}")
        
    except OPACAuthError:
        raise
    except Exception as e:
        logger.error(f"  SSO 登录过程异常: {e}")
        raise OPACAuthError(f"SSO 登录异常: {e}")
    finally:
        await page.close()


async def _handle_sso_login(page: Page, student_id: str, password: str) -> bool:
    """处理 SSO 登录页面
    
    尝试多种常见的 SSO 表单字段配置
    """
    page_content = await page.content()
    logger.info(f"  SSO 页面 HTML 长度: {len(page_content)}")
    
    # 尝试查找登录表单
    form_found = await page.evaluate("""() => {
        // 查找所有 input 字段
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])'));
        const result = [];
        for (const inp of inputs) {
            if (inp.type === 'password' || inp.name.toLowerCase().includes('pass') || 
                inp.id.toLowerCase().includes('pass') || inp.placeholder?.toLowerCase().includes('密码')) {
                result.push({tag: 'pwd', name: inp.name, id: inp.id, type: inp.type, placeholder: inp.placeholder});
            } else if (inp.type !== 'hidden' && inp.type !== 'submit') {
                result.push({tag: 'input', name: inp.name, id: inp.id, type: inp.type, placeholder: inp.placeholder});
            }
        }
        // 查找提交按钮
        const btns = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'));
        result.push({tag: 'submit_btns', count: btns.length});
        return result;
    }""")
    
    logger.info(f"  SSO 表单字段: {form_found}")
    
    # 尝试一系列可能的用户名/密码字段组合
    username_field = None
    password_field = None
    submit_button = None
    
    # 常见的 SSO 用户名/密码字段名
    username_selectors = [
        'input[name="username"]', 'input[id="username"]', 
        'input[name="j_username"]', 'input[id="j_username"]',
        'input[name="loginName"]', 'input[id="loginName"]',
        'input[name="userName"]', 'input[id="userName"]',
        'input[placeholder*="学号"]', 'input[placeholder*="账号"]',
        'input[placeholder*="用户名"]', 'input[placeholder*="工号"]',
        'input[name="account"]', 'input[id="account"]',
        'input[name="user"]', 'input[id="user"]',
        'input[name="stu_id"]',
    ]
    
    password_selectors = [
        'input[type="password"]',
        'input[name="password"]', 'input[id="password"]',
        'input[name="j_password"]', 'input[id="j_password"]',
        'input[name="passwd"]', 'input[id="passwd"]',
        'input[name="pwd"]', 'input[id="pwd"]',
        'input[placeholder*="密码"]',
    ]
    
    submit_selectors = [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("登录")', 'button:has-text("登 录")',
        'a:has-text("登录")', 'a:has-text("登 录")',
        '#loginBtn', '.login-btn', '.login-button',
        'button[id*="login"]', 'button[class*="login"]',
    ]
    
    # 尝试填充用户名
    for selector in username_selectors:
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(student_id)
                username_field = selector
                logger.info(f"  找到用户名字段: {selector}")
                break
        except:
            continue
    
    if not username_field:
        # 尝试找到第一个非密码的文本输入框
        try:
            el = await page.query_selector('input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="checkbox"])')
            if el:
                await el.fill(student_id)
                logger.info(f"  使用第一个文本输入框作为用户名字段")
        except:
            raise OPACAuthError("无法找到 SSO 用户名字段")
    
    # 尝试填充密码
    for selector in password_selectors:
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(password)
                password_field = selector
                logger.info(f"  找到密码字段: {selector}")
                break
        except:
            continue
    
    if not password_field:
        raise OPACAuthError("无法找到 SSO 密码字段")
    
    await page.wait_for_timeout(1000)
    
    # 尝试点击提交按钮
    for selector in submit_selectors:
        try:
            el = await page.query_selector(selector)
            if el:
                await el.click()
                submit_button = selector
                logger.info(f"  点击提交按钮: {selector}")
                break
        except:
            continue
    
    if not submit_button:
        # 尝试在密码字段按回车
        logger.info("  未找到提交按钮，尝试回车提交...")
        try:
            el = await page.query_selector(password_selectors[0] if password_field else 'input[type="password"]')
            if el:
                await el.press("Enter")
        except:
            raise OPACAuthError("无法找到 SSO 提交按钮")
    
    # 等待登录结果
    await page.wait_for_timeout(5000)
    
    current_url = page.url
    logger.info(f"  SSO 提交后 URL: {current_url[:120] if current_url else 'None'}")
    
    # 检查是否还在 SSO 页面（登录失败）
    if 'id.scu.edu.cn' in current_url:
        # 检查是否有错误信息
        error_text = await page.evaluate("""() => {
            const errEls = document.querySelectorAll('.error, .alert, .message, .tips, [class*="error"], [class*="alert"], font[color="red"]');
            for (const el of errEls) {
                const text = (el.textContent || '').trim();
                if (text) return text.substring(0, 200);
            }
            // 检查页面中常见的错误提示文字
            const body = document.body.innerText || '';
            const lines = body.split('\\n').filter(l => l.includes('错误') || l.includes('失败') || l.includes('不正确') || l.includes('不存在'));
            return lines.join(' | ').substring(0, 200);
        }""")
        if error_text:
            logger.warning(f"  SSO 登录错误: {error_text}")
        raise OPACAuthError(f"SSO 登录失败: {error_text or '请检查学号和密码'}")
    
    # 如果 URL 不再是 SSO 域名，说明登录成功
    logger.info("  SSO 登录提交完成")
    return True


async def check_login_status(context: BrowserContext, session_base: str) -> bool:
    """检查当前会话是否已登录
    
    访问 bor-info 页面，如果未登录会被重定向到 SSO。
    通过检查最终 URL 是否包含 bor-info 来判断。
    """
    page = await context.new_page()
    page.set_default_timeout(20000)
    
    try:
        await page.goto(f"{session_base}?func=bor-info", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(3000)
        current_url = page.url
        is_logged_in = 'func=bor-info' in current_url and 'id.scu.edu.cn' not in current_url
        logger.info(f"  登录状态检查: URL={current_url[:100]}, 已登录={is_logged_in}")
        return is_logged_in
    except Exception as e:
        logger.warning(f"  登录状态检查异常: {e}")
        return False
    finally:
        await page.close()