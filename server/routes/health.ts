/**
 * Health Check Routes
 * 
 * Provides health check endpoints for service availability monitoring
 * Feature: agricultural-accuracy-and-security-fixes
 * Requirements: 16.1, 16.2
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';

const router = Router();

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

/**
 * Check if Gemini API is available
 * Requirement 16.1: System shall display cached or basic analysis if Gemini API unavailable
 */
async function checkGeminiAPIAvailability(): Promise<{ available: boolean; message: string }> {
  try {
    const apiKey = process.env.GEMINI_SERVICE_TOKEN;


    if (!apiKey) {
      return {
        available: false,
        message: 'Gemini API key not configured'
      };
    }

    // Initialize client
    const ai = new GoogleGenAI({ apiKey: apiKey.replace(/\s/g, '').trim() });

    // Try a minimal API call to verify connectivity
    // We'll use a very simple prompt to minimize cost and latency
    const model = ai.models.generateContent;

    await withTimeout(
      model({
        model: 'gemini-2.5-flash-lite',
        contents: [{ parts: [{ text: 'ping' }] }],
        config: {
          temperature: 0,
          maxOutputTokens: 1,
        } as any,
      }),
      5000
    );

    return {
      available: true,
      message: 'Gemini API is operational'
    };
  } catch (error: any) {
    logger.warn('Gemini API health check failed:', {
      error: error.message,
      status: error.status
    });

    return {
      available: false,
      message: error.status === 401 || error.status === 403
        ? 'Gemini API authentication failed'
        : 'Gemini API is unavailable'
    };
  }
}

/**
 * Check if Weather API is available
 * Requirement 16.2: System shall allow manual weather data entry when weather API unavailable
 */
async function checkWeatherAPIAvailability(): Promise<{ available: boolean; message: string }> {
  try {
    // Try to fetch weather data for a known location (London)
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', '51.5074');
    url.searchParams.set('longitude', '-0.1278');
    url.searchParams.set('current', 'temperature_2m');

    const response = await withTimeout(
      fetch(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
      }),
      5000
    );

    if (response.ok) {
      return {
        available: true,
        message: 'Weather API is operational'
      };
    }

    return {
      available: false,
      message: `Weather API returned status ${response.status}`
    };
  } catch (error: any) {
    logger.warn('Weather API health check failed:', {
      error: error.message
    });

    return {
      available: false,
      message: 'Weather API is unavailable'
    };
  }
}

/**
 * GET /api/health
 * 
 * Main health check endpoint
 * Returns overall system health and individual service status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();

    // Check all services in parallel
    const [geminiStatus, weatherStatus] = await Promise.all([
      checkGeminiAPIAvailability(),
      checkWeatherAPIAvailability()
    ]);

    const allHealthy = geminiStatus.available && weatherStatus.available;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp,
      services: {
        gemini: {
          available: geminiStatus.available,
          message: geminiStatus.message
        },
        weather: {
          available: weatherStatus.available,
          message: weatherStatus.message
        }
      }
    });
  } catch (error: any) {
    logger.error('Health check failed:', error);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/health/gemini
 * 
 * Specific health check for Gemini API
 * Requirement 16.1: Check Gemini API availability
 */
router.get('/gemini', async (req: Request, res: Response) => {
  try {
    const status = await checkGeminiAPIAvailability();

    res.status(status.available ? 200 : 503).json({
      service: 'gemini',
      available: status.available,
      message: status.message,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Gemini health check failed:', error);

    res.status(500).json({
      service: 'gemini',
      available: false,
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/weather
 * 
 * Specific health check for Weather API
 * Requirement 16.2: Check Weather API availability
 */
router.get('/weather', async (req: Request, res: Response) => {
  try {
    const status = await checkWeatherAPIAvailability();

    res.status(status.available ? 200 : 503).json({
      service: 'weather',
      available: status.available,
      message: status.message,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Weather health check failed:', error);

    res.status(500).json({
      service: 'weather',
      available: false,
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as healthRouter };
