export type HourlyAgroWeather = {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  precipitation: number[];
  wind_speed_10m: number[];
};

export type AgroWeatherResponse = {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourly: HourlyAgroWeather;
};

export async function fetchAgroWeather(
  latitude: number,
  longitude: number,
  opts?: { pastDays?: number; forecastDays?: number }
): Promise<AgroWeatherResponse | null> {
  const pastDays = opts?.pastDays ?? 7;
  const forecastDays = opts?.forecastDays ?? 7;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'dew_point_2m',
      'precipitation',
      'wind_speed_10m',
    ].join(',')
  );
  url.searchParams.set('past_days', String(pastDays));
  url.searchParams.set('forecast_days', String(forecastDays));
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as Partial<AgroWeatherResponse>;
  if (!json?.hourly) return null;

  const hourly = json.hourly as Partial<HourlyAgroWeather>;
  const fields: Array<keyof HourlyAgroWeather> = [
    'time',
    'temperature_2m',
    'relative_humidity_2m',
    'dew_point_2m',
    'precipitation',
    'wind_speed_10m',
  ];

  for (const f of fields) {
    if (!Array.isArray(hourly[f])) return null;
  }

  return {
    latitude: typeof json.latitude === 'number' ? json.latitude : latitude,
    longitude: typeof json.longitude === 'number' ? json.longitude : longitude,
    timezone: typeof json.timezone === 'string' ? json.timezone : undefined,
    hourly: hourly as HourlyAgroWeather,
  };
}
