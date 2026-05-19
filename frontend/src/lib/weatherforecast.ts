import { api } from "./api";

export interface DailyForecast {
  date: string;
  temp_max: number;
  temp_min: number;
  condition_day: string;
  condition_night: string;
  icon_day: string;
  wind_dir_day: string;
  wind_scale_day: string;
  humidity: number;
  uv_index: string;
  precip: string;
  sunrise: string;
  sunset: string;
}

export interface HourlyForecast {
  time: string;
  temp: number;
  condition: string;
  icon: string;
  wind_dir: string;
  wind_scale: string;
  humidity: number;
  precip: string;
}

export interface ForecastResponse {
  city: string;
  update_time: string;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

export async function getForecast(city = "成都"): Promise<ForecastResponse> {
  const { data } = await api.get<ForecastResponse>("/api/weatherforecast", {
    params: { city },
  });
  return data;
}