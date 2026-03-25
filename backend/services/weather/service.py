import json
import logging

import httpx

from shared.cache import redis_client
from shared.config import settings

logger = logging.getLogger(__name__)

def get_clothing_advice(
    temp: int,
    feels_like: int | None = None,
    humidity: int | None = None,
    wind_scale: str | None = None,
    condition: str | None = None,
) -> str:
    """根据温度、体感、湿度、风力、天况生成细致的穿衣建议。"""
    parts: list[str] = []

    # --- 核心穿衣建议（基于体感温度） ---
    effective = feels_like if feels_like is not None else temp

    if effective >= 33:
        parts.append("🔥 高温天气，建议穿轻薄透气的短袖 T 恤、短裤或连衣裙，选择棉麻材质更舒适。")
        parts.append("记得做好防晒：遮阳帽、墨镜、防晒霜都安排上。")
    elif effective >= 28:
        parts.append("☀️ 天气炎热，适合穿短袖、薄衬衫搭配短裤或轻便长裤。")
        parts.append("浅色衣物更凉爽，出门别忘了带把遮阳伞。")
    elif effective >= 23:
        parts.append("🌤 气温舒适偏暖，一件短袖或薄长袖就够了，可搭配薄款开衫备用。")
    elif effective >= 18:
        parts.append("🍃 天气微凉，建议穿长袖 T 恤或卫衣，搭配薄夹克、针织开衫。")
        parts.append("早晚温差可能较大，外出带件外套更稳妥。")
    elif effective >= 13:
        parts.append("🧥 气温偏凉，建议穿卫衣、薄毛衣搭配夹克或风衣。")
        parts.append("下装可选牛仔裤或休闲长裤，保暖又好搭。")
    elif effective >= 7:
        parts.append("🧣 天气较冷，需要穿厚外套或短款羽绒服，内搭毛衣或加绒卫衣。")
        parts.append("建议戴围巾，护住脖子防止着凉。")
    elif effective >= 0:
        parts.append("❄️ 天气寒冷，务必穿羽绒服或厚棉服，内搭保暖内衣 + 毛衣。")
        parts.append("围巾、手套、帽子三件套建议备齐，注意头部和手部保暖。")
    else:
        parts.append("🥶 极寒天气！请穿长款羽绒服或专业防寒服，搭配保暖内衣。")
        parts.append("务必戴帽子、围巾、手套，减少皮肤暴露，防止冻伤。")

    # --- 湿度建议 ---
    if humidity is not None:
        if humidity >= 85:
            parts.append("💧 湿度很高，衣物容易潮湿闷热，选择速干面料会更舒服，建议随身带纸巾。")
        elif humidity >= 70:
            parts.append("💦 空气偏潮湿，穿透气性好的衣服，避免纯棉厚衣贴身不适。")
        elif humidity <= 30:
            parts.append("🏜️ 空气干燥，注意皮肤保湿，可以涂润肤霜、多喝水。")

    # --- 风力建议 ---
    wind = 0
    if wind_scale:
        try:
            wind = int(wind_scale.split("-")[0])
        except ValueError:
            pass
    if wind >= 6:
        parts.append("🌬️ 风力较大，外套选择防风款式，避免穿裙装或宽松衣物。")
    elif wind >= 4:
        parts.append("🍂 有一定风力，建议外穿带拉链的夹克或风衣挡风。")

    # --- 天况建议 ---
    if condition:
        cond = condition.lower()
        if "雨" in cond or "rain" in cond:
            parts.append("🌧️ 有降雨，记得带伞！鞋子选防水款，裤脚别太长避免打湿。")
        elif "雪" in cond or "snow" in cond:
            parts.append("🌨️ 有降雪，穿防滑鞋底的鞋子，注意路面湿滑。")
        elif "雾" in cond or "霾" in cond:
            parts.append("😷 能见度较低，外出建议佩戴口罩，注意呼吸防护。")

    return "\n".join(parts)


# 和风天气 location ID 映射（常用城市）
CITY_LOCATION_MAP = {
    "成都": "101270101",
    "北京": "101010100",
    "上海": "101020100",
    "广州": "101280101",
    "深圳": "101280601",
    "重庆": "101040100",
}


async def get_weather(city: str = "成都") -> dict:
    """调用和风天气 API 获取实时天气"""
    cache_key = f"weather:{city}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    location = CITY_LOCATION_MAP.get(city, city)

    api_key = settings.qweather_api_key
    if not api_key:
        # 没有 API key 时返回 mock 数据
        return _mock_weather(city)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://devapi.qweather.com/v7/weather/now",
                params={"location": location, "key": api_key},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("天气 API 请求失败: %s", e)
        return _mock_weather(city)

    if data.get("code") != "200":
        logger.warning("天气 API 返回异常: code=%s", data.get("code"))
        return _mock_weather(city)

    now = data["now"]
    temp = int(now["temp"])

    result = {
        "city": city,
        "temperature": temp,
        "feels_like": int(now["feelsLike"]),
        "condition": now["text"],
        "humidity": int(now["humidity"]),
        "wind_direction": now["windDir"],
        "wind_scale": now["windScale"],
        "clothing_advice": get_clothing_advice(
            temp,
            feels_like=int(now["feelsLike"]),
            humidity=int(now["humidity"]),
            wind_scale=now["windScale"],
            condition=now["text"],
        ),
        "icon": now["icon"],
    }

    try:
        await redis_client.setex(cache_key, 1800, json.dumps(result, ensure_ascii=False))
    except Exception:
        pass

    return result


def _mock_weather(city: str) -> dict:
    """开发阶段 mock 天气数据"""
    return {
        "city": city,
        "temperature": 18,
        "feels_like": 16,
        "condition": "多云",
        "humidity": 65,
        "wind_direction": "东南风",
        "wind_scale": "2",
        "clothing_advice": get_clothing_advice(
            18, feels_like=16, humidity=65, wind_scale="2", condition="多云"
        ),
        "icon": "104",
    }
