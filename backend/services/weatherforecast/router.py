from fastapi import APIRouter

from services.weatherforecast.schemas import ForecastResponse
from services.weatherforecast.service import get_forecast

router = APIRouter(prefix="/api/weatherforecast", tags=["weatherforecast"])


@router.get("", response_model=ForecastResponse)
async def forecast(city: str = "成都"):
    return await get_forecast(city)