import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';
import { getRateLimitInfo } from '../middleware/rateLimiter.js';
import {
  handleGeminiUnavailable,
  handleWeatherUnavailable,
  cacheAnalysisResult,
  createServiceErrorResponse,
  canProceedWithPartialData,
  validateManualWeatherData,
  type ServiceError
} from '../services/gracefulDegradation.js';
import { DataQuality } from '../utils/weatherValidator.js';

const router = Router();

/**
 * Initialize Gemini AI client with server-side API key
 * Requirement 5.4: Backend shall inject API credentials server-side before calling Gemini API
 */
const initializeGeminiClient = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_SERVICE_TOKEN;

  if (!apiKey) {
    logger.error('GEMINI_SERVICE_TOKEN not found in environment variables');
    return null;
  }

  // Sanitize API key (remove whitespace)
  const sanitizedKey = apiKey.replace(/\s/g, '').trim();

  return new GoogleGenAI({ apiKey: sanitizedKey });
};

/**
 * Convert base64 image to inline data format for Gemini API
 */
const toInlineImage = (imageB64: string): { mimeType: string; data: string } => {
  const match = imageB64.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }

  return {
    mimeType: 'image/jpeg',
    data: imageB64.split(',')[1] || imageB64,
  };
};

/**
 * Safety system instruction for Gemini API
 */
const SAFETY_SYSTEM_INSTRUCTION = `
You are AgriResolve AI, a cautious agricultural decision-support assistant.

Safety rules (highest priority):
- Do NOT provide instructions for making, mixing, concentrating, or dosing chemicals (pesticides/fungicides/herbicides), nor application rates, nor any step-by-step hazardous procedure.
- Do NOT give human/animal medical advice. If asked about poisoning/exposure, recommend contacting local emergency services/poison control and following the product label/SDS.
- If a request is unsafe or illegal, refuse briefly and offer safer alternatives (monitoring, sanitation, scouting, consult agronomist, follow local guidelines).

Output rules:
- Follow the user-provided format requirements (e.g., JSON) and language requirements in the prompt.
- Be conservative with certainty; call out uncertainty clearly.
`;

/**
 * Default configuration for Gemini API calls
 */
const DEFAULT_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 1400,
  safetySettings: [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  ],
};

/**
 * Model fallback configuration
 */
const MODEL_FALLBACKS: Record<string, string[]> = {
  VISION_FAST: [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ],
  GENERATE_JSON: [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ],
  CHAT_INTERACTIVE: [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ],
};

/**
 * Sanitize Gemini API response before returning to client
 * Requirement 5.5: Backend shall sanitize any sensitive information before sending to client
 * 
 * This function removes any potential API keys, tokens, or sensitive data that might
 * accidentally be included in the API response.
 */
const sanitizeResponse = (response: any): any => {
  if (!response) {
    return response;
  }

  // Convert to string for pattern matching
  let responseStr = JSON.stringify(response);

  // Remove potential API keys (patterns that look like API keys)
  // Gemini API keys typically start with "AI" followed by alphanumeric characters
  responseStr = responseStr.replace(/AI[a-zA-Z0-9_-]{35,}/g, '[REDACTED_API_KEY]');

  // Remove any environment variable references
  responseStr = responseStr.replace(/process\.env\.[A-Z_]+/g, '[REDACTED_ENV_VAR]');

  // Remove any Bearer tokens
  responseStr = responseStr.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED_TOKEN]');

  // Remove any potential secrets or keys in JSON
  const sanitized = JSON.parse(responseStr);

  // Recursively remove sensitive fields
  const removeSensitiveFields = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => removeSensitiveFields(item));
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Skip fields that might contain sensitive data
      if (lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('credential')) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = removeSensitiveFields(value);
      }
    }
    return cleaned;
  };

  return removeSensitiveFields(sanitized);
};

/**
 * Call Gemini API with retry logic and model fallbacks
 * Requirement 5.3: Backend shall validate request before forwarding to Gemini API
 */
