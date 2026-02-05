/**
 * Property-Based Tests for WeatherValidator
 * 
 * Tests universal properties across randomized inputs using fast-check.
 * Minimum 100 iterations per property test.
 * 
 * Feature: agricultural-accuracy-and-security-fixes
 * Requirements: 8.1, 8.2, 8.3, 11.1, 11.2
 */

import * as fc from 'fast-check';
import WeatherValidator, { DataQuality, RawWeatherData } from '../weatherValidator.js';

describe('WeatherValidator - Property-Based Tests', () => {
  let validator: WeatherValidator;

  beforeEach(() => {
    validator = new WeatherValidator();
  });

  /**
   * Property 17: Temperature range validation
   * 
   * For any temperature value received from weather data, if the value is outside 
   * the range -50°C to 60°C, it should be rejected or set to null.
   * 
   * **Validates: Requirements 8.1**
   */
  describe('Property 17: Temperature range validation', () => {
    it('should accept all temperatures within valid range [-50, 60]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -50, max: 60, noNaN: true }),
          (temp) => {
            const result = validator.validateTemperature(temp);
            expect(result).not.toBeNull();
            expect(result).toBe(temp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all temperatures below -50°C', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -50.01, noNaN: true }),
          (temp) => {
            const result = validator.validateTemperature(temp);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all temperatures above 60°C', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 60.01, noNaN: true }),
          (temp) => {
            const result = validator.validateTemperature(temp);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for any non-numeric value', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.string().filter(s => isNaN(Number(s)) && s !== ''),
            fc.object(),
            fc.array(fc.anything())
          ),
          (invalidValue) => {
            const result = validator.validateTemperature(invalidValue);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numeric strings within valid range', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -50, max: 60, noNaN: true }),
          (temp) => {
            const tempString = temp.toString();
            const result = validator.validateTemperature(tempString);
            expect(result).not.toBeNull();
            expect(result).toBeCloseTo(temp, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Humidity range validation
   * 
   * For any relative humidity value received from weather data, if the value is 
   * outside the range 0% to 100%, it should be rejected or set to null.
   * 
   * **Validates: Requirements 8.2**
   */
  describe('Property 18: Humidity range validation', () => {
    it('should accept all humidity values within valid range [0, 100]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          (humidity) => {
            const result = validator.validateHumidity(humidity);
            expect(result).not.toBeNull();
            expect(result).toBe(humidity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all humidity values below 0%', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -0.01, noNaN: true }),
          (humidity) => {
            const result = validator.validateHumidity(humidity);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all humidity values above 100%', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100.01, noNaN: true }),
          (humidity) => {
            const result = validator.validateHumidity(humidity);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for any non-numeric value', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.string().filter(s => isNaN(Number(s)) && s !== ''),
            fc.object(),
            fc.array(fc.anything())
          ),
          (invalidValue) => {
            const result = validator.validateHumidity(invalidValue);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numeric strings within valid range', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          (humidity) => {
            const humidityString = humidity.toString();
            const result = validator.validateHumidity(humidityString);
            expect(result).not.toBeNull();
            expect(result).toBeCloseTo(humidity, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Wind speed non-negativity validation
   * 
   * For any wind speed value received from weather data, if the value is negative, 
   * it should be rejected or set to null.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 19: Wind speed non-negativity validation', () => {
    it('should accept all non-negative wind speed values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 200, noNaN: true }),
          (windSpeed) => {
            const result = validator.validateWindSpeed(windSpeed);
            expect(result).not.toBeNull();
            expect(result).toBe(windSpeed);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all negative wind speed values', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -0.01, noNaN: true }),
          (windSpeed) => {
            const result = validator.validateWindSpeed(windSpeed);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for any non-numeric value', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.string().filter(s => isNaN(Number(s)) && s !== ''),
            fc.object(),
            fc.array(fc.anything())
          ),
          (invalidValue) => {
            const result = validator.validateWindSpeed(invalidValue);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numeric strings for non-negative values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 200, noNaN: true }),
          (windSpeed) => {
            const windSpeedString = windSpeed.toString();
            const result = validator.validateWindSpeed(windSpeedString);
            expect(result).not.toBeNull();
            expect(result).toBeCloseTo(windSpeed, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept zero wind speed', () => {
      fc.assert(
        fc.property(
          fc.constant(0),
          (windSpeed) => {
            const result = validator.validateWindSpeed(windSpeed);
            expect(result).toBe(0);
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 27: Null handling for missing weather data
   * 
   * For any weather data field (temperature, humidity, wind speed) that is missing 
   * or unavailable from the API, the system should set the value to null rather 
   * than using zero or a default fallback value.
   * 
   * **Validates: Requirements 11.1, 11.2**
   */
  describe('Property 27: Null handling for missing weather data', () => {
    it('should never use fallback values for missing temperature', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(NaN)
          ),
          (missingValue) => {
            const result = validator.validateTemperature(missingValue);
            expect(result).toBeNull();
            // Explicitly verify it's not using 0 or any other fallback
            expect(result).not.toBe(0);
            expect(result).not.toBe('');
            expect(result).not.toBe(undefined);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never use fallback values for missing humidity', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(NaN)
          ),
          (missingValue) => {
            const result = validator.validateHumidity(missingValue);
            expect(result).toBeNull();
            // Explicitly verify it's not using 0 or any other fallback
            expect(result).not.toBe(0);
            expect(result).not.toBe('');
            expect(result).not.toBe(undefined);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never use fallback values for missing wind speed', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(NaN)
          ),
          (missingValue) => {
            const result = validator.validateWindSpeed(missingValue);
            expect(result).toBeNull();
            // Explicitly verify it's not using 0 or any other fallback
            expect(result).not.toBe(0);
            expect(result).not.toBe('');
            expect(result).not.toBe(undefined);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should distinguish between explicit zero and missing values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined)
          ),
          (missingValue) => {
            // Missing values should be null
            expect(validator.validateTemperature(missingValue)).toBeNull();
            expect(validator.validateHumidity(missingValue)).toBeNull();
            expect(validator.validateWindSpeed(missingValue)).toBeNull();

            // Explicit zero should be preserved
            expect(validator.validateTemperature(0)).toBe(0);
            expect(validator.validateHumidity(0)).toBe(0);
            expect(validator.validateWindSpeed(0)).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set invalid values to null in complete weather data validation', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.double({ max: -51, noNaN: true }), // Invalid: too cold
              fc.double({ min: 61, noNaN: true })   // Invalid: too hot
            ),
            relativeHumidity: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.double({ max: -1, noNaN: true }),   // Invalid: negative
              fc.double({ min: 101, noNaN: true })   // Invalid: over 100%
            ),
            windSpeed: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.double({ max: -1, noNaN: true })    // Invalid: negative
            ),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);

            // All invalid or missing values should be null
            expect(result.temperature).toBeNull();
            expect(result.relativeHumidity).toBeNull();
            expect(result.windSpeed).toBeNull();

            // Verify no fallback values are used
            expect(result.temperature).not.toBe(0);
            expect(result.relativeHumidity).not.toBe(0);
            expect(result.windSpeed).not.toBe(0);

            // Data quality should reflect missing data
            expect(result.dataQuality).toBe(DataQuality.INSUFFICIENT);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve valid values and set only invalid ones to null', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }), // Valid
            relativeHumidity: fc.constant(null), // Missing
            windSpeed: fc.double({ min: 0, max: 100, noNaN: true }), // Valid
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);

            // Valid values should be preserved
            expect(result.temperature).toBe(rawData.temperature);
            expect(result.windSpeed).toBe(rawData.windSpeed);

            // Missing value should be null
            expect(result.relativeHumidity).toBeNull();

            // Data quality should be PARTIAL (1 null out of 3)
            expect(result.dataQuality).toBe(DataQuality.PARTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Data quality calculation consistency
   * 
   * Verifies that data quality is consistently calculated based on the number
   * of null values in critical fields.
   */
  describe('Property: Data quality calculation consistency', () => {
    it('should always mark as COMPLETE when all critical fields are valid', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
            windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            expect(result.dataQuality).toBe(DataQuality.COMPLETE);
            expect(result.temperature).not.toBeNull();
            expect(result.relativeHumidity).not.toBeNull();
            expect(result.windSpeed).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always mark as PARTIAL when exactly one critical field is null', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Temperature null, others valid
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Humidity null, others valid
            fc.record({
              temperature: fc.double({ min: -50, max: 60, noNaN: true }),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Wind speed null, others valid
            fc.record({
              temperature: fc.double({ min: -50, max: 60, noNaN: true }),
              relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.constant(null),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            })
          ),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            expect(result.dataQuality).toBe(DataQuality.PARTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always mark as INSUFFICIENT when two or more critical fields are null', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Two fields null
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // All fields null
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.constant(null),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            })
          ),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            expect(result.dataQuality).toBe(DataQuality.INSUFFICIENT);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Risk calculation availability
   * 
   * Verifies that risk calculation is only possible when both temperature
   * and humidity are available.
   */
  describe('Property: Risk calculation availability', () => {
    it('should allow risk calculation when temperature and humidity are present', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            dewPoint: fc.option(fc.double({ min: -50, max: 60, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);

            expect(availability.canCalculateRisk).toBe(true);
            expect(availability.hasTemperature).toBe(true);
            expect(availability.hasHumidity).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow risk calculation when temperature is missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.constant(null),
            relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);

            expect(availability.canCalculateRisk).toBe(false);
            expect(availability.hasTemperature).toBe(false);
            expect(availability.missingFields).toContain('temperature');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow risk calculation when humidity is missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            relativeHumidity: fc.constant(null),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);

            expect(availability.canCalculateRisk).toBe(false);
            expect(availability.hasHumidity).toBe(false);
            expect(availability.missingFields).toContain('humidity');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 28: Missing data notification
   * 
   * For any weather data containing null values, the system should notify the user 
   * which specific data fields are unavailable.
   * 
   * **Validates: Requirements 11.4, 11.6**
   */
  describe('Property 28: Missing data notification', () => {
    it('should notify user about any missing weather data fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.option(fc.double({ min: -50, max: 60, noNaN: true }), { nil: null }),
            relativeHumidity: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // If any field is null, there should be at least one notification message
            if (result.temperature === null || result.relativeHumidity === null || result.windSpeed === null) {
              expect(messages.length).toBeGreaterThan(0);

              // The first message should mention unavailable data
              expect(messages[0]).toContain('unavailable');

              // Messages should specifically mention which fields are missing
              if (result.temperature === null) {
                expect(messages.some((m: string) => m.includes('temperature'))).toBe(true);
              }
              if (result.relativeHumidity === null) {
                expect(messages.some((m: string) => m.includes('humidity'))).toBe(true);
              }
              if (result.windSpeed === null) {
                expect(messages.some((m: string) => m.includes('wind speed'))).toBe(true);
              }
            } else {
              // If all fields are present, no missing data messages
              expect(messages.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should list all missing fields in notification messages', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.option(fc.double({ min: -50, max: 60, noNaN: true }), { nil: null }),
            relativeHumidity: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);

            // Verify missingFields array accurately reflects null values
            const expectedMissing: string[] = [];
            if (result.temperature === null) expectedMissing.push('temperature');
            if (result.relativeHumidity === null) expectedMissing.push('humidity');
            if (result.windSpeed === null) expectedMissing.push('wind speed');

            expect(availability.missingFields.sort()).toEqual(expectedMissing.sort());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate clear user-facing messages for missing data', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.option(fc.double({ min: -50, max: 60, noNaN: true }), { nil: null }),
            relativeHumidity: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // All messages should be strings
            messages.forEach((message: string) => {
              expect(typeof message).toBe('string');
              expect(message.length).toBeGreaterThan(0);
            });

            // If there are missing fields, messages should be informative
            if (availability.missingFields.length > 0) {
              expect(messages.length).toBeGreaterThan(0);

              // At least one message should mention the specific missing fields
              const firstMessage = messages[0];
              availability.missingFields.forEach(field => {
                expect(messages.some((m: string) => m.includes(field))).toBe(true);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should notify about data unavailability (Requirement 11.4)', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.constant(null),
            relativeHumidity: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Should have at least one message about unavailable data
            expect(messages.length).toBeGreaterThan(0);
            expect(messages.some((m: string) => m.toLowerCase().includes('unavailable'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clearly indicate which values are missing (Requirement 11.6)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Only temperature missing
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Only humidity missing
            fc.record({
              temperature: fc.double({ min: -50, max: 60, noNaN: true }),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Only wind speed missing
            fc.record({
              temperature: fc.double({ min: -50, max: 60, noNaN: true }),
              relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.constant(null),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            })
          ),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Should have exactly one missing field
            expect(availability.missingFields.length).toBe(1);

            // Messages should specifically mention the missing field
            const missingField = availability.missingFields[0];
            expect(messages.some((m: string) => m.includes(missingField))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 29: Incomplete risk calculation indication
   * 
   * For any disease risk calculation where critical weather data (temperature or humidity) 
   * is null, the system should indicate that the risk calculation may be incomplete.
   * 
   * **Validates: Requirements 11.5**
   */
  describe('Property 29: Incomplete risk calculation indication', () => {
    it('should indicate incomplete risk calculation when critical data is missing', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Temperature missing
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Humidity missing
            fc.record({
              temperature: fc.option(fc.double({ min: -50, max: 60, noNaN: true }), { nil: null }),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Both critical fields missing
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            })
          ),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Risk calculation should not be possible
            expect(availability.canCalculateRisk).toBe(false);

            // Should have messages indicating incomplete or unavailable risk calculation
            expect(messages.length).toBeGreaterThan(0);
            expect(messages.some(m =>
              m.toLowerCase().includes('incomplete') ||
              m.toLowerCase().includes('unavailable')
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not indicate incomplete calculation when both critical fields are present', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Risk calculation should be possible
            expect(availability.canCalculateRisk).toBe(true);

            // Should not have messages about unavailable risk assessment
            expect(messages.every(m =>
              !m.includes('Disease risk assessment unavailable')
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide specific messages based on which critical field is missing', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Only temperature missing
            fc.record({
              temperature: fc.constant(null),
              relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            }),
            // Only humidity missing
            fc.record({
              temperature: fc.double({ min: -50, max: 60, noNaN: true }),
              relativeHumidity: fc.constant(null),
              windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
              timestamp: fc.constant('2024-01-15T12:00:00Z')
            })
          ),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Should mention the specific missing critical field
            if (result.temperature === null) {
              expect(messages.some((m: string) => m.includes('temperature'))).toBe(true);
            }
            if (result.relativeHumidity === null) {
              expect(messages.some((m: string) => m.includes('humidity'))).toBe(true);
            }

            // Should indicate incomplete calculation
            expect(messages.some((m: string) => m.toLowerCase().includes('incomplete'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should indicate complete unavailability when both critical fields are missing', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.constant(null),
            relativeHumidity: fc.constant(null),
            windSpeed: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: null }),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Should indicate complete unavailability
            expect(messages.some(m =>
              m.includes('Disease risk assessment unavailable')
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle wind speed missing separately from critical fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.double({ min: -50, max: 60, noNaN: true }),
            relativeHumidity: fc.double({ min: 0, max: 100, noNaN: true }),
            windSpeed: fc.constant(null),
            timestamp: fc.constant('2024-01-15T12:00:00Z')
          }),
          (rawData) => {
            const result = validator.validate(rawData as RawWeatherData);
            const availability = validator.handleMissingData(result);
            const messages = validator.generateMissingDataMessages(availability);

            // Risk calculation should still be possible
            expect(availability.canCalculateRisk).toBe(true);

            // Should mention wind speed is missing but not indicate incomplete risk calculation
            expect(messages.some((m: string) => m.includes('wind speed'))).toBe(true);
            expect(messages.some((m: string) => m.includes('wind conditions'))).toBe(true);

            // Should not say risk assessment is unavailable
            expect(messages.every((m: string) =>
              !m.includes('Disease risk assessment unavailable')
            )).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
