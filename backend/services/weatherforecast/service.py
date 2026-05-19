import json
import logging

import httpx

from shared.cache import redis_client
from shared.config import settings
from services.weatherforecast.schemas import DailyForecast, ForecastResponse, HourlyForecast

logger = logging.getLogger(__name__)

CITY_LOCATION_MAP = {
    "成都": "101270101",
    "北京": "101010100",
    "上海": "101020100",
    "广州": "101280101",
    "深圳": "101280601",
    "重庆": "101040100",
}


async def get_forecast(city: str = "成都") -> ForecastResponse:
    """调用和风天气 API 获取 7 天预报 + 24 小时逐时预报"""
    cache_key = f"forecast:{city}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return ForecastResponse(**json.loads(cached))
    except Exception:
        pass

    location = CITY_LOCATION_MAP.get(city, city)
    api_key = settings.qweather_api_key

    daily_data, hourly_data, update_time = await _fetch_from_qweather(location, api_key)

    daily = [
        DailyForecast(
            date=d["fxDate"],
            temp_max=int(d["tempMax"]),
            temp_min=int(d["tempMin"]),
            condition_day=d["textDay"],
            condition_night=d["textNight"],
            icon_day=d["iconDay"],
            wind_dir_day=d["windDirDay"],
            wind_scale_day=d["windScaleDay"],
            humidity=int(d["humidity"]),
            uv_index=d.get("uvIndex", "0"),
            precip=d.get("precip", "0.0"),
            sunrise=d.get("sunrise", ""),
            sunset=d.get("sunset", ""),
        )
        for d in daily_data
    ]

    hourly = [
        HourlyForecast(
            time=h["fxTime"],
            temp=int(h["temp"]),
            condition=h["text"],
            icon=h["icon"],
            wind_dir=h["windDir"],
            wind_scale=h["windScale"],
            humidity=int(h["humidity"]),
            precip=h.get("precip", "0.0"),
        )
        for h in hourly_data
    ]

    result = ForecastResponse(
        city=city,
        update_time=update_time,
        daily=daily,
        hourly=hourly,
    )

    try:
        await redis_client.setex(cache_key, 1800, result.model_dump_json())
    except Exception:
        pass

    return result


async def _fetch_from_qweather(
    location: str, api_key: str
) -> tuple[list[dict], list[dict], str]:
    """从和风天气获取预报数据（7 日 + 逐时）"""
    if not api_key:
        return _mock_daily(), _mock_hourly(), "2025-01-01T00:00+08:00"

    async with httpx.AsyncClient() as client:
        # 7 日预报
        daily_resp = await client.get(
            "https://devapi.qweather.com/v7/weather/7d",
            params={"location": location, "key": api_key},
            timeout=10,
        )
        daily_resp.raise_for_status()
        daily_data = daily_resp.json()

        # 24 小时逐时预报
        hourly_resp = await client.get(
            "https://devapi.qweather.com/v7/weather/24h",
            params={"location": location, "key": api_key},
            timeout=10,
        )
        hourly_resp.raise_for_status()
        hourly_data = hourly_resp.json()

    if daily_data.get("code") != "200":
        logger.warning("7 日预报 API 返回异常: code=%s", daily_data.get("code"))
        return _mock_daily(), _mock_hourly(), "2025-01-01T00:00+08:00"

    if hourly_data.get("code") != "200":
        logger.warning("逐时预报 API 返回异常: code=%s", hourly_data.get("code"))
        return daily_data.get("daily", []), _mock_hourly(), daily_data.get("updateTime", "")

    return (
        daily_data.get("daily", []),
        hourly_data.get("hourly", []),
        daily_data.get("updateTime", ""),
    )


def _mock_daily() -> list[dict]:
    """开发阶段 mock 7 日预报"""
    import datetime
    base = datetime.date.today()
    days = []
    conditions = [("晴", "100"), ("多云", "104"), ("阴", "102"), ("小雨", "305"), ("多云", "104"), ("晴", "100"), ("多云", "104")]
    for i in range(7):
        date = base + datetime.timedelta(days=i)
        icon, text = conditions[i % len(conditions)]
        days.append({
            "fxDate": date.isoformat(),
            "tempMax": str(20 + i % 5),
            "tempMin": str(12 + i % 4),
            "textDay": text,
            "textNight": text,
            "iconDay": icon,
            "windDirDay": "东南风",
            "windScaleDay": "1-2",
            "humidity": "65",
            "uvIndex": "3",
            "precip": "0.0",
            "sunrise": "06:30",
            "sunset": "18:50",
        })
    return days


def _mock_hourly() -> list[dict]:
    """开发阶段 mock 24 小时预报"""
    import datetime
    now = datetime.datetime.now()
    hours = []
    texts = ["晴", "多云", "多云", "阴", "阴", "小雨", "小雨", "多云", "晴", "晴", "晴", "多云",
             "多云", "阴", "阴", "多云", "晴", "晴", "晴", "多云", "多云", "阴", "阴", "多云"]
    icons = ["100", "104", "104", "102", "102", "305", "305", "104", "100", "100", "100", "104",
             "104", "102", "102", "104", "100", "100", "100", "104", "104", "102", "102", "104"]
    for i in range(24):
        t = now + datetime.timedelta(hours=i)
        hours.append({
            "fxTime": t.isoformat() + "+08:00",
            "temp": str(16 + i % 8),
            "text": texts[i % len(texts)],
            "icon": icons[i % len(icons)],
            "windDir": "东南风",
            "windScale": "1-2",
            "humidity": "60",
            "precip": "0.0",
        })
    return hours