from pydantic import BaseModel


class DailyForecast(BaseModel):
    """逐日天气预报"""
    date: str
    temp_max: int
    temp_min: int
    condition_day: str
    condition_night: str
    icon_day: str
    wind_dir_day: str
    wind_scale_day: str
    humidity: int
    uv_index: str
    precip: str
    sunrise: str
    sunset: str


class HourlyForecast(BaseModel):
    """逐小时天气预报"""
    time: str
    temp: int
    condition: str
    icon: str
    wind_dir: str
    wind_scale: str
    humidity: int
    precip: str


class ForecastResponse(BaseModel):
    city: str
    update_time: str
    daily: list[DailyForecast]
    hourly: list[HourlyForecast]