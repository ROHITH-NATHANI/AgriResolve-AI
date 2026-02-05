/**
 * Property-Based Tests for Graceful Degradation
 * 
 * Tests universal properties of service failure handling
 * Feature: agricultural-accuracy-and-security-fixes
 * Requirements: 16.3, 16.4, 16.5
 */

import * as fc from 'fast-check';
import {
  handleGeminiUnavailable,
  handleWeatherUnavailable,
  createServiceErrorResponse,
  canProceedWithPartialData,
  validateManualWeatherData,
  type ServiceError
} from '../gracefulDegradation.js';

describe('Graceful Degradation - Property Tests', () => {
  /**
   * Property 37: Service failure error messaging
   * **Validates: Requirements 16.3**
   * 
   * For any service failure, the system should provide a specific error message
   * indicating which service is unavailable
   */
  describe('Property 37: Service failure error messaging', () => {
    it('should always include service name in error message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('gemini', 'weather'),
          fc.boolean(),
          fc.option(fc.integer({ min: 60, max: 3600 })),
          (service, retryable, retryAfter) => {
            const error: ServiceError = {
              service: service as 'gemini' | 'weather',
              available: false,
              message: `${service} service is unavailable`,
              retryable,
              retryAfter: retryAfter ?? undefined
            };

            const response = createServiceErrorResponse([error]);

            // Error message must mention the service
            expect(response.message.toLowerCase()).toContain(service);

            // Must include service in serviceErrors array
            expect(response.serviceErrors).toHaveLength(1);
            expect(response.serviceErrors).toBeDefined();
            expect(response.serviceErrors![0].service).toBe(service);

            // Must list affected features
            expect(response.affectedFeatures).toBeDefined();
            expect(response.affectedFeatures!.length).toBeGreaterThan(0);

            // Must have proper error code
            expect(response.code).toBe('SERVICE_DEGRADED');

            // Retryable flag must match
            expect(response.retryable).toBe(retryable);

            if (retryable && retryAfter) {
              expect(response.retryAfter).toBe(retryAfter);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple service failures correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              service: fc.constantFrom('gemini', 'weather'),
              retryable: fc.boolean(),
              retryAfter: fc.option(fc.integer({ min: 60, max: 3600 }))
            }),
            { minLength: 1, maxLength: 2 }
          ),
          (serviceConfigs) => {
            const errors: ServiceError[] = serviceConfigs.map(config => ({
              service: config.service as 'gemini' | 'weather',
              available: false,
              message: `${config.service} is unavailable`,
              retryable: config.retryable,
              retryAfter: config.retryAfter ?? undefined
            }));

            const response = createServiceErrorResponse(errors);

            // Must include all services in error message or serviceErrors
            errors.forEach(err => {
              const mentioned =
                response.message.toLowerCase().includes(err.service) ||
                (response.serviceErrors ? response.serviceErrors.some(se => se.service === err.service) : false);
              expect(mentioned).toBe(true);
            });

            // Affected features should be non-empty
            expect(response.affectedFeatures).toBeDefined();
            expect(response.affectedFeatures!.length).toBeGreaterThan(0);

            // If any service is retryable, response should be retryable
            const anyRetryable = errors.some(e => e.retryable);
            expect(response.retryable).toBe(anyRetryable);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 38: Graceful degradation on service failure
   * **Validates: Requirements 16.4, 16.5**
   * 
   * For any single service failure, the system should continue to provide
   * other available features without crashing
   */
  describe('Property 38: Graceful degradation on service failure', () => {
    it('should allow continuation with at least one data source', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // geminiAvailable
          fc.boolean(), // weatherAvailable
          fc.boolean(), // hasCachedGemini
          fc.boolean(), // hasManualWeather
          (geminiAvailable, weatherAvailable, hasCachedGemini, hasManualWeather) => {
            const result = canProceedWithPartialData(
              geminiAvailable,
              weatherAvailable,
              hasCachedGemini,
              hasManualWeather
            );

            // Can proceed if we have any data source
            const hasGeminiData = geminiAvailable || hasCachedGemini;
            const hasWeatherData = weatherAvailable || hasManualWeather;
            const expectedCanProceed = hasGeminiData || hasWeatherData;

            expect(result.canProceed).toBe(expectedCanProceed);

            // Limitations should be documented
            if (!geminiAvailable && !hasCachedGemini) {
              expect(result.limitations.some(l =>
                l.toLowerCase().includes('ai') || l.toLowerCase().includes('analysis')
              )).toBe(true);
            }

            if (!weatherAvailable && !hasManualWeather) {
              expect(result.limitations.some(l =>
                l.toLowerCase().includes('weather') || l.toLowerCase().includes('risk')
              )).toBe(true);
            }

            // If using fallback data, should be mentioned in limitations
            if (!geminiAvailable && hasCachedGemini) {
              expect(result.limitations.some(l =>
                l.toLowerCase().includes('cached')
              )).toBe(true);
            }

            if (!weatherAvailable && hasManualWeather) {
              expect(result.limitations.some(l =>
                l.toLowerCase().includes('manual')
              )).toBe(true);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should never crash when handling service unavailability', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 100, maxLength: 1000 })),
          (imageData) => {
            // Should not throw when handling Gemini unavailability
            expect(() => {
              const result = handleGeminiUnavailable(imageData ?? undefined);
              expect(result.error.service).toBe('gemini');
              expect(result.error.available).toBe(false);
              expect(result.error.message).toBeTruthy();
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle weather unavailability without crashing', () => {
      fc.assert(
        fc.property(
          fc.option(
            fc.record({
              temperature: fc.option(fc.float({ min: -50, max: 60 })),
              humidity: fc.option(fc.float({ min: 0, max: 100 })),
              windSpeed: fc.option(fc.float({ min: 0, max: 50 })),
              source: fc.constant('manual' as const)
            })
          ),
          (manualData) => {
            // Should not throw when handling Weather unavailability
            expect(() => {
              const result = handleWeatherUnavailable(manualData ?? undefined);
              expect(result.error.service).toBe('weather');
              expect(result.error.available).toBe(false);
              expect(result.error.message).toBeTruthy();

              if (manualData) {
                expect(result.useManual).toBe(true);
                expect(result.weatherData).toBeTruthy();
              }
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate manual weather data consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.option(fc.oneof(
              fc.float({ min: -50, max: 60 }),
              fc.float({ min: -100, max: -51 }), // Invalid
              fc.float({ min: 61, max: 100 }) // Invalid
            )),
            humidity: fc.option(fc.oneof(
              fc.float({ min: 0, max: 100 }),
              fc.float({ min: -50, max: -1 }), // Invalid
              fc.float({ min: 101, max: 200 }) // Invalid
            )),
            windSpeed: fc.option(fc.oneof(
              fc.float({ min: 0, max: 50 }),
              fc.float({ min: -50, max: -1 }) // Invalid
            ))
          }),
          (data) => {
            const result = validateManualWeatherData(data);

            // Should always return a result structure
            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('data');

            // If valid, data should be present
            if (result.valid) {
              expect(result.errors).toHaveLength(0);
              expect(result.data).toBeTruthy();
              expect(result.data?.source).toBe('manual');
            } else {
              // If invalid, should have error messages
              expect(result.errors.length).toBeGreaterThan(0);
              expect(result.data).toBeNull();
            }

            // Check temperature validation
            if (data.temperature !== null && data.temperature !== undefined) {
              if (data.temperature < -50 || data.temperature > 60) {
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.toLowerCase().includes('temperature'))).toBe(true);
              }
            }

            // Check humidity validation
            if (data.humidity !== null && data.humidity !== undefined) {
              if (data.humidity < 0 || data.humidity > 100) {
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.toLowerCase().includes('humidity'))).toBe(true);
              }
            }

            // Check wind speed validation
            if (data.windSpeed !== null && data.windSpeed !== undefined) {
              if (data.windSpeed < 0) {
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.toLowerCase().includes('wind'))).toBe(true);
              }
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
