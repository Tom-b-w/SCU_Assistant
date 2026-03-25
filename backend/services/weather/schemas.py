from pydantic import BaseModel


class WeatherResponse(BaseModel):
    city: str
    temperature: int
    feels_like: int
    condition: str
    humidity: int
    wind_direction: str
    wind_scale: str
    clothing_advice: str
    icon: str
