/**
 * Weather Service
 * 
 * Backend service for fetching weather data with timezone support
 * Requirements: 12.1, 12.2
 */

import { Request } from 'express';
import { getTimezoneForWeatherAPI } from '../utils/userTimezoneStorage.js';
import { createWeatherAPIParams, parseTimezoneFromWeatherAPI } from '../utils/timezoneUtils.js';
import { WeatherValidator, ValidatedWeatherData, RawWeatherData } from '../utils/weatherValidator.js';
import { logger } from '../utils/logger.js';

/**
 * Weather API response structure
 */
interface WeatherAPIResponse {
  latitude: number;
  longitude: number;
  timezone?: string;
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    dew_point_2m?: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    dew_point_2m: number[];
  };
}

/**
 * Fetch current weather data with explicit timezone
 * Requirement 12.1: Add explicit timezone parameter to weather API requests
 * 
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param req - Express request (for user timezone)
 * @returns Validated weather data or null
 */
export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  req?: Request
): Promise<ValidatedWeatherData | null> {
  try {
    // Get timezone for API request
    const timezone = req ? getTimezoneForWeatherAPI(req) : 'auto';

    // Build API URL with explicit timezone
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    const params = createWeatherAPIParams(latitude, longitude, timezone);

    // Add current weather parameters
    params.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'dew_point_2m'
    ].join(','));

    url.search = params.toString();

    logger.debug('Fetching weather data', {
      latitude,
      longitude,
      timezone,
      url: url.toString()
    });

    // Fetch weather data
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    });

    if (!response.ok) {
      logger.warn('Weather API request failed', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data: WeatherAPIResponse = await response.json();

    if (!data.current) {
      logger.warn('Weather API returned no current data');
      return null;
    }

    // Parse and validate timezone from response
    const apiTimezone = parseTimezoneFromWeatherAPI(data);
    if (!apiTimezone) {
      logger.warn('Weather API returned invalid timezone');
      return null;
    }

    // Convert to raw weather data format
    const rawData: RawWeatherData = {
      temperature: data.current.temperature_2m,
      relativeHumidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      dewPoint: data.current.dew_point_2m,
      timestamp: data.current.time,
      timezone: apiTimezone
    };

    // Validate weather data
    const validator = new WeatherValidator();
    const validated = validator.validate(rawData);

    logger.info('Weather data fetched and validated', {
      latitude,
      longitude,
      timezone: validated.timezone,
      dataQuality: validated.dataQuality
    });

    return validated;
  } catch (error) {
    logger.error('Failed to fetch weather data:', error);
    return null;
  }
}

/**
 * Fetch hourly weather data with explicit timezone
 * Requirement 12.1: Add explicit timezone parameter to weather API requests
 * 
 * @param latitude - Location latitude
 * @param longitude - Location longitude
 * @param req - Express request (for user timezone)
 * @param options - Optional parameters (pastDays, forecastDays)
 * @returns Array of validated hourly weather data or null
 */
export async function fetchHourlyWeather(
  latitude: number,
  longitude: number,
  req?: Request,
  options?: { pastDays?: number; forecastDays?: number }
): Promise<ValidatedWeatherData[] | null> {
  try {
    const pastDays = options?.pastDays ?? 7;
    const forecastDays = options?.forecastDays ?? 7;

    // Get timezone for API request
    const timezone = req ? getTimezoneForWeatherAPI(req) : 'auto';

    // Build API URL with explicit timezone
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    const params = createWeatherAPIParams(latitude, longitude, timezone);

    // Add hourly weather parameters
    params.set('hourly', [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'dew_point_2m'
    ].join(','));
    params.set('past_days', String(pastDays));
    params.set('forecast_days', String(forecastDays));

    url.search = params.toString();

    logger.debug('Fetching hourly weather data', {
      latitude,
      longitude,
      timezone,
      pastDays,
      forecastDays
    });

    // Fetch weather data
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    });

    if (!response.ok) {
      logger.warn('Weather API request failed', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data: WeatherAPIResponse = await response.json();

    if (!data.hourly || !Array.isArray(data.hourly.time)) {
      logger.warn('Weather API returned no hourly data');
      return null;
    }

    // Parse and validate timezone from response
    const apiTimezone = parseTimezoneFromWeatherAPI(data);
    if (!apiTimezone) {
      logger.warn('Weather API returned invalid timezone');
      return null;
    }

    // Convert to validated weather data array
    const validator = new WeatherValidator();
    const validatedData: ValidatedWeatherData[] = [];

    for (let i = 0; i < data.hourly.time.length; i++) {
      const rawData: RawWeatherData = {
        temperature: data.hourly.temperature_2m[i],
        relativeHumidity: data.hourly.relative_humidity_2m[i],
        windSpeed: data.hourly.wind_speed_10m[i],
        dewPoint: data.hourly.dew_point_2m[i],
        timestamp: data.hourly.time[i],
        timezone: apiTimezone
      };

      try {
        const validated = validator.validate(rawData);
        validatedData.push(validated);
      } catch (error) {
        logger.warn('Failed to validate hourly weather data point', {
          index: i,
          timestamp: data.hourly.time[i],
          error
        });
        // Continue with other data points
      }
    }

    logger.info('Hourly weather data fetched and validated', {
      latitude,
      longitude,
      timezone: apiTimezone,
      dataPoints: validatedData.length
    });

    return validatedData.length > 0 ? validatedData : null;
  } catch (error) {
    logger.error('Failed to fetch hourly weather data:', error);
    return null;
  }
}

/**
 * Check weather data availability
 * 
 * @param data - Validated weather data
 * @returns Object indicating which fields are available
 */
export function checkWeatherDataAvailability(data: ValidatedWeatherData) {
  const validator = new WeatherValidator();
  return validator.handleMissingData(data);
}
