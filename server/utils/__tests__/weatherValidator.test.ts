/**
 * Unit tests for WeatherValidator
 * 
 * Tests validation of temperature, humidity, wind speed, and data quality assessment.
 * Requirements: 8.1, 8.2, 8.3, 11.1, 11.2
 */

import WeatherValidator, { DataQuality, RawWeatherData, ValidatedWeatherData, DataAvailability } from '../weatherValidator.js';

describe('WeatherValidator', () => {
  let validator: WeatherValidator;

  beforeEach(() => {
    validator = new WeatherValidator();
  });

  describe('validateTemperature', () => {
    describe('valid temperatures', () => {
      it('should accept temperature at lower boundary (-50°C)', () => {
        expect(validator.validateTemperature(-50)).toBe(-50);
      });

      it('should accept temperature at upper boundary (60°C)', () => {
        expect(validator.validateTemperature(60)).toBe(60);
      });

      it('should accept temperature within range (20°C)', () => {
        expect(validator.validateTemperature(20)).toBe(20);
      });

      it('should accept temperature as string and convert to number', () => {
        expect(validator.validateTemperature('25')).toBe(25);
      });

      it('should accept zero temperature', () => {
        expect(validator.validateTemperature(0)).toBe(0);
      });

      it('should accept negative temperature within range', () => {
        expect(validator.validateTemperature(-30)).toBe(-30);
      });
    });

    describe('invalid temperatures', () => {
      it('should return null for temperature below -50°C', () => {
        expect(validator.validateTemperature(-51)).toBeNull();
      });

      it('should return null for temperature above 60°C', () => {
        expect(validator.validateTemperature(61)).toBeNull();
      });

      it('should return null for temperature far outside range (100°C)', () => {
        expect(validator.validateTemperature(100)).toBeNull();
      });

      it('should return null for temperature far below range (-100°C)', () => {
        expect(validator.validateTemperature(-100)).toBeNull();
      });
    });

    describe('missing or invalid values', () => {
      it('should return null for null temperature', () => {
        expect(validator.validateTemperature(null)).toBeNull();
      });

      it('should return null for undefined temperature', () => {
        expect(validator.validateTemperature(undefined)).toBeNull();
      });

      it('should return null for non-numeric string', () => {
        expect(validator.validateTemperature('not a number')).toBeNull();
      });

      it('should return null for NaN', () => {
        expect(validator.validateTemperature(NaN)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(validator.validateTemperature('')).toBeNull();
      });

      it('should return null for object', () => {
        expect(validator.validateTemperature({})).toBeNull();
      });

      it('should return null for array', () => {
        expect(validator.validateTemperature([])).toBeNull();
      });
    });
  });

  describe('validateHumidity', () => {
    describe('valid humidity', () => {
      it('should accept humidity at lower boundary (0%)', () => {
        expect(validator.validateHumidity(0)).toBe(0);
      });

      it('should accept humidity at upper boundary (100%)', () => {
        expect(validator.validateHumidity(100)).toBe(100);
      });

      it('should accept humidity within range (50%)', () => {
        expect(validator.validateHumidity(50)).toBe(50);
      });

      it('should accept humidity as string and convert to number', () => {
        expect(validator.validateHumidity('75')).toBe(75);
      });

      it('should accept humidity at 90% (critical threshold)', () => {
        expect(validator.validateHumidity(90)).toBe(90);
      });

      it('should accept humidity at 95%', () => {
        expect(validator.validateHumidity(95)).toBe(95);
      });
    });

    describe('invalid humidity', () => {
      it('should return null for humidity below 0%', () => {
        expect(validator.validateHumidity(-1)).toBeNull();
      });

      it('should return null for humidity above 100%', () => {
        expect(validator.validateHumidity(101)).toBeNull();
      });

      it('should return null for humidity at 150%', () => {
        expect(validator.validateHumidity(150)).toBeNull();
      });

      it('should return null for negative humidity (-50%)', () => {
        expect(validator.validateHumidity(-50)).toBeNull();
      });
    });

    describe('missing or invalid values', () => {
      it('should return null for null humidity', () => {
        expect(validator.validateHumidity(null)).toBeNull();
      });

      it('should return null for undefined humidity', () => {
        expect(validator.validateHumidity(undefined)).toBeNull();
      });

      it('should return null for non-numeric string', () => {
        expect(validator.validateHumidity('high')).toBeNull();
      });

      it('should return null for NaN', () => {
        expect(validator.validateHumidity(NaN)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(validator.validateHumidity('')).toBeNull();
      });
    });
  });

  describe('validateWindSpeed', () => {
    describe('valid wind speed', () => {
      it('should accept wind speed at boundary (0 m/s)', () => {
        expect(validator.validateWindSpeed(0)).toBe(0);
      });

      it('should accept positive wind speed (5 m/s)', () => {
        expect(validator.validateWindSpeed(5)).toBe(5);
      });

      it('should accept wind speed at 3 m/s (critical threshold)', () => {
        expect(validator.validateWindSpeed(3)).toBe(3);
      });

      it('should accept high wind speed (50 m/s)', () => {
        expect(validator.validateWindSpeed(50)).toBe(50);
      });

      it('should accept wind speed as string and convert to number', () => {
        expect(validator.validateWindSpeed('10')).toBe(10);
      });

      it('should accept decimal wind speed', () => {
        expect(validator.validateWindSpeed(3.5)).toBe(3.5);
      });
    });

    describe('invalid wind speed', () => {
      it('should return null for negative wind speed', () => {
        expect(validator.validateWindSpeed(-1)).toBeNull();
      });

      it('should return null for negative wind speed (-10 m/s)', () => {
        expect(validator.validateWindSpeed(-10)).toBeNull();
      });
    });

    describe('missing or invalid values', () => {
      it('should return null for null wind speed', () => {
        expect(validator.validateWindSpeed(null)).toBeNull();
      });

      it('should return null for undefined wind speed', () => {
        expect(validator.validateWindSpeed(undefined)).toBeNull();
      });

      it('should return null for non-numeric string', () => {
        expect(validator.validateWindSpeed('calm')).toBeNull();
      });

      it('should return null for NaN', () => {
        expect(validator.validateWindSpeed(NaN)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(validator.validateWindSpeed('')).toBeNull();
      });
    });
  });

  describe('validateDewPoint', () => {
    it('should accept valid dew point within temperature range', () => {
      expect(validator.validateDewPoint(15)).toBe(15);
    });

    it('should return null for dew point outside temperature range', () => {
      expect(validator.validateDewPoint(70)).toBeNull();
    });

    it('should return null for missing dew point', () => {
      expect(validator.validateDewPoint(null)).toBeNull();
    });

    it('should accept negative dew point', () => {
      expect(validator.validateDewPoint(-20)).toBe(-20);
    });
  });

  describe('validate - complete weather data', () => {
    it('should validate complete weather data with all valid values', () => {
      const rawData: RawWeatherData = {
        temperature: 25,
        relativeHumidity: 70,
        windSpeed: 5,
        dewPoint: 18,
        timestamp: '2024-01-15T12:00:00Z',
        timezone: 'America/New_York'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBe(25);
      expect(result.relativeHumidity).toBe(70);
      expect(result.windSpeed).toBe(5);
      expect(result.dewPoint).toBe(18);
      expect(result.dataQuality).toBe(DataQuality.COMPLETE);
      expect(result.timezone).toBe('America/New_York');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle string values and convert to numbers', () => {
      const rawData: RawWeatherData = {
        temperature: '22',
        relativeHumidity: '65',
        windSpeed: '3.5',
        dewPoint: '15',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBe(22);
      expect(result.relativeHumidity).toBe(65);
      expect(result.windSpeed).toBe(3.5);
      expect(result.dewPoint).toBe(15);
      expect(result.dataQuality).toBe(DataQuality.COMPLETE);
    });

    it('should default to UTC timezone when not provided', () => {
      const rawData: RawWeatherData = {
        temperature: 20,
        relativeHumidity: 60,
        windSpeed: 2,
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.timezone).toBe('UTC');
    });
  });

  describe('validate - partial weather data', () => {
    it('should set invalid temperature to null and mark as PARTIAL', () => {
      const rawData: RawWeatherData = {
        temperature: 100, // Invalid: above 60°C
        relativeHumidity: 70,
        windSpeed: 5,
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBeNull();
      expect(result.relativeHumidity).toBe(70);
      expect(result.windSpeed).toBe(5);
      expect(result.dataQuality).toBe(DataQuality.PARTIAL);
    });

    it('should set missing humidity to null and mark as PARTIAL', () => {
      const rawData: RawWeatherData = {
        temperature: 25,
        relativeHumidity: null,
        windSpeed: 5,
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBe(25);
      expect(result.relativeHumidity).toBeNull();
      expect(result.windSpeed).toBe(5);
      expect(result.dataQuality).toBe(DataQuality.PARTIAL);
    });

    it('should set invalid wind speed to null and mark as PARTIAL', () => {
      const rawData: RawWeatherData = {
        temperature: 25,
        relativeHumidity: 70,
        windSpeed: -5, // Invalid: negative
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBe(25);
      expect(result.relativeHumidity).toBe(70);
      expect(result.windSpeed).toBeNull();
      expect(result.dataQuality).toBe(DataQuality.PARTIAL);
    });
  });

  describe('validate - insufficient weather data', () => {
    it('should mark as INSUFFICIENT when two fields are null', () => {
      const rawData: RawWeatherData = {
        temperature: null,
        relativeHumidity: null,
        windSpeed: 5,
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBeNull();
      expect(result.relativeHumidity).toBeNull();
      expect(result.windSpeed).toBe(5);
      expect(result.dataQuality).toBe(DataQuality.INSUFFICIENT);
    });

    it('should mark as INSUFFICIENT when all fields are null', () => {
      const rawData: RawWeatherData = {
        temperature: null,
        relativeHumidity: null,
        windSpeed: null,
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBeNull();
      expect(result.relativeHumidity).toBeNull();
      expect(result.windSpeed).toBeNull();
      expect(result.dataQuality).toBe(DataQuality.INSUFFICIENT);
    });

    it('should mark as INSUFFICIENT when all fields are invalid', () => {
      const rawData: RawWeatherData = {
        temperature: 100, // Invalid
        relativeHumidity: 150, // Invalid
        windSpeed: -10, // Invalid
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validator.validate(rawData);

      expect(result.temperature).toBeNull();
      expect(result.relativeHumidity).toBeNull();
      expect(result.windSpeed).toBeNull();
      expect(result.dataQuality).toBe(DataQuality.INSUFFICIENT);
    });
  });

  describe('handleMissingData', () => {
    it('should indicate all data available when complete', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: 25,
        relativeHumidity: 70,
        windSpeed: 5,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.COMPLETE
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.hasTemperature).toBe(true);
      expect(availability.hasHumidity).toBe(true);
      expect(availability.hasWindSpeed).toBe(true);
      expect(availability.canCalculateRisk).toBe(true);
      expect(availability.missingFields).toEqual([]);
    });

    it('should indicate missing temperature', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: 70,
        windSpeed: 5,
        dewPoint: null,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.hasTemperature).toBe(false);
      expect(availability.hasHumidity).toBe(true);
      expect(availability.hasWindSpeed).toBe(true);
      expect(availability.canCalculateRisk).toBe(false); // Cannot calculate without temperature
      expect(availability.missingFields).toContain('temperature');
    });

    it('should indicate missing humidity', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: 25,
        relativeHumidity: null,
        windSpeed: 5,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.hasTemperature).toBe(true);
      expect(availability.hasHumidity).toBe(false);
      expect(availability.hasWindSpeed).toBe(true);
      expect(availability.canCalculateRisk).toBe(false); // Cannot calculate without humidity
      expect(availability.missingFields).toContain('humidity');
    });

    it('should indicate missing wind speed but still allow risk calculation', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: 25,
        relativeHumidity: 70,
        windSpeed: null,
        dewPoint: 18,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.PARTIAL
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.hasTemperature).toBe(true);
      expect(availability.hasHumidity).toBe(true);
      expect(availability.hasWindSpeed).toBe(false);
      expect(availability.canCalculateRisk).toBe(true); // Can calculate with temp and humidity
      expect(availability.missingFields).toContain('wind speed');
    });

    it('should indicate all fields missing', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: null,
        windSpeed: null,
        dewPoint: null,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.INSUFFICIENT
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.hasTemperature).toBe(false);
      expect(availability.hasHumidity).toBe(false);
      expect(availability.hasWindSpeed).toBe(false);
      expect(availability.canCalculateRisk).toBe(false);
      expect(availability.missingFields).toEqual(['temperature', 'humidity', 'wind speed']);
    });

    it('should list multiple missing fields', () => {
      const validatedData: ValidatedWeatherData = {
        temperature: null,
        relativeHumidity: 70,
        windSpeed: null,
        dewPoint: null,
        timestamp: new Date(),
        timezone: 'UTC',
        dataQuality: DataQuality.INSUFFICIENT
      };

      const availability = validator.handleMissingData(validatedData);

      expect(availability.missingFields).toContain('temperature');
      expect(availability.missingFields).toContain('wind speed');
      expect(availability.missingFields).not.toContain('humidity');
      expect(availability.missingFields.length).toBe(2);
    });
  });

  describe('generateMissingDataMessages', () => {
    it('should return empty array when all data is available', () => {
      const availability: DataAvailability = {
        hasTemperature: true,
        hasHumidity: true,
        hasWindSpeed: true,
        canCalculateRisk: true,
        missingFields: []
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages).toEqual([]);
    });

    it('should generate message for missing temperature only', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: true,
        hasWindSpeed: true,
        canCalculateRisk: false,
        missingFields: ['temperature']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('temperature');
      expect(messages.some(m => m.includes('incomplete'))).toBe(true);
    });

    it('should generate message for missing humidity only', () => {
      const availability: DataAvailability = {
        hasTemperature: true,
        hasHumidity: false,
        hasWindSpeed: true,
        canCalculateRisk: false,
        missingFields: ['humidity']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('humidity');
      expect(messages.some(m => m.includes('incomplete'))).toBe(true);
    });

    it('should generate message for missing wind speed only', () => {
      const availability: DataAvailability = {
        hasTemperature: true,
        hasHumidity: true,
        hasWindSpeed: false,
        canCalculateRisk: true,
        missingFields: ['wind speed']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('wind speed');
      expect(messages.some(m => m.includes('wind conditions'))).toBe(true);
    });

    it('should generate message when both temperature and humidity are missing', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: false,
        hasWindSpeed: true,
        canCalculateRisk: false,
        missingFields: ['temperature', 'humidity']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('temperature, humidity');
      expect(messages.some(m => m.includes('unavailable'))).toBe(true);
    });

    it('should generate messages for all missing fields', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: false,
        hasWindSpeed: false,
        canCalculateRisk: false,
        missingFields: ['temperature', 'humidity', 'wind speed']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('temperature, humidity, wind speed');
      expect(messages.some(m => m.includes('unavailable'))).toBe(true);
    });

    it('should indicate risk calculation is unavailable when critical data is missing', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: false,
        hasWindSpeed: false,
        canCalculateRisk: false,
        missingFields: ['temperature', 'humidity', 'wind speed']
      };

      const messages = validator.generateMissingDataMessages(availability);

      expect(messages.some(m =>
        m.includes('Disease risk assessment unavailable') ||
        m.includes('incomplete')
      )).toBe(true);
    });

    it('should clearly indicate which specific values are missing (Requirement 11.6)', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: true,
        hasWindSpeed: false,
        canCalculateRisk: false,
        missingFields: ['temperature', 'wind speed']
      };

      const messages = validator.generateMissingDataMessages(availability);

      // Should mention both missing fields
      const firstMessage = messages[0];
      expect(firstMessage).toContain('temperature');
      expect(firstMessage).toContain('wind speed');
    });

    it('should notify user when data is unavailable (Requirement 11.4)', () => {
      const availability: DataAvailability = {
        hasTemperature: false,
        hasHumidity: true,
        hasWindSpeed: true,
        canCalculateRisk: false,
        missingFields: ['temperature']
      };

      const messages = validator.generateMissingDataMessages(availability);

      // Should have at least one message notifying about unavailable data
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('unavailable');
    });

    it('should indicate incomplete risk calculations when critical data is null (Requirement 11.5)', () => {
      const availability: DataAvailability = {
        hasTemperature: true,
        hasHumidity: false,
        hasWindSpeed: true,
        canCalculateRisk: false,
        missingFields: ['humidity']
      };

      const messages = validator.generateMissingDataMessages(availability);

      // Should indicate that risk calculations may be incomplete
      expect(messages.some(m => m.includes('incomplete'))).toBe(true);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle temperature at exact boundaries', () => {
      expect(validator.validateTemperature(-50)).toBe(-50);
      expect(validator.validateTemperature(60)).toBe(60);
      expect(validator.validateTemperature(-50.0)).toBe(-50);
      expect(validator.validateTemperature(60.0)).toBe(60);
    });

    it('should handle humidity at exact boundaries', () => {
      expect(validator.validateHumidity(0)).toBe(0);
      expect(validator.validateHumidity(100)).toBe(100);
      expect(validator.validateHumidity(0.0)).toBe(0);
      expect(validator.validateHumidity(100.0)).toBe(100);
    });

    it('should handle wind speed at zero boundary', () => {
      expect(validator.validateWindSpeed(0)).toBe(0);
      expect(validator.validateWindSpeed(0.0)).toBe(0);
    });

    it('should handle decimal values correctly', () => {
      expect(validator.validateTemperature(25.5)).toBe(25.5);
      expect(validator.validateHumidity(75.3)).toBe(75.3);
      expect(validator.validateWindSpeed(3.7)).toBe(3.7);
    });

    it('should handle very small positive wind speed', () => {
      expect(validator.validateWindSpeed(0.1)).toBe(0.1);
      expect(validator.validateWindSpeed(0.01)).toBe(0.01);
    });

    it('should handle timestamp as Date object', () => {
      const now = new Date();
      const rawData: RawWeatherData = {
        temperature: 20,
        relativeHumidity: 60,
        windSpeed: 2,
        timestamp: now
      };

      const result = validator.validate(rawData);
      expect(result.timestamp).toEqual(now);
    });

    it('should handle timestamp as ISO string', () => {
      const isoString = '2024-01-15T12:00:00.000Z';
      const rawData: RawWeatherData = {
        temperature: 20,
        relativeHumidity: 60,
        windSpeed: 2,
        timestamp: isoString
      };

      const result = validator.validate(rawData);
      expect(result.timestamp).toEqual(new Date(isoString));
    });
  });

  describe('no fallback values', () => {
    it('should never use zero as fallback for missing temperature', () => {
      const result = validator.validateTemperature(undefined);
      expect(result).toBeNull();
      expect(result).not.toBe(0);
    });

    it('should never use zero as fallback for missing humidity', () => {
      const result = validator.validateHumidity(undefined);
      expect(result).toBeNull();
      expect(result).not.toBe(0);
    });

    it('should never use zero as fallback for missing wind speed', () => {
      const result = validator.validateWindSpeed(undefined);
      expect(result).toBeNull();
      expect(result).not.toBe(0);
    });

    it('should distinguish between zero and null for wind speed', () => {
      expect(validator.validateWindSpeed(0)).toBe(0);
      expect(validator.validateWindSpeed(null)).toBeNull();
      expect(validator.validateWindSpeed(0)).not.toBeNull();
    });

    it('should distinguish between zero and null for temperature', () => {
      expect(validator.validateTemperature(0)).toBe(0);
      expect(validator.validateTemperature(null)).toBeNull();
      expect(validator.validateTemperature(0)).not.toBeNull();
    });
  });
});
