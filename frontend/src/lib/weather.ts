import { api } from "./api";

export interface Weather {
  city: string;
  temperature: number;
  feels_like: number;
  condition: string;
  humidity: number;
  wind_direction: string;
  wind_scale: string;
  clothing_advice: string;
  icon: string;
}

export async function getWeather(city = "成都"): Promise<Weather> {
  const { data } = await api.get<Weather>("/api/weather", { params: { city } });
  return data;
}
