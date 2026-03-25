from fastapi import APIRouter, HTTPException

from services.weather.schemas import WeatherResponse
from services.weather.service import get_weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=WeatherResponse)
async def weather(city: str = "成都"):
    result = await get_weather(city)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result
