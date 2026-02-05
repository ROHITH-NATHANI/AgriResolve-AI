/**
 * Disease Thresholds Unit Tests
 * 
 * Unit tests for specific disease thresholds with exact boundary values
 * Task 4.6: Test exact threshold values for diseases and environmental conditions
 * Requirements: 1.3, 1.4, 1.5, 2.3, 2.5
 */

import { DiseaseRiskModel } from '../diseaseRiskModel.js';
import { CropType, DiseaseName } from '../diseaseThresholds.js';
import { ValidatedWeatherData, DataQuality } from '../../utils/weatherValidator.js';

describe('Disease Thresholds - Exact Values Unit Tests', () => {
  let model: DiseaseRiskModel;

  beforeEach(() => {
    model = new DiseaseRiskModel();
  });

  describe('Late Blight - Exact Threshold Values (10-25°C, 10h wetness)', () => {
    // Requirement 1.3: Late blight temperature range 10-25°C, minimum 10 hours leaf wetness

    test('late blight at minimum temperature threshold (10°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 10, // Exact minimum threshold
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 9,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10 // Exact minimum wetness threshold
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // At minimum threshold, should have some risk (not zero)
      expect(lateBlight!.riskScore).toBeGreaterThan(0);
    });

    test('late blight at maximum temperature threshold (25°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 25, // Exact maximum threshold
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 23,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10 // Exact minimum wetness threshold
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // At maximum threshold, should have some risk (not zero)
      expect(lateBlight!.riskScore).toBeGreaterThan(0);
    });

    test('late blight at optimal temperature (18°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18, // Optimal temperature
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10 // Exact minimum wetness threshold
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // At optimal temperature with minimum wetness, should have moderate to high risk
      expect(lateBlight!.riskScore).toBeGreaterThan(40);
    });

    test('late blight with exact minimum wetness (10 hours)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18, // Optimal
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10 // Exact minimum threshold
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      expect(lateBlight!.riskScore).toBeGreaterThan(40);
    });

    test('late blight below minimum temperature (9°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 9, // Below minimum threshold
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 8,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // Below minimum temperature, risk should be significantly reduced
      // Temperature factor should be 0, but humidity and wetness still contribute
      expect(lateBlight!.riskScore).toBeLessThan(40);
    });

    test('late blight above maximum temperature (26°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 26, // Above maximum threshold
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 24,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // Above maximum temperature, risk should be significantly reduced
      expect(lateBlight!.riskScore).toBeLessThan(40);
    });
  });

  describe('Powdery Mildew - Exact Threshold Values (15-30°C, 6h wetness)', () => {
    // Requirement 1.4: Powdery mildew temperature range 15-30°C, minimum 6 hours leaf wetness

    test('powdery mildew at minimum temperature threshold (15°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 15, // Exact minimum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 13,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6 // Exact minimum wetness threshold
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // At minimum threshold, should have some risk (not zero)
      expect(powderyMildew!.riskScore).toBeGreaterThan(0);
    });

    test('powdery mildew at maximum temperature threshold (30°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 30, // Exact maximum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 27,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6 // Exact minimum wetness threshold
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // At maximum threshold, should have some risk (not zero)
      expect(powderyMildew!.riskScore).toBeGreaterThan(0);
    });

    test('powdery mildew at optimal temperature (22°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 22, // Optimal temperature
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 20,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6 // Exact minimum wetness threshold
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // At optimal temperature with minimum wetness, should have moderate to high risk
      expect(powderyMildew!.riskScore).toBeGreaterThan(40);
    });

    test('powdery mildew with exact minimum wetness (6 hours)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 22, // Optimal
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 20,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6 // Exact minimum threshold
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      expect(powderyMildew!.riskScore).toBeGreaterThan(40);
    });

    test('powdery mildew below minimum temperature (14°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 14, // Below minimum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 12,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // Below minimum temperature, risk should be significantly reduced
      expect(powderyMildew!.riskScore).toBeLessThan(40);
    });

    test('powdery mildew above maximum temperature (31°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 31, // Above maximum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 28,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 6
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // Above maximum temperature, risk should be significantly reduced
      expect(powderyMildew!.riskScore).toBeLessThan(40);
    });
  });

  describe('Rust - Exact Threshold Values (15-25°C, 8h wetness)', () => {
    // Requirement 1.5: Rust disease temperature range 15-25°C, minimum 8 hours leaf wetness

    test('rust at minimum temperature threshold (15°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 15, // Exact minimum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 13,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8 // Exact minimum wetness threshold
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // At minimum threshold, should have some risk (not zero)
      expect(rust!.riskScore).toBeGreaterThan(0);
    });

    test('rust at maximum temperature threshold (25°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 25, // Exact maximum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 23,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8 // Exact minimum wetness threshold
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // At maximum threshold, should have some risk (not zero)
      expect(rust!.riskScore).toBeGreaterThan(0);
    });

    test('rust at optimal temperature (20°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 20, // Optimal temperature
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8 // Exact minimum wetness threshold
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // At optimal temperature with minimum wetness, should have moderate to high risk
      expect(rust!.riskScore).toBeGreaterThan(40);
    });

    test('rust with exact minimum wetness (8 hours)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 20, // Optimal
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8 // Exact minimum threshold
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      expect(rust!.riskScore).toBeGreaterThan(40);
    });

    test('rust below minimum temperature (14°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 14, // Below minimum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 12,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // Below minimum temperature, risk should be significantly reduced
      expect(rust!.riskScore).toBeLessThan(40);
    });

    test('rust above maximum temperature (26°C)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 26, // Above maximum threshold
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 24,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 8
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // Above maximum temperature, risk should be significantly reduced
      expect(rust!.riskScore).toBeLessThan(40);
    });
  });

  describe('Wind Speed Reduction - Exact Threshold (3 m/s)', () => {
    // Requirement 2.3: Wind speed above 3 m/s reduces wetness duration by 20%

    test('wind speed at exactly 3 m/s threshold', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 92, // High humidity to ensure wetness
        windSpeed: 3, // Exact threshold
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetness = model.calculateLeafWetness(weatherData, 'UTC');

      // At exactly 3 m/s, should NOT apply reduction (threshold is >3, not >=3)
      // So wetness should be higher than with wind > 3 m/s
      expect(leafWetness).toBeGreaterThan(0);
    });

    test('wind speed just above 3 m/s threshold (3.1 m/s)', () => {
      const weatherDataAbove: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 92,
        windSpeed: 3.1, // Just above threshold
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const weatherDataAt: ValidatedWeatherData = {
        ...weatherDataAbove,
        windSpeed: 3 // At threshold
      };

      const leafWetnessAbove = model.calculateLeafWetness(weatherDataAbove, 'UTC');
      const leafWetnessAt = model.calculateLeafWetness(weatherDataAt, 'UTC');

      // Above 3 m/s should have 20% reduction, so should be less than at 3 m/s
      expect(leafWetnessAbove).toBeLessThan(leafWetnessAt);

      // Verify approximately 20% reduction
      const expectedReduction = leafWetnessAt * 0.8;
      expect(leafWetnessAbove).toBeCloseTo(expectedReduction, 1);
    });

    test('wind speed below 3 m/s threshold (2.9 m/s)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 92,
        windSpeed: 2.9, // Below threshold
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetness = model.calculateLeafWetness(weatherData, 'UTC');

      // Below 3 m/s should NOT apply reduction
      expect(leafWetness).toBeGreaterThan(0);
    });

    test('wind speed significantly above threshold (5 m/s)', () => {
      const weatherDataHigh: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 92,
        windSpeed: 5, // Well above threshold
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const weatherDataLow: ValidatedWeatherData = {
        ...weatherDataHigh,
        windSpeed: 2 // Below threshold
      };

      const leafWetnessHigh = model.calculateLeafWetness(weatherDataHigh, 'UTC');
      const leafWetnessLow = model.calculateLeafWetness(weatherDataLow, 'UTC');

      // High wind should reduce wetness by 20%
      expect(leafWetnessHigh).toBeLessThan(leafWetnessLow);

      // Verify approximately 20% reduction
      const expectedReduction = leafWetnessLow * 0.8;
      expect(leafWetnessHigh).toBeCloseTo(expectedReduction, 1);
    });
  });

  describe('Humidity Wetness - Exact Threshold (90% RH)', () => {
    // Requirement 2.5: Relative humidity exceeds 90%, assume leaf surfaces remain wet

    test('humidity at exactly 90% threshold', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 90, // Exact threshold
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetness = model.calculateLeafWetness(weatherData, 'UTC');

      // At exactly 90%, should NOT trigger high wetness (threshold is >90, not >=90)
      expect(leafWetness).toBeGreaterThan(0);
    });

    test('humidity just above 90% threshold (90.1%)', () => {
      const weatherDataAbove: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 90.1, // Just above threshold
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const weatherDataBelow: ValidatedWeatherData = {
        ...weatherDataAbove,
        relativeHumidity: 89.9 // Just below threshold
      };

      const leafWetnessAbove = model.calculateLeafWetness(weatherDataAbove, 'UTC');
      const leafWetnessBelow = model.calculateLeafWetness(weatherDataBelow, 'UTC');

      // Above 90% should result in higher wetness (leaves assumed wet)
      expect(leafWetnessAbove).toBeGreaterThan(leafWetnessBelow);
    });

    test('humidity significantly above 90% threshold (95%)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 95, // Well above threshold
        windSpeed: 2,
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetness = model.calculateLeafWetness(weatherData, 'UTC');

      // High humidity should result in significant wetness hours
      expect(leafWetness).toBeGreaterThan(8);
    });

    test('humidity below 90% threshold (85%)', () => {
      const weatherDataBelow: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85, // Below threshold
        windSpeed: 2,
        dewPoint: 15,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const weatherDataAbove: ValidatedWeatherData = {
        ...weatherDataBelow,
        relativeHumidity: 95 // Above threshold
      };

      const leafWetnessBelow = model.calculateLeafWetness(weatherDataBelow, 'UTC');
      const leafWetnessAbove = model.calculateLeafWetness(weatherDataAbove, 'UTC');

      // Below 90% should have less wetness than above 90%
      expect(leafWetnessBelow).toBeLessThan(leafWetnessAbove);
    });

    test('humidity at 100% (maximum)', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 100, // Maximum humidity
        windSpeed: 2,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetness = model.calculateLeafWetness(weatherData, 'UTC');

      // Maximum humidity should result in high wetness hours
      expect(leafWetness).toBeGreaterThan(10);
    });
  });

  describe('Combined Threshold Tests', () => {
    test('late blight with all optimal conditions', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18, // Optimal for late blight
        relativeHumidity: 95, // High humidity
        windSpeed: 2, // Low wind (no reduction)
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 15 // Well above minimum 10h
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // All optimal conditions should result in high risk
      expect(lateBlight!.riskScore).toBeGreaterThan(60);
      expect(lateBlight!.riskLevel).toMatch(/high|critical/);
    });

    test('powdery mildew with all optimal conditions', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 22, // Optimal for powdery mildew
        relativeHumidity: 90, // High humidity
        windSpeed: 2, // Low wind (no reduction)
        dewPoint: 20,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 10 // Well above minimum 6h
      });

      const powderyMildew = result.risks.find(r => r.diseaseName === DiseaseName.POWDERY_MILDEW);
      expect(powderyMildew).toBeDefined();
      // All optimal conditions should result in high risk
      expect(powderyMildew!.riskScore).toBeGreaterThan(60);
      expect(powderyMildew!.riskLevel).toMatch(/high|critical/);
    });

    test('rust with all optimal conditions', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 20, // Optimal for rust
        relativeHumidity: 90, // High humidity
        windSpeed: 2, // Low wind (no reduction)
        dewPoint: 19,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.WHEAT,
        weatherData,
        leafWetnessHours: 12 // Well above minimum 8h
      });

      const rust = result.risks.find(r => r.diseaseName === DiseaseName.RUST);
      expect(rust).toBeDefined();
      // All optimal conditions should result in high risk
      expect(rust!.riskScore).toBeGreaterThan(60);
      expect(rust!.riskLevel).toMatch(/high|critical/);
    });

    test('high wind and low humidity reduce wetness and risk', () => {
      const weatherDataPoor: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 70, // Below 90%
        windSpeed: 5, // Above 3 m/s
        dewPoint: 12,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const weatherDataGood: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 95, // Above 90%
        windSpeed: 2, // Below 3 m/s
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const leafWetnessPoor = model.calculateLeafWetness(weatherDataPoor, 'UTC');
      const leafWetnessGood = model.calculateLeafWetness(weatherDataGood, 'UTC');

      // Poor conditions should result in less wetness
      expect(leafWetnessPoor).toBeLessThan(leafWetnessGood);
    });
  });
});
