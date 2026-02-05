/**
 * Disease Risk Model Tests
 * 
 * Unit tests for DiseaseRiskModel class
 * Requirements: 1.1, 1.2, 1.6, 1.7
 */

import { DiseaseRiskModel } from '../diseaseRiskModel.js';
import { CropType, DiseaseName } from '../diseaseThresholds.js';
import { ValidatedWeatherData, DataQuality } from '../../utils/weatherValidator.js';

describe('DiseaseRiskModel', () => {
  let model: DiseaseRiskModel;

  beforeEach(() => {
    model = new DiseaseRiskModel();
  });

  describe('calculateRisk', () => {
    // Requirement 1.7: Filter diseases by crop type relevance
    test('filters diseases by crop type - tomato only gets tomato diseases', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Should include tomato diseases
      const diseaseNames = result.risks.map(r => r.diseaseName);
      expect(diseaseNames).toContain(DiseaseName.LATE_BLIGHT);
      expect(diseaseNames).toContain(DiseaseName.EARLY_BLIGHT);
      expect(diseaseNames).toContain(DiseaseName.POWDERY_MILDEW);

      // Should NOT include apple-specific diseases
      expect(diseaseNames).not.toContain(DiseaseName.APPLE_SCAB);
      expect(diseaseNames).not.toContain(DiseaseName.FIRE_BLIGHT);
      expect(diseaseNames).not.toContain(DiseaseName.CEDAR_APPLE_RUST);
    });

    test('filters diseases by crop type - apple only gets apple diseases', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.APPLE,
        weatherData,
        leafWetnessHours: 10
      });

      // Should include apple diseases
      const diseaseNames = result.risks.map(r => r.diseaseName);
      expect(diseaseNames).toContain(DiseaseName.APPLE_SCAB);
      expect(diseaseNames).toContain(DiseaseName.FIRE_BLIGHT);
      expect(diseaseNames).toContain(DiseaseName.CEDAR_APPLE_RUST);

      // Should NOT include tomato-specific diseases
      expect(diseaseNames).not.toContain(DiseaseName.SEPTORIA_LEAF_SPOT);
      expect(diseaseNames).not.toContain(DiseaseName.FUSARIUM_WILT);
    });

    // Requirement 1.6: Calculate separate risk scores for each applicable disease
    test('calculates separate risk scores for each disease', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Should have multiple diseases with separate scores
      expect(result.risks.length).toBeGreaterThan(1);

      // Each disease should have its own risk score
      result.risks.forEach(risk => {
        expect(risk.diseaseName).toBeDefined();
        expect(risk.riskScore).toBeGreaterThanOrEqual(0);
        expect(risk.riskScore).toBeLessThanOrEqual(100);
        expect(risk.riskLevel).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(risk.riskLevel);
      });

      // Risk scores should differ between diseases (different thresholds)
      const uniqueScores = new Set(result.risks.map(r => r.riskScore));
      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    // Requirement 1.1: Use crop-specific temperature thresholds for each disease type
    test('applies disease-specific temperature thresholds - late blight', () => {
      // Late blight: 10-25°C, optimal 18°C
      const weatherData: ValidatedWeatherData = {
        temperature: 18, // Optimal for late blight
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
        leafWetnessHours: 12
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      expect(lateBlight!.riskScore).toBeGreaterThan(50); // High risk at optimal temp
    });

    test('applies disease-specific temperature thresholds - outside range', () => {
      // Late blight: 10-25°C
      const weatherData: ValidatedWeatherData = {
        temperature: 30, // Outside late blight range
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 28,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight).toBeDefined();
      // Temperature factor should be 0, but humidity and wetness still contribute
      // So risk should be lower than optimal conditions but not zero
      expect(lateBlight!.riskScore).toBeLessThan(50); // Reduced risk outside temp range
    });

    // Requirement 1.2: Use disease-specific leaf wetness duration thresholds
    test('applies disease-specific wetness thresholds - late blight needs 10h', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 90,
        windSpeed: 2,
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      // Test with sufficient wetness (12 hours > 10 hours minimum)
      const resultSufficient = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      const lateBlightSufficient = resultSufficient.risks.find(
        r => r.diseaseName === DiseaseName.LATE_BLIGHT
      );
      expect(lateBlightSufficient!.riskScore).toBeGreaterThan(50);

      // Test with insufficient wetness (5 hours < 10 hours minimum)
      const resultInsufficient = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 5
      });

      const lateBlightInsufficient = resultInsufficient.risks.find(
        r => r.diseaseName === DiseaseName.LATE_BLIGHT
      );
      expect(lateBlightInsufficient!.riskScore).toBeLessThan(
        lateBlightSufficient!.riskScore
      );
    });

    test('applies disease-specific wetness thresholds - powdery mildew needs 6h', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 22, // Optimal for powdery mildew
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 20,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      // Test with sufficient wetness (8 hours > 6 hours minimum)
      const resultSufficient = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 8
      });

      const powderyMildewSufficient = resultSufficient.risks.find(
        r => r.diseaseName === DiseaseName.POWDERY_MILDEW
      );
      expect(powderyMildewSufficient!.riskScore).toBeGreaterThan(50);

      // Test with insufficient wetness (3 hours < 6 hours minimum)
      const resultInsufficient = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 3
      });

      const powderyMildewInsufficient = resultInsufficient.risks.find(
        r => r.diseaseName === DiseaseName.POWDERY_MILDEW
      );
      expect(powderyMildewInsufficient!.riskScore).toBeLessThan(
        powderyMildewSufficient!.riskScore
      );
    });

    test('returns risk factors with contribution percentages', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      result.risks.forEach(risk => {
        expect(risk.factors).toBeDefined();
        expect(risk.factors.length).toBeGreaterThan(0);

        // Each factor should have name, value, and contribution
        risk.factors.forEach(factor => {
          expect(factor.name).toBeDefined();
          expect(factor.value).toBeDefined();
          expect(factor.contribution).toBeGreaterThanOrEqual(0);
          expect(factor.contribution).toBeLessThanOrEqual(100);
        });

        // Contributions should roughly sum to 100% (allowing for rounding)
        const totalContribution = risk.factors.reduce(
          (sum, f) => sum + f.contribution,
          0
        );
        expect(totalContribution).toBeGreaterThanOrEqual(95);
        expect(totalContribution).toBeLessThanOrEqual(105);
      });
    });

    test('includes confidence score in results', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      expect(result.confidence).toBeDefined();
      expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
      expect(result.confidence.overall).toBeLessThanOrEqual(100);
      expect(result.confidence.components.weatherData).toBeDefined();
      expect(result.confidence.components.modelAccuracy).toBeDefined();
    });

    test('reduces confidence when weather data is missing', () => {
      const completeData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const partialData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const resultComplete = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: completeData,
        leafWetnessHours: 12
      });

      const resultPartial = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: partialData,
        leafWetnessHours: 12
      });

      expect(resultPartial.confidence.overall).toBeLessThan(
        resultComplete.confidence.overall
      );
    });

    test('adds warnings when weather data is incomplete', () => {
      const partialData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: partialData,
        leafWetnessHours: 12
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('missing'))).toBe(true);
    });

    test('handles missing temperature gracefully', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Should still return results with moderate risk scores
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.riskScore).toBeGreaterThanOrEqual(0);
        expect(risk.riskScore).toBeLessThanOrEqual(100);
      });
    });

    test('handles missing humidity gracefully', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: null,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Should still return results with moderate risk scores
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.riskScore).toBeGreaterThanOrEqual(0);
        expect(risk.riskScore).toBeLessThanOrEqual(100);
      });
    });

    test('categorizes risk levels correctly', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      result.risks.forEach(risk => {
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
    });

    test('includes human-readable disease names', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      result.risks.forEach(risk => {
        expect(risk.diseaseDisplayName).toBeDefined();
        expect(risk.diseaseDisplayName.length).toBeGreaterThan(0);
        // Display name should be different from enum value
        expect(risk.diseaseDisplayName).not.toBe(risk.diseaseName);
      });
    });

    test('works with different crop types', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 20,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const crops = [
        CropType.TOMATO,
        CropType.POTATO,
        CropType.WHEAT,
        CropType.CORN,
        CropType.SOYBEAN,
        CropType.GRAPE,
        CropType.APPLE
      ];

      crops.forEach(cropType => {
        const result = model.calculateRisk({
          cropType,
          weatherData,
          leafWetnessHours: 10
        });

        expect(result.risks.length).toBeGreaterThan(0);
        expect(result.confidence).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    test('handles zero leaf wetness hours', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 16,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 0
      });

      // Should return lower risk scores than with adequate wetness for wetness-dependent diseases
      const resultWithWetness = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Check late blight specifically (requires 10h wetness)
      const lateBlightNoWetness = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      const lateBlightWithWetness = resultWithWetness.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);

      expect(lateBlightNoWetness!.riskScore).toBeLessThan(lateBlightWithWetness!.riskScore);
    });

    test('handles very high leaf wetness hours', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 95,
        windSpeed: 1,
        dewPoint: 17,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 48
      });

      // Should return high risk scores
      const lateBlight = result.risks.find(r => r.diseaseName === DiseaseName.LATE_BLIGHT);
      expect(lateBlight!.riskScore).toBeGreaterThan(60);
    });

    test('handles extreme temperatures', () => {
      const coldWeather: ValidatedWeatherData = {
        temperature: -10,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: -12,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const resultCold = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: coldWeather,
        leafWetnessHours: 12
      });

      // Should return lower risk scores (outside disease temp ranges)
      // Check that most diseases have reduced risk
      const lowRiskDiseases = resultCold.risks.filter(r => r.riskScore < 60);
      expect(lowRiskDiseases.length).toBeGreaterThan(resultCold.risks.length / 2);

      const hotWeather: ValidatedWeatherData = {
        temperature: 45,
        relativeHumidity: 85,
        windSpeed: 2,
        dewPoint: 40,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const resultHot = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: hotWeather,
        leafWetnessHours: 12
      });

      // Should return lower risk scores (outside disease temp ranges)
      const lowRiskDiseasesHot = resultHot.risks.filter(r => r.riskScore < 60);
      expect(lowRiskDiseasesHot.length).toBeGreaterThan(resultHot.risks.length / 2);
    });

    test('handles low humidity conditions', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: 18,
        relativeHumidity: 30,
        windSpeed: 5,
        dewPoint: 5,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Low humidity should reduce risk scores compared to high humidity
      const highHumidityWeather: ValidatedWeatherData = {
        ...weatherData,
        relativeHumidity: 90
      };

      const resultHighHumidity = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData: highHumidityWeather,
        leafWetnessHours: 12
      });

      result.risks.forEach((risk, index) => {
        const correspondingHighHumidityRisk = resultHighHumidity.risks[index];
        expect(risk.riskScore).toBeLessThan(correspondingHighHumidityRisk.riskScore);
      });
    });

    test('handles all null weather data', () => {
      const weatherData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: null,
        windSpeed: null,
        dewPoint: null,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.INSUFFICIENT
      };

      const result = model.calculateRisk({
        cropType: CropType.TOMATO,
        weatherData,
        leafWetnessHours: 12
      });

      // Should still return results with moderate risk scores
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThan(50);
    });
  });
});
