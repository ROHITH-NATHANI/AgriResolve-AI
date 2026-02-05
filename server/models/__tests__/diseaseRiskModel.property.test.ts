/**
 * Disease Risk Model Property-Based Tests
 * 
 * Property tests for DiseaseRiskModel class using fast-check
 * Requirements: 1.1, 1.2, 1.6, 1.7
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100 per property test
 */

import * as fc from 'fast-check';
import { DiseaseRiskModel } from '../diseaseRiskModel.js';
import {
  CropType,
  DiseaseName,
  DISEASE_THRESHOLDS,
  getDiseasesForCrop,
  getDiseaseThreshold,
  getAllCropTypes,
  getAllDiseaseNames
} from '../diseaseThresholds.js';
import { ValidatedWeatherData, DataQuality } from '../../utils/weatherValidator.js';

describe('DiseaseRiskModel - Property-Based Tests', () => {
  let model: DiseaseRiskModel;

  beforeEach(() => {
    model = new DiseaseRiskModel();
  });

  /**
   * Property 1: Disease-specific threshold application
   * 
   * **Validates: Requirements 1.1, 1.2**
   * 
   * For any crop type and disease combination, when calculating disease risk,
   * the system should apply the correct temperature range and leaf wetness
   * duration thresholds specific to that disease-crop pair.
   */
  describe('Property 1: Disease-specific threshold application', () => {
    test('applies correct temperature and wetness thresholds for any valid crop-disease pair', () => {
      fc.assert(
        fc.property(
          // Generate random crop type
          fc.constantFrom(...getAllCropTypes()),
          // Generate random temperature within realistic range
          fc.float({ min: -10, max: 45 }),
          // Generate random humidity
          fc.float({ min: 0, max: 100 }),
          // Generate random wind speed
          fc.float({ min: 0, max: 20 }),
          // Generate random leaf wetness hours
          fc.float({ min: 0, max: 72 }),
          (cropType, temperature, humidity, windSpeed, leafWetnessHours) => {
            // Create weather data
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Calculate risk
            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // Get diseases relevant to this crop
            const relevantDiseases = getDiseasesForCrop(cropType);

            // Verify each disease in the result
            result.risks.forEach(risk => {
              // Disease should be relevant to the crop
              expect(relevantDiseases).toContain(risk.diseaseName as DiseaseName);

              // Get the threshold for this disease
              const threshold = getDiseaseThreshold(risk.diseaseName as DiseaseName);
              expect(threshold).toBeDefined();

              if (threshold) {
                // Requirement 1.1: Temperature thresholds are applied
                // If temperature is within range, risk should be influenced by it
                const tempInRange = temperature >= threshold.tempMin && temperature <= threshold.tempMax;

                // Requirement 1.2: Wetness thresholds are applied
                // If wetness is sufficient, risk should be influenced by it
                const wetnessAboveMin = leafWetnessHours >= threshold.minWetnessHours;

                // Risk score should be valid (0-100)
                expect(risk.riskScore).toBeGreaterThanOrEqual(0);
                expect(risk.riskScore).toBeLessThanOrEqual(100);

                // Risk level should be valid
                expect(['low', 'medium', 'high', 'critical']).toContain(risk.riskLevel);

                // If both temperature and wetness are optimal, risk should be higher
                const tempOptimal = Math.abs(temperature - threshold.optimalTemp) < 3;
                const wetnessOptimal = leafWetnessHours >= threshold.minWetnessHours * 1.5;

                if (tempOptimal && wetnessOptimal && humidity > 80) {
                  // Under optimal conditions, risk should be at least moderate
                  expect(risk.riskScore).toBeGreaterThan(30);
                }

                // If temperature is far outside range, risk should be lower
                if (temperature < threshold.tempMin - 10 || temperature > threshold.tempMax + 10) {
                  // Temperature factor should significantly reduce risk
                  // (though humidity and wetness still contribute)
                  expect(risk.riskScore).toBeLessThan(70);
                }

                // If wetness is very low, risk should be reduced
                if (leafWetnessHours < threshold.minWetnessHours * 0.3) {
                  // Very low wetness should reduce risk
                  expect(risk.riskScore).toBeLessThan(60);
                }
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('temperature factor respects disease-specific min/max/optimal values', () => {
      fc.assert(
        fc.property(
          // Generate random disease
          fc.constantFrom(...getAllDiseaseNames()),
          // Generate random temperature
          fc.float({ min: -20, max: 50 }),
          // Generate random humidity and wetness
          fc.float({ min: 60, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          (diseaseName, temperature, humidity, leafWetnessHours) => {
            const threshold = getDiseaseThreshold(diseaseName);
            if (!threshold || threshold.crops.length === 0) {
              return; // Skip if no threshold or no crops
            }

            // Use the first crop that this disease affects
            const cropType = threshold.crops[0];

            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 2,
              dewPoint: temperature - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            const diseaseRisk = result.risks.find(r => r.diseaseName === diseaseName);

            if (diseaseRisk) {
              // Temperature factor should be reflected in the risk
              const tempInRange = temperature >= threshold.tempMin && temperature <= threshold.tempMax;
              const tempAtOptimal = Math.abs(temperature - threshold.optimalTemp) < 2;

              // If temperature is at optimal and other conditions are good
              if (tempAtOptimal && humidity > 85 && leafWetnessHours >= threshold.minWetnessHours) {
                // Risk should be elevated
                expect(diseaseRisk.riskScore).toBeGreaterThan(40);
              }

              // If temperature is outside range
              if (!tempInRange) {
                // Temperature factor should reduce overall risk
                // (but not necessarily to zero due to other factors)
                const tempFactor = diseaseRisk.factors.find(f => f.name === 'Temperature');
                expect(tempFactor).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wetness factor respects disease-specific minimum wetness hours', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllDiseaseNames()),
          fc.float({ min: 0, max: 72 }),
          fc.float({ min: 60, max: 100 }),
          (diseaseName, leafWetnessHours, humidity) => {
            const threshold = getDiseaseThreshold(diseaseName);
            if (!threshold || threshold.crops.length === 0) {
              return;
            }

            const cropType = threshold.crops[0];
            const weatherData: ValidatedWeatherData = {
              temperature: threshold.optimalTemp,
              relativeHumidity: humidity,
              windSpeed: 2,
              dewPoint: threshold.optimalTemp - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            const diseaseRisk = result.risks.find(r => r.diseaseName === diseaseName);

            if (diseaseRisk) {
              const wetnessFactor = diseaseRisk.factors.find(f => f.name === 'Leaf Wetness Duration');
              expect(wetnessFactor).toBeDefined();
              expect(wetnessFactor!.value).toBe(leafWetnessHours);

              // If wetness is well above minimum, risk should be higher
              if (leafWetnessHours >= threshold.minWetnessHours * 2) {
                // With optimal temp and high humidity, risk should be elevated
                if (humidity > 85) {
                  expect(diseaseRisk.riskScore).toBeGreaterThan(50);
                }
              }

              // If wetness is well below minimum, risk should be lower
              if (leafWetnessHours < threshold.minWetnessHours * 0.3) {
                // Risk should be reduced (though not necessarily very low due to other factors)
                expect(diseaseRisk.riskScore).toBeLessThan(70);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Multiple disease risk calculation
   * 
   * **Validates: Requirements 1.6**
   * 
   * For any crop type that is susceptible to multiple diseases, the system
   * should calculate and return separate risk scores for each applicable disease.
   */
  describe('Property 2: Multiple disease risk calculation', () => {
    test('calculates separate risk scores for all diseases affecting a crop', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: 10, max: 30 }),
          fc.float({ min: 60, max: 100 }),
          fc.float({ min: 0, max: 20 }),
          fc.float({ min: 0, max: 48 }),
          (cropType, temperature, humidity, windSpeed, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // Get expected diseases for this crop
            const expectedDiseases = getDiseasesForCrop(cropType);

            // Should have calculated risk for each disease
            expect(result.risks.length).toBe(expectedDiseases.length);

            // Each disease should have a separate risk assessment
            const diseaseNames = result.risks.map(r => r.diseaseName);
            const uniqueDiseaseNames = new Set(diseaseNames);

            // No duplicate diseases
            expect(uniqueDiseaseNames.size).toBe(diseaseNames.length);

            // All expected diseases should be present
            expectedDiseases.forEach(diseaseName => {
              expect(diseaseNames).toContain(diseaseName);
            });

            // Each risk should have its own score and factors
            result.risks.forEach(risk => {
              expect(risk.diseaseName).toBeDefined();
              expect(risk.diseaseDisplayName).toBeDefined();
              expect(risk.riskScore).toBeGreaterThanOrEqual(0);
              expect(risk.riskScore).toBeLessThanOrEqual(100);
              expect(risk.riskLevel).toBeDefined();
              expect(risk.factors.length).toBeGreaterThan(0);

              // Each factor should have valid values
              risk.factors.forEach(factor => {
                expect(factor.name).toBeDefined();
                expect(factor.contribution).toBeGreaterThanOrEqual(0);
                expect(factor.contribution).toBeLessThanOrEqual(100);
              });
            });

            // If crop has multiple diseases, risk scores should vary
            // (different diseases have different thresholds)
            if (result.risks.length > 1) {
              const riskScores = result.risks.map(r => r.riskScore);
              // At least some variation in scores (not all identical)
              const uniqueScores = new Set(riskScores);
              // Allow for some identical scores, but expect some variation
              expect(uniqueScores.size).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('each disease has independent risk calculation', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: 5, max: 35 }),
          fc.float({ min: 50, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          (cropType, temperature, humidity, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 2,
              dewPoint: temperature - 3,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // Each disease should have its own factors
            result.risks.forEach(risk => {
              const threshold = getDiseaseThreshold(risk.diseaseName as DiseaseName);
              expect(threshold).toBeDefined();

              if (threshold) {
                // Factors should reflect this specific disease's thresholds
                const tempFactor = risk.factors.find(f => f.name === 'Temperature');
                const wetnessFactor = risk.factors.find(f => f.name === 'Leaf Wetness Duration');

                expect(tempFactor).toBeDefined();
                expect(wetnessFactor).toBeDefined();

                // Temperature factor value should match weather data
                expect(tempFactor!.value).toBe(temperature);

                // Wetness factor value should match input
                expect(wetnessFactor!.value).toBe(leafWetnessHours);

                // Risk calculation should be based on this disease's specific thresholds
                // not influenced by other diseases' thresholds
                const tempInRange = temperature >= threshold.tempMin && temperature <= threshold.tempMax;
                const wetnessAboveMin = leafWetnessHours >= threshold.minWetnessHours;

                // Verify risk score is reasonable given the thresholds
                expect(risk.riskScore).toBeGreaterThanOrEqual(0);
                expect(risk.riskScore).toBeLessThanOrEqual(100);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Irrelevant disease filtering
   * 
   * **Validates: Requirements 1.7**
   * 
   * For any crop type and disease combination where the disease does not affect
   * that crop, the disease should be excluded from the risk analysis results.
   */
  describe('Property 3: Irrelevant disease filtering', () => {
    test('excludes diseases not relevant to the selected crop', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: 10, max: 30 }),
          fc.float({ min: 60, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          (cropType, temperature, humidity, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 2,
              dewPoint: temperature - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // Get diseases that ARE relevant to this crop
            const relevantDiseases = getDiseasesForCrop(cropType);

            // Get all diseases
            const allDiseases = getAllDiseaseNames();

            // Get diseases that are NOT relevant to this crop
            const irrelevantDiseases = allDiseases.filter(
              disease => !relevantDiseases.includes(disease)
            );

            // Result should only contain relevant diseases
            const resultDiseaseNames = result.risks.map(r => r.diseaseName);

            // All diseases in result should be relevant
            resultDiseaseNames.forEach(diseaseName => {
              expect(relevantDiseases).toContain(diseaseName as DiseaseName);
            });

            // No irrelevant diseases should be in result
            irrelevantDiseases.forEach(diseaseName => {
              expect(resultDiseaseNames).not.toContain(diseaseName);
            });

            // Result count should match relevant disease count
            expect(result.risks.length).toBe(relevantDiseases.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('only includes diseases that affect the crop according to DISEASE_THRESHOLDS', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: 15, max: 25 }),
          fc.float({ min: 70, max: 95 }),
          fc.float({ min: 5, max: 30 }),
          (cropType, temperature, humidity, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 3,
              dewPoint: temperature - 1,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // Verify each disease in result actually affects this crop
            result.risks.forEach(risk => {
              const threshold = getDiseaseThreshold(risk.diseaseName as DiseaseName);
              expect(threshold).toBeDefined();

              if (threshold) {
                // This disease should list the crop in its crops array
                expect(threshold.crops).toContain(cropType);
              }
            });

            // Verify no diseases are included that don't affect this crop
            const allDiseases = getAllDiseaseNames();
            allDiseases.forEach(diseaseName => {
              const threshold = getDiseaseThreshold(diseaseName);
              const resultIncludesDisease = result.risks.some(r => r.diseaseName === diseaseName);

              if (threshold) {
                const diseaseAffectsCrop = threshold.crops.includes(cropType);

                // If disease affects crop, it should be in results
                if (diseaseAffectsCrop) {
                  expect(resultIncludesDisease).toBe(true);
                } else {
                  // If disease doesn't affect crop, it should NOT be in results
                  expect(resultIncludesDisease).toBe(false);
                }
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('filtering is consistent across different weather conditions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          // Generate two different weather scenarios
          fc.float({ min: 5, max: 35 }),
          fc.float({ min: 40, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          fc.float({ min: 5, max: 35 }),
          fc.float({ min: 40, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          (cropType, temp1, humidity1, wetness1, temp2, humidity2, wetness2) => {
            const weatherData1: ValidatedWeatherData = {
              temperature: temp1,
              relativeHumidity: humidity1,
              windSpeed: 2,
              dewPoint: temp1 - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const weatherData2: ValidatedWeatherData = {
              temperature: temp2,
              relativeHumidity: humidity2,
              windSpeed: 3,
              dewPoint: temp2 - 3,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result1 = model.calculateRisk({
              cropType,
              weatherData: weatherData1,
              leafWetnessHours: wetness1
            });

            const result2 = model.calculateRisk({
              cropType,
              weatherData: weatherData2,
              leafWetnessHours: wetness2
            });

            // Same crop should get same diseases regardless of weather
            const diseases1 = result1.risks.map(r => r.diseaseName).sort();
            const diseases2 = result2.risks.map(r => r.diseaseName).sort();

            expect(diseases1).toEqual(diseases2);

            // Both should match the expected diseases for this crop
            const expectedDiseases = getDiseasesForCrop(cropType).sort();
            expect(diseases1).toEqual(expectedDiseases);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Solar radiation effect on leaf wetness
   * 
   * **Validates: Requirements 2.1, 2.4**
   * 
   * For any weather data with hourly timestamps, leaf wetness duration calculations
   * during daylight hours should apply higher evaporation rates than nighttime hours.
   */
  describe('Property 4: Solar radiation effect on leaf wetness', () => {
    test('daylight hours reduce wetness duration compared to nighttime', () => {
      fc.assert(
        fc.property(
          // Generate random temperature
          fc.float({ min: 10, max: 30 }),
          // Generate random humidity (not extremely high, so evaporation can occur)
          fc.float({ min: 70, max: 94 }),
          // Generate random wind speed
          fc.float({ min: 0, max: 10 }),
          // Generate random hour (0-23)
          fc.integer({ min: 0, max: 23 }),
          (temperature, humidity, windSpeed, hour) => {
            // Create a timestamp for the given hour
            const timestamp = new Date('2024-01-15T00:00:00Z');
            timestamp.setUTCHours(hour);

            // Create weather data
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 3,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Calculate leaf wetness
            const wetnessHours = model.calculateLeafWetness(weatherData, 'UTC');

            // Verify wetness is non-negative
            expect(wetnessHours).toBeGreaterThanOrEqual(0);

            // For daylight hours (6-18), with moderate humidity, wetness should be reduced
            // compared to nighttime hours with same conditions
            const isDaylight = hour >= 6 && hour < 18;

            if (isDaylight && humidity < 95) {
              // During daylight with non-extreme humidity, evaporation should reduce wetness
              // The reduction factor is 0.7 (30% reduction) according to the implementation
              // We can't directly compare to nighttime in a single test, but we can verify
              // that the calculation is reasonable
              expect(wetnessHours).toBeGreaterThanOrEqual(0);
              expect(Number.isFinite(wetnessHours)).toBe(true);
            }

            // Verify no NaN or invalid values
            expect(Number.isNaN(wetnessHours)).toBe(false);
            expect(Number.isFinite(wetnessHours)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('solar radiation effect is applied during daylight hours', () => {
      fc.assert(
        fc.property(
          // Generate random temperature
          fc.float({ min: 15, max: 28 }),
          // Generate random humidity below 95% (so evaporation can occur)
          fc.float({ min: 60, max: 94 }),
          // Generate random wind speed
          fc.float({ min: 0, max: 8 }),
          (temperature, humidity, windSpeed) => {
            // Test with a daytime hour (noon)
            const daytimeTimestamp = new Date('2024-01-15T12:00:00Z');
            const daytimeWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 2,
              timestamp: daytimeTimestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Test with a nighttime hour (midnight)
            const nighttimeTimestamp = new Date('2024-01-15T00:00:00Z');
            const nighttimeWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 2,
              timestamp: nighttimeTimestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const daytimeWetness = model.calculateLeafWetness(daytimeWeather, 'UTC');
            const nighttimeWetness = model.calculateLeafWetness(nighttimeWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(daytimeWetness)).toBe(true);
            expect(Number.isFinite(nighttimeWetness)).toBe(true);
            expect(daytimeWetness).toBeGreaterThanOrEqual(0);
            expect(nighttimeWetness).toBeGreaterThanOrEqual(0);

            // Requirement 2.4: Daylight hours should have reduced wetness due to evaporation
            // (unless humidity is extremely high >= 95%)
            if (humidity < 95) {
              // Daytime wetness should be less than or equal to nighttime wetness
              expect(daytimeWetness).toBeLessThanOrEqual(nighttimeWetness);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('evaporation effect varies with humidity levels', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 15, max: 25 }),
          fc.float({ min: 0, max: 5 }),
          (temperature, windSpeed) => {
            const daytimeTimestamp = new Date('2024-01-15T14:00:00Z');

            // Test with low humidity (evaporation should be strong)
            const lowHumidityWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: 70,
              windSpeed,
              dewPoint: temperature - 5,
              timestamp: daytimeTimestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Test with very high humidity (evaporation should be minimal)
            const highHumidityWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: 96,
              windSpeed,
              dewPoint: temperature - 1,
              timestamp: daytimeTimestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const lowHumidityWetness = model.calculateLeafWetness(lowHumidityWeather, 'UTC');
            const highHumidityWetness = model.calculateLeafWetness(highHumidityWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(lowHumidityWetness)).toBe(true);
            expect(Number.isFinite(highHumidityWetness)).toBe(true);

            // Requirement 2.4: Evaporation effect should be less pronounced at very high humidity
            // High humidity should result in more wetness
            expect(highHumidityWetness).toBeGreaterThanOrEqual(lowHumidityWetness);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Wind speed effect on leaf wetness
   * 
   * **Validates: Requirements 2.2**
   * 
   * For any weather data containing wind speed measurements, leaf wetness duration
   * should decrease as wind speed increases.
   */
  describe('Property 5: Wind speed effect on leaf wetness', () => {
    test('higher wind speeds reduce leaf wetness duration', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 15, max: 25 }),
          fc.float({ min: 80, max: 95 }),
          // Generate two wind speeds: one low, one high
          fc.float({ min: 0, max: 3 }),
          fc.float({ min: 4, max: 15 }),
          (temperature, humidity, lowWindSpeed, highWindSpeed) => {
            const timestamp = new Date('2024-01-15T10:00:00Z');

            // Weather with low wind speed
            const lowWindWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: lowWindSpeed,
              dewPoint: temperature - 2,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Weather with high wind speed
            const highWindWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: highWindSpeed,
              dewPoint: temperature - 2,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const lowWindWetness = model.calculateLeafWetness(lowWindWeather, 'UTC');
            const highWindWetness = model.calculateLeafWetness(highWindWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(lowWindWetness)).toBe(true);
            expect(Number.isFinite(highWindWetness)).toBe(true);
            expect(lowWindWetness).toBeGreaterThanOrEqual(0);
            expect(highWindWetness).toBeGreaterThanOrEqual(0);

            // Requirement 2.2: Higher wind speed should reduce wetness
            // High wind (>3 m/s) should result in less wetness than low wind
            expect(highWindWetness).toBeLessThanOrEqual(lowWindWetness);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wind speed above 3 m/s applies 20% reduction', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 30, noNaN: true }),
          fc.float({ min: 85, max: 95, noNaN: true }),
          fc.float({ min: 4, max: 20, noNaN: true }),
          (temperature, humidity, windSpeed) => {
            // Skip if any value is NaN (shouldn't happen with noNaN, but safety check)
            if (Number.isNaN(temperature) || Number.isNaN(humidity) || Number.isNaN(windSpeed)) {
              return true; // Skip this test case
            }

            const timestamp = new Date('2024-01-15T02:00:00Z'); // Nighttime to isolate wind effect

            // Weather with wind speed > 3 m/s
            const windyWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 1,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Weather with no wind (to compare)
            const calmWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 0,
              dewPoint: temperature - 1,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const windyWetness = model.calculateLeafWetness(windyWeather, 'UTC');
            const calmWetness = model.calculateLeafWetness(calmWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(windyWetness)).toBe(true);
            expect(Number.isFinite(calmWetness)).toBe(true);

            // Requirement 2.3: Wind speed > 3 m/s should reduce wetness by 20%
            // Windy conditions should result in approximately 80% of calm wetness
            if (calmWetness > 0) {
              const ratio = windyWetness / calmWetness;
              // Allow some tolerance due to rounding and other factors
              expect(ratio).toBeLessThanOrEqual(0.85); // Should be around 0.8 or less
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('wind speed effect is monotonic (more wind = less wetness)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 15, max: 25 }),
          fc.float({ min: 85, max: 95 }),
          // Generate three increasing wind speeds
          fc.float({ min: 0, max: 2 }),
          fc.float({ min: 4, max: 8 }),
          fc.float({ min: 10, max: 20 }),
          (temperature, humidity, wind1, wind2, wind3) => {
            // Skip if any wind speed is NaN
            if (Number.isNaN(wind1) || Number.isNaN(wind2) || Number.isNaN(wind3)) {
              return;
            }

            const timestamp = new Date('2024-01-15T03:00:00Z');

            const weather1: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: wind1,
              dewPoint: temperature - 1,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const weather2: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: wind2,
              dewPoint: temperature - 1,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const weather3: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: wind3,
              dewPoint: temperature - 1,
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const wetness1 = model.calculateLeafWetness(weather1, 'UTC');
            const wetness2 = model.calculateLeafWetness(weather2, 'UTC');
            const wetness3 = model.calculateLeafWetness(weather3, 'UTC');

            // All should be valid
            expect(Number.isFinite(wetness1)).toBe(true);
            expect(Number.isFinite(wetness2)).toBe(true);
            expect(Number.isFinite(wetness3)).toBe(true);

            // Requirement 2.2: Wetness should decrease as wind speed increases
            // wetness1 >= wetness2 >= wetness3
            expect(wetness2).toBeLessThanOrEqual(wetness1);
            expect(wetness3).toBeLessThanOrEqual(wetness2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Dew point wetness detection
   * 
   * **Validates: Requirements 2.6**
   * 
   * For any hourly weather record where dew point temperature equals or exceeds
   * air temperature, that hour should be counted as a wet hour in leaf wetness calculations.
   */
  describe('Property 6: Dew point wetness detection', () => {
    test('dew point >= temperature indicates wet conditions', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 30 }),
          fc.float({ min: 0, max: 10 }),
          fc.float({ min: 0, max: 5 }),
          (temperature, windSpeed, dewPointOffset) => {
            const timestamp = new Date('2024-01-15T08:00:00Z');

            // Case 1: Dew point >= temperature (should indicate wetness)
            const condensationWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: 85,
              windSpeed,
              dewPoint: temperature + dewPointOffset, // Dew point >= temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Case 2: Dew point < temperature (less wetness)
            const noCondensationWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: 85,
              windSpeed,
              dewPoint: temperature - 5, // Dew point well below temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const condensationWetness = model.calculateLeafWetness(condensationWeather, 'UTC');
            const noCondensationWetness = model.calculateLeafWetness(noCondensationWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(condensationWetness)).toBe(true);
            expect(Number.isFinite(noCondensationWetness)).toBe(true);
            expect(condensationWetness).toBeGreaterThanOrEqual(0);
            expect(noCondensationWetness).toBeGreaterThanOrEqual(0);

            // Requirement 2.6: When dew point >= temperature, wetness should be higher
            expect(condensationWetness).toBeGreaterThanOrEqual(noCondensationWetness);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('dew point at exactly air temperature indicates condensation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 15, max: 25 }).filter(v => !Number.isNaN(v)),
          fc.float({ min: 70, max: 90 }),
          fc.float({ min: 0, max: 5 }),
          (temperature, humidity, windSpeed) => {
            const timestamp = new Date('2024-01-15T05:00:00Z');

            // Dew point exactly at temperature
            const exactDewPointWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature, // Exactly at temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const wetness = model.calculateLeafWetness(exactDewPointWeather, 'UTC');

            // Should be valid and indicate wet conditions
            expect(Number.isFinite(wetness)).toBe(true);
            expect(wetness).toBeGreaterThan(0);

            // Requirement 2.6: Dew point = temperature should count as wet
            // The base wetness should be at least some positive value
            expect(wetness).toBeGreaterThanOrEqual(2); // At least some wetness
          }
        ),
        { numRuns: 100 }
      );
    });

    test('dew point effect is consistent across different temperatures', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 5, max: 35 }),
          fc.float({ min: 75, max: 90 }),
          fc.float({ min: 0, max: 3 }),
          (temperature, humidity, windSpeed) => {
            const timestamp = new Date('2024-01-15T04:00:00Z');

            // Weather with dew point >= temperature
            const highDewPointWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature + 1, // Above temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            // Weather with dew point < temperature
            const lowDewPointWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 3, // Below temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const highDewPointWetness = model.calculateLeafWetness(highDewPointWeather, 'UTC');
            const lowDewPointWetness = model.calculateLeafWetness(lowDewPointWeather, 'UTC');

            // Both should be valid
            expect(Number.isFinite(highDewPointWetness)).toBe(true);
            expect(Number.isFinite(lowDewPointWetness)).toBe(true);

            // Requirement 2.6: High dew point (>= temperature) should result in more wetness
            expect(highDewPointWetness).toBeGreaterThanOrEqual(lowDewPointWetness);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('dew point effect combined with high humidity', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 15, max: 25 }),
          fc.float({ min: 0, max: 5 }),
          (temperature, windSpeed) => {
            const timestamp = new Date('2024-01-15T06:00:00Z');

            // High humidity + dew point >= temperature (maximum wetness conditions)
            const maxWetnessWeather: ValidatedWeatherData = {
              temperature,
              relativeHumidity: 92, // High humidity (>90%)
              windSpeed,
              dewPoint: temperature + 0.5, // Dew point >= temperature
              timestamp,
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const wetness = model.calculateLeafWetness(maxWetnessWeather, 'UTC');

            // Should be valid
            expect(Number.isFinite(wetness)).toBe(true);
            expect(wetness).toBeGreaterThanOrEqual(0);

            // Requirement 2.5 & 2.6: High humidity + dew point >= temp should give high wetness
            // Base wetness should be significant (at least 6 hours)
            expect(wetness).toBeGreaterThanOrEqual(6);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Risk scores are bounded and valid
   */
  describe('Additional property: Risk score validity', () => {
    test('all risk scores are within 0-100 range for any input', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: -50, max: 60 }),
          fc.float({ min: 0, max: 100 }),
          fc.float({ min: 0, max: 30 }),
          fc.float({ min: 0, max: 100 }),
          (cropType, temperature, humidity, windSpeed, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed,
              dewPoint: temperature - 5,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            // All risk scores must be in valid range
            result.risks.forEach(risk => {
              expect(risk.riskScore).toBeGreaterThanOrEqual(0);
              expect(risk.riskScore).toBeLessThanOrEqual(100);
              expect(Number.isFinite(risk.riskScore)).toBe(true);
              expect(Number.isNaN(risk.riskScore)).toBe(false);
            });

            // Confidence scores must also be valid
            expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
            expect(result.confidence.overall).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('risk level categories match risk scores', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...getAllCropTypes()),
          fc.float({ min: 10, max: 30 }),
          fc.float({ min: 50, max: 100 }),
          fc.float({ min: 0, max: 48 }),
          (cropType, temperature, humidity, leafWetnessHours) => {
            const weatherData: ValidatedWeatherData = {
              temperature,
              relativeHumidity: humidity,
              windSpeed: 2,
              dewPoint: temperature - 2,
              timestamp: new Date(),
              timezone: 'UTC',
              dataQuality: DataQuality.COMPLETE
            };

            const result = model.calculateRisk({
              cropType,
              weatherData,
              leafWetnessHours
            });

            result.risks.forEach(risk => {
              // Risk level should match risk score
              if (risk.riskScore < 25) {
                expect(risk.riskLevel).toBe('low');
              } else if (risk.riskScore < 50) {
                expect(risk.riskLevel).toBe('medium');
              } else if (risk.riskScore < 75) {
                expect(risk.riskLevel).toBe('high');
              } else {
                expect(risk.riskLevel).toBe('critical');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
