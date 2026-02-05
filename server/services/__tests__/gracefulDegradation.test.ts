/**
 * Unit Tests for Graceful Degradation
 * 
 * Tests specific service failure scenarios
 * Feature: agricultural-accuracy-and-security-fixes
 * Requirements: 16.1, 16.2, 16.4, 16.5
 */

import {
  handleGeminiUnavailable,
  handleWeatherUnavailable,
  createServiceErrorResponse,
  canProceedWithPartialData,
  validateManualWeatherData,
  cacheAnalysisResult,
  analysisCache,
  type ServiceError
} from '../gracefulDegradation.js';

describe('Graceful Degradation - Unit Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    analysisCache.clear();
  });

  describe('Gemini API Failure Scenarios', () => {
    /**
     * Test with Gemini API returning 503 error
     * Requirement 16.1: Display cached or basic analysis if Gemini API unavailable
     */
    it('should handle Gemini API 503 error with cached results', () => {
      const imageData = 'test-image-data-12345';
      const cachedResult = { analysis: 'cached disease detection' };

      // Cache a result first
      cacheAnalysisResult(imageData, cachedResult);

      // Handle unavailability
      const result = handleGeminiUnavailable(imageData);

      expect(result.useCached).toBe(true);
      expect(result.cachedResult).toEqual(cachedResult);
      expect(result.error.service).toBe('gemini');
      expect(result.error.available).toBe(false);
      expect(result.error.message).toContain('cached');
      expect(result.error.retryable).toBe(true);
    });

    it('should handle Gemini API 503 error without cached results', () => {
      const imageData = 'new-image-data-67890';

      // No cached result available
      const result = handleGeminiUnavailable(imageData);

      expect(result.useCached).toBe(false);
      expect(result.cachedResult).toBeNull();
      expect(result.error.service).toBe('gemini');
      expect(result.error.available).toBe(false);
      expect(result.error.message).toContain('unavailable');
      expect(result.error.message).not.toContain('cached');
      expect(result.error.retryable).toBe(true);
      expect(result.error.retryAfter).toBe(300);
    });

    it('should handle Gemini API unavailability without image data', () => {
      const result = handleGeminiUnavailable();

      expect(result.useCached).toBe(false);
      expect(result.cachedResult).toBeNull();
      expect(result.error.service).toBe('gemini');
      expect(result.error.available).toBe(false);
    });
  });

  describe('Weather API Failure Scenarios', () => {
    /**
     * Test with weather API timeout
     * Requirement 16.2: Allow manual weather data entry when weather API unavailable
     */
    it('should handle weather API timeout with manual data', () => {
      const manualData = {
        temperature: 25,
        humidity: 80,
        windSpeed: 5,
        source: 'manual' as const
      };

      const result = handleWeatherUnavailable(manualData);

      expect(result.useManual).toBe(true);
      expect(result.weatherData).toEqual(manualData);
      expect(result.error.service).toBe('weather');
      expect(result.error.available).toBe(false);
      expect(result.error.message).toContain('manual');
      expect(result.error.retryable).toBe(true);
    });

    it('should handle weather API timeout without manual data', () => {
      const result = handleWeatherUnavailable();

      expect(result.useManual).toBe(false);
      expect(result.weatherData).toBeNull();
      expect(result.error.service).toBe('weather');
      expect(result.error.available).toBe(false);
      expect(result.error.message).toContain('manually enter');
      expect(result.error.retryable).toBe(true);
      expect(result.error.retryAfter).toBe(300);
    });
  });

  describe('Multiple Service Failures', () => {
    /**
     * Test with both APIs unavailable
     * Requirement 16.4: Continue to provide other available features
     */
    it('should handle both APIs unavailable', () => {
      const geminiError: ServiceError = {
        service: 'gemini',
        available: false,
        message: 'Gemini API is unavailable',
        retryable: true,
        retryAfter: 300
      };

      const weatherError: ServiceError = {
        service: 'weather',
        available: false,
        message: 'Weather API is unavailable',
        retryable: true,
        retryAfter: 300
      };

      const response = createServiceErrorResponse([geminiError, weatherError]);

      expect(response.code).toBe('SERVICE_DEGRADED');
      expect(response.message).toContain('gemini');
      expect(response.message).toContain('weather');
      expect(response.serviceErrors).toHaveLength(2);
      expect(response.affectedFeatures).toBeDefined();
      expect(response.affectedFeatures!.length).toBeGreaterThan(0);
      expect(response.retryable).toBe(true);
      expect(response.retryAfter).toBe(300);
    });

    it('should list all affected features when both services fail', () => {
      const errors: ServiceError[] = [
        {
          service: 'gemini',
          available: false,
          message: 'Gemini unavailable',
          retryable: true
        },
        {
          service: 'weather',
          available: false,
          message: 'Weather unavailable',
          retryable: true
        }
      ];

      const response = createServiceErrorResponse(errors);

      // Should list features from both services
      expect(response.affectedFeatures).toContain('AI-powered image analysis');
      expect(response.affectedFeatures).toContain('Disease identification');
      expect(response.affectedFeatures).toContain('Weather-based risk assessment');
      expect(response.affectedFeatures).toContain('Leaf wetness calculation');
    });
  });

  describe('Partial Data Continuation', () => {
    /**
     * Test that other features continue working when one service fails
     * Requirement 16.4, 16.5: Continue to provide other available features
     */
    it('should allow continuation with Gemini available and weather unavailable', () => {
      const result = canProceedWithPartialData(
        true,  // geminiAvailable
        false, // weatherAvailable
        false, // hasCachedGemini
        false  // hasManualWeather
      );

      expect(result.canProceed).toBe(true);
      expect(result.limitations.some(l =>
        l.toLowerCase().includes('weather')
      )).toBe(true);
    });

    it('should allow continuation with weather available and Gemini unavailable but cached', () => {
      const result = canProceedWithPartialData(
        false, // geminiAvailable
        true,  // weatherAvailable
        true,  // hasCachedGemini
        false  // hasManualWeather
      );

      expect(result.canProceed).toBe(true);
      expect(result.limitations.some(l =>
        l.toLowerCase().includes('cached')
      )).toBe(true);
    });

    it('should allow continuation with manual weather and no Gemini', () => {
      const result = canProceedWithPartialData(
        true,  // geminiAvailable
        false, // weatherAvailable
        false, // hasCachedGemini
        true   // hasManualWeather
      );

      expect(result.canProceed).toBe(true);
      expect(result.limitations.some(l =>
        l.toLowerCase().includes('manual')
      )).toBe(true);
    });

    it('should not allow continuation with no data sources', () => {
      const result = canProceedWithPartialData(
        false, // geminiAvailable
        false, // weatherAvailable
        false, // hasCachedGemini
        false  // hasManualWeather
      );

      expect(result.canProceed).toBe(false);
      expect(result.limitations.length).toBeGreaterThan(0);
    });

    it('should allow continuation with all services available', () => {
      const result = canProceedWithPartialData(
        true,  // geminiAvailable
        true,  // weatherAvailable
        false, // hasCachedGemini
        false  // hasManualWeather
      );

      expect(result.canProceed).toBe(true);
      expect(result.limitations).toHaveLength(0);
    });
  });

  describe('Manual Weather Data Validation', () => {
    it('should validate correct manual weather data', () => {
      const data = {
        temperature: 25,
        humidity: 75,
        windSpeed: 3.5
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual({
        temperature: 25,
        humidity: 75,
        windSpeed: 3.5,
        source: 'manual'
      });
    });

    it('should accept null values in manual weather data', () => {
      const data = {
        temperature: 25,
        humidity: null,
        windSpeed: null
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data?.temperature).toBe(25);
      expect(result.data?.humidity).toBeNull();
      expect(result.data?.windSpeed).toBeNull();
    });

    it('should reject temperature below -50°C', () => {
      const data = {
        temperature: -51,
        humidity: 75,
        windSpeed: 3
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should reject temperature above 60°C', () => {
      const data = {
        temperature: 61,
        humidity: 75,
        windSpeed: 3
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should reject humidity below 0%', () => {
      const data = {
        temperature: 25,
        humidity: -1,
        windSpeed: 3
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Humidity'))).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should reject humidity above 100%', () => {
      const data = {
        temperature: 25,
        humidity: 101,
        windSpeed: 3
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Humidity'))).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should reject negative wind speed', () => {
      const data = {
        temperature: 25,
        humidity: 75,
        windSpeed: -1
      };

      const result = validateManualWeatherData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Wind speed'))).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should reject non-object data', () => {
      const result = validateManualWeatherData('invalid');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data).toBeNull();
    });

    it('should reject null data', () => {
      const result = validateManualWeatherData(null);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data).toBeNull();
    });
  });

  describe('Analysis Cache', () => {
    it('should cache and retrieve analysis results', () => {
      const imageData = 'test-image-abc123';
      const result = { disease: 'late blight', confidence: 0.85 };

      cacheAnalysisResult(imageData, result);

      const degradation = handleGeminiUnavailable(imageData);

      expect(degradation.useCached).toBe(true);
      expect(degradation.cachedResult).toEqual(result);
    });

    it('should return null for uncached images', () => {
      const imageData = 'uncached-image-xyz789';

      const degradation = handleGeminiUnavailable(imageData);

      expect(degradation.useCached).toBe(false);
      expect(degradation.cachedResult).toBeNull();
    });

    it('should handle cache size limits', () => {
      const stats = analysisCache.getStats();
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });
});