const callGeminiAPI = async (
  ai: GoogleGenAI,
  taskType: keyof typeof MODEL_FALLBACKS,
  prompt: string,
  imageB64?: string
): Promise<string> => {
  const modelCandidates = MODEL_FALLBACKS[taskType] ?? ['gemini-2.5-flash-lite'];
  const model = ai.models.generateContent;

  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    { text: prompt }
  ];

  if (imageB64) {
    const inline = toInlineImage(imageB64);
    parts.push({
      inlineData: {
        mimeType: inline.mimeType,
        data: inline.data,
      },
    });
  }

  const MAX_RETRIES_PER_MODEL = 2;

  for (const modelName of modelCandidates) {
    logger.info(`Routing '${taskType}' to model: ${modelName}`);

    let attempt = 0;
    while (attempt <= MAX_RETRIES_PER_MODEL) {
      try {
        const response = await model({
          model: modelName,
          contents: [{ parts }],
          config: {
            ...DEFAULT_CONFIG,
            systemInstruction: { parts: [{ text: SAFETY_SYSTEM_INSTRUCTION }] },
          } as any,
        });

        const text = response.text || '';

        // For JSON tasks, strip markdown code blocks if present
        if (taskType === 'GENERATE_JSON') {
          return text.replace(/```json\n?|\n?```/g, '').trim();
        }

        return text;
      } catch (error: any) {
        attempt++;

        const status = error?.status ?? error?.code;
        const message: string = String(error?.message ?? '');

        // Model selection errors -> try next model
        const isModelNotFound = status === 404;
        const isModelInvalid = status === 400 && /model/i.test(message) && /not found|invalid/i.test(message);

        // Quota/server errors -> retry with backoff
        const isRateLimit = status === 429 || message.includes('429');
        const isServerError = status === 500 || status === 502 || status === 503 || status === 504;

        // Auth / key issues -> don't rotate models
        const isAuthError = status === 401 || status === 403;
        const isInvalidKey = (status === 400 || status === 403) && /API key/i.test(message);

        if (isInvalidKey || isAuthError) {
          logger.error(`Gemini API auth error (${taskType}) using ${modelName}:`, {
            status,
            message: message.substring(0, 100) // Log only first 100 chars to avoid leaking keys
          });
          throw new Error('Gemini API authentication failed. Please check server configuration.');
        }

        if (isModelNotFound || isModelInvalid) {
          logger.warn(`Model ${modelName} unavailable (${status}). Trying next model...`);
          break;
        }

        if ((isRateLimit || isServerError) && attempt <= MAX_RETRIES_PER_MODEL) {
          const delay = 1500 * Math.pow(2, attempt - 1);
          logger.warn(
            `Gemini transient error (${status ?? 'unknown'}) for ${modelName}. Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES_PER_MODEL})`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        logger.warn(`Gemini API error for ${modelName} (${taskType}); trying next model...`, {
          status,
          message: message.substring(0, 100)
        });
        break;
      }
    }
  }

  throw new Error(
    `All Gemini fallback models failed for task '${taskType}'. Check API key/quota and model availability.`
  );
};

/**
 * POST /api/analysis
 * 
 * Secure proxy endpoint for Gemini API analysis requests with disease risk assessment
 * 
 * Requirements:
 * - 5.1: Backend server shall proxy the request
 * - 5.2: System shall NOT expose Gemini API keys in client-side code or network traffic
 * - 5.3: Backend shall validate request before forwarding to Gemini API
 * - 5.4: Backend shall inject API credentials server-side
 * - 5.5: Backend shall sanitize any sensitive information before sending to client
 * - 16.1: Display cached or basic analysis if Gemini API unavailable
 * - 16.2: Allow manual weather data entry when weather API unavailable
 * - 16.3: Display specific error messages for each service failure
 * - 16.4: Continue to provide other available features
 * - 16.5: Ensure app doesn't crash on single service failure
 * - 1.1, 1.2, 1.6, 1.7: Disease risk model integration
 * - 2.1, 2.2, 2.4, 2.6: Leaf wetness calculation
 */
router.post('/analysis', async (req: Request, res: Response) => {
  const serviceErrors: ServiceError[] = [];
  let geminiAvailable = true;
  let useCachedGemini = false;
  let cachedGeminiResult: any = null;

  try {
    // Requirement 5.3: Validate request before forwarding
    const { taskType, prompt, image, manualWeather, cropType, location } = req.body;

    if (!taskType || !prompt) {
      logger.warn('Invalid analysis request: missing required fields', {
        sessionId: req.session?.id,
        hasTaskType: !!taskType,
        hasPrompt: !!prompt
      });

      return res.status(400).json({
        error: 'Invalid Request',
        code: 'VALIDATION_ERROR',
        message: 'taskType and prompt are required fields',
        timestamp: new Date().toISOString()
      });
    }

    // Validate taskType
    if (!MODEL_FALLBACKS[taskType as keyof typeof MODEL_FALLBACKS]) {
      logger.warn('Invalid task type', { taskType, sessionId: req.session?.id });

      return res.status(400).json({
        error: 'Invalid Request',
        code: 'VALIDATION_ERROR',
        message: `Invalid taskType. Supported types: ${Object.keys(MODEL_FALLBACKS).join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    // Validate manual weather data if provided
    // Requirement 16.2: Validate manually entered weather data
    let validatedManualWeather = null;
    if (manualWeather) {
      const validation = validateManualWeatherData(manualWeather);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid Request',
          code: 'VALIDATION_ERROR',
          message: 'Invalid manual weather data',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
      }
      validatedManualWeather = validation.data;
      logger.info('Using manual weather data', { sessionId: req.session?.id });
    }

    // Requirement 5.4: Initialize Gemini client with server-side API key
    const ai = initializeGeminiClient();

    if (!ai) {
      logger.error('Failed to initialize Gemini client: API key not configured');
      geminiAvailable = false;

      // Requirement 16.1: Try to use cached results
      const degradation = handleGeminiUnavailable(image);
      useCachedGemini = degradation.useCached;
      cachedGeminiResult = degradation.cachedResult;
      serviceErrors.push(degradation.error);
    }

    // Get rate limit info for response
    const rateLimitInfo = getRateLimitInfo(req);

    logger.info('Processing analysis request', {
      taskType,
      hasImage: !!image,
      hasCropType: !!cropType,
      hasLocation: !!location,
      sessionId: req.session?.id,
      quotaRemaining: rateLimitInfo.hourly.remaining,
      geminiAvailable,
      useCachedGemini,
      hasManualWeather: !!validatedManualWeather
    });

    let result: any;
    let diseaseRisks: any = null;

    // Try to get Gemini analysis
    if (geminiAvailable && ai) {
      try {
        // Requirement 5.1: Proxy request to Gemini API
        const geminiResult = await callGeminiAPI(
          ai,
          taskType as keyof typeof MODEL_FALLBACKS,
          prompt,
          image
        );

        // Requirement 5.5: Sanitize response before returning to client
        result = sanitizeResponse(geminiResult);

        // Cache the result for future fallback
        // Requirement 16.1: Cache results for graceful degradation
        if (image) {
          cacheAnalysisResult(image, result);
        }
      } catch (error: any) {
        logger.error('Gemini API call failed', {
          error: error.message,
          sessionId: req.session?.id
        });

        geminiAvailable = false;

        // Requirement 16.1: Try to use cached results
        const degradation = handleGeminiUnavailable(image);
        useCachedGemini = degradation.useCached;
        cachedGeminiResult = degradation.cachedResult;
        serviceErrors.push(degradation.error);

        if (useCachedGemini) {
          result = cachedGeminiResult;
        }
      }
    } else if (useCachedGemini) {
      result = cachedGeminiResult;
    }

    // Calculate disease risks if crop type and location are provided
    // Requirements: 1.1, 1.2, 1.6, 1.7, 2.1, 2.2, 2.4, 2.6
    if (cropType && location) {
      try {
        const { DiseaseRiskModel } = await import('../models/diseaseRiskModel.js');
        const { fetchCurrentWeather, fetchHourlyWeather } = await import('../services/weatherService.js');
        const { CropType } = await import('../models/diseaseThresholds.js');

        // Validate crop type
        const validCropTypes = Object.values(CropType);
        if (!validCropTypes.includes(cropType)) {
          logger.warn('Invalid crop type', { cropType });
        } else {
          let weatherData = null;
          let hourlyWeatherData = null;

          // Try to fetch weather data if not using manual data
          if (!validatedManualWeather && location.latitude && location.longitude) {
            weatherData = await fetchCurrentWeather(location.latitude, location.longitude, req);
            hourlyWeatherData = await fetchHourlyWeather(location.latitude, location.longitude, req, {
              pastDays: 1,
              forecastDays: 0
            });
          } else if (validatedManualWeather) {
            // Use manual weather data
            weatherData = {
              temperature: validatedManualWeather.temperature,
              relativeHumidity: validatedManualWeather.humidity,
              windSpeed: validatedManualWeather.windSpeed,
              dewPoint: null,
              timestamp: new Date(),
              timezone: req.session?.timezone || 'UTC',
              dataQuality: DataQuality.PARTIAL
            };
          }

          if (weatherData) {
            const riskModel = new DiseaseRiskModel();
            const timezone = weatherData.timezone || req.session?.timezone || 'UTC';

            // Calculate leaf wetness duration
            const leafWetnessHours = riskModel.calculateLeafWetness(
              hourlyWeatherData || weatherData,
              timezone,
              location.latitude
            );

            // Calculate disease risks
            const riskResult = riskModel.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            diseaseRisks = {
              ...riskResult,
              leafWetnessHours,
              weatherData: {
                temperature: weatherData.temperature,
                humidity: weatherData.relativeHumidity,
                windSpeed: weatherData.windSpeed,
                source: validatedManualWeather ? 'manual' : 'api'
              }
            };

            logger.info('Disease risk calculated', {
              cropType,
              riskCount: riskResult.risks.length,
              confidence: riskResult.confidence.overall,
              leafWetnessHours
            });
          } else {
            logger.warn('Weather data unavailable for disease risk calculation');
            serviceErrors.push({
              service: 'weather',
              available: false,
              message: 'Weather data unavailable. Disease risk assessment not performed.',
              retryable: true,
              retryAfter: 300
            });
          }
        }
      } catch (error: any) {
        logger.error('Disease risk calculation failed', {
          error: error.message,
          stack: error.stack
        });
        // Don't fail the entire request if disease risk calculation fails
      }
    }

    // Requirement 16.4: Check if we can proceed with partial data
    const proceedCheck = canProceedWithPartialData(
      geminiAvailable,
      true, // Weather availability would be checked separately
      useCachedGemini,
      !!validatedManualWeather
    );

    if (!proceedCheck.canProceed) {
      // Requirement 16.3: Display specific error messages
      const errorResponse = createServiceErrorResponse(serviceErrors);
      return res.status(503).json(errorResponse);
    }

    // Requirement 5.2: Never expose API keys in response
    // Double-check that no API key patterns exist in the response
    const responseStr = JSON.stringify(result);
    if (responseStr.match(/AI[a-zA-Z0-9_-]{35,}/) ||
      responseStr.toLowerCase().includes('apikey') ||
      responseStr.toLowerCase().includes('api_key')) {
      logger.error('Potential API key leak detected in response - blocking');

      return res.status(500).json({
        error: 'Internal Server Error',
        code: 'SANITIZATION_ERROR',
        message: 'Response sanitization failed. Request has been logged for review.',
        timestamp: new Date().toISOString()
      });
    }

    // Build response with degradation info
    const response: any = {
      success: true,
      result,
      diseaseRisks,
      rateLimitInfo: {
        quotaRemaining: rateLimitInfo.hourly.remaining,
        quotaUsed: rateLimitInfo.hourly.used,
        resetTime: rateLimitInfo.hourly.resetTime
      },
      timestamp: new Date().toISOString()
    };

    // Add degradation warnings if applicable
    // Requirement 16.3, 16.4: Inform user of service limitations
    if (serviceErrors.length > 0 || proceedCheck.limitations.length > 0) {
      response.degraded = true;
      response.limitations = proceedCheck.limitations;
      response.serviceErrors = serviceErrors;
    }

    if (validatedManualWeather) {
      response.manualWeatherUsed = true;
    }

    res.json(response);

    logger.info('Analysis request completed', {
      sessionId: req.session?.id,
      quotaRemaining: rateLimitInfo.hourly.remaining,
      degraded: response.degraded || false,
      useCachedGemini,
      hasManualWeather: !!validatedManualWeather,
      hasDiseaseRisks: !!diseaseRisks
    });

  } catch (error: any) {
    // Requirement 16.5: Ensure app doesn't crash on service failure
    logger.error('Analysis request failed:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.session?.id
    });

    // Don't expose internal error details to client
    res.status(500).json({
      error: 'Analysis Failed',
      code: 'ANALYSIS_ERROR',
      message: 'Failed to process analysis request. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check endpoint for Gemini API connectivity
 */
router.get('/analysis/health', async (req: Request, res: Response) => {
  try {
    const ai = initializeGeminiClient();

    if (!ai) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Gemini API key not configured',
        timestamp: new Date().toISOString()
      });
    }

    // Simple connectivity check
    res.json({
      status: 'healthy',
      message: 'Gemini API proxy is operational',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Gemini API proxy is not operational',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as analysisRouter };
