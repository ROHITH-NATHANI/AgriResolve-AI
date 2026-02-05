/**
 * Disease Threshold Configuration Tests
 * 
 * Unit tests for disease threshold configuration
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import {
  DISEASE_THRESHOLDS,
  CropType,
  DiseaseName,
  getDiseasesForCrop,
  getDiseaseThreshold,
  isDiseaseRelevantToCrop,
  getAllCropTypes,
  getAllDiseaseNames,
  getHumanReadableDiseaseName,
  getHumanReadableCropName
} from '../diseaseThresholds.js';

describe('Disease Threshold Configuration', () => {
  describe('DISEASE_THRESHOLDS constant', () => {
    // Requirement 1.3: Late blight thresholds
    test('late blight has correct thresholds (10-25°C, 10h wetness, optimal 18°C)', () => {
      const lateBlight = DISEASE_THRESHOLDS[DiseaseName.LATE_BLIGHT];

      expect(lateBlight).toBeDefined();
      expect(lateBlight.tempMin).toBe(10);
      expect(lateBlight.tempMax).toBe(25);
      expect(lateBlight.minWetnessHours).toBe(10);
      expect(lateBlight.optimalTemp).toBe(18);
      expect(lateBlight.crops).toContain(CropType.POTATO);
      expect(lateBlight.crops).toContain(CropType.TOMATO);
    });

    // Requirement 1.4: Powdery mildew thresholds
    test('powdery mildew has correct thresholds (15-30°C, 6h wetness, optimal 22°C)', () => {
      const powderyMildew = DISEASE_THRESHOLDS[DiseaseName.POWDERY_MILDEW];

      expect(powderyMildew).toBeDefined();
      expect(powderyMildew.tempMin).toBe(15);
      expect(powderyMildew.tempMax).toBe(30);
      expect(powderyMildew.minWetnessHours).toBe(6);
      expect(powderyMildew.optimalTemp).toBe(22);
      expect(powderyMildew.crops).toContain(CropType.GRAPE);
      expect(powderyMildew.crops).toContain(CropType.WHEAT);
      expect(powderyMildew.crops).toContain(CropType.TOMATO);
    });

    // Requirement 1.5: Rust disease thresholds
    test('rust has correct thresholds (15-25°C, 8h wetness, optimal 20°C)', () => {
      const rust = DISEASE_THRESHOLDS[DiseaseName.RUST];

      expect(rust).toBeDefined();
      expect(rust.tempMin).toBe(15);
      expect(rust.tempMax).toBe(25);
      expect(rust.minWetnessHours).toBe(8);
      expect(rust.optimalTemp).toBe(20);
      expect(rust.crops).toContain(CropType.WHEAT);
      expect(rust.crops).toContain(CropType.CORN);
      expect(rust.crops).toContain(CropType.SOYBEAN);
    });

    test('all diseases have required threshold properties', () => {
      const diseaseNames = getAllDiseaseNames();

      diseaseNames.forEach(diseaseName => {
        const threshold = DISEASE_THRESHOLDS[diseaseName];

        expect(threshold).toBeDefined();
        expect(threshold.crops).toBeDefined();
        expect(Array.isArray(threshold.crops)).toBe(true);
        expect(threshold.crops.length).toBeGreaterThan(0);
        expect(typeof threshold.tempMin).toBe('number');
        expect(typeof threshold.tempMax).toBe('number');
        expect(typeof threshold.minWetnessHours).toBe('number');
        expect(typeof threshold.optimalTemp).toBe('number');

        // Validate ranges
        expect(threshold.tempMin).toBeLessThan(threshold.tempMax);
        expect(threshold.optimalTemp).toBeGreaterThanOrEqual(threshold.tempMin);
        expect(threshold.optimalTemp).toBeLessThanOrEqual(threshold.tempMax);
        expect(threshold.minWetnessHours).toBeGreaterThanOrEqual(0);
      });
    });

    test('covers common diseases mentioned in requirements', () => {
      // Requirement 1.3, 1.4, 1.5: Must cover late blight, powdery mildew, rust
      expect(DISEASE_THRESHOLDS[DiseaseName.LATE_BLIGHT]).toBeDefined();
      expect(DISEASE_THRESHOLDS[DiseaseName.POWDERY_MILDEW]).toBeDefined();
      expect(DISEASE_THRESHOLDS[DiseaseName.RUST]).toBeDefined();

      // Additional common diseases
      expect(DISEASE_THRESHOLDS[DiseaseName.EARLY_BLIGHT]).toBeDefined();
      expect(DISEASE_THRESHOLDS[DiseaseName.DOWNY_MILDEW]).toBeDefined();
      expect(DISEASE_THRESHOLDS[DiseaseName.ANTHRACNOSE]).toBeDefined();
    });
  });

  describe('getDiseasesForCrop', () => {
    test('returns diseases for tomato', () => {
      const diseases = getDiseasesForCrop(CropType.TOMATO);

      expect(diseases).toContain(DiseaseName.LATE_BLIGHT);
      expect(diseases).toContain(DiseaseName.EARLY_BLIGHT);
      expect(diseases).toContain(DiseaseName.POWDERY_MILDEW);
      expect(diseases).toContain(DiseaseName.SEPTORIA_LEAF_SPOT);
      expect(diseases).toContain(DiseaseName.ANTHRACNOSE);
      expect(diseases).toContain(DiseaseName.FUSARIUM_WILT);
    });

    test('returns diseases for potato', () => {
      const diseases = getDiseasesForCrop(CropType.POTATO);

      expect(diseases).toContain(DiseaseName.LATE_BLIGHT);
      expect(diseases).toContain(DiseaseName.EARLY_BLIGHT);
    });

    test('returns diseases for wheat', () => {
      const diseases = getDiseasesForCrop(CropType.WHEAT);

      expect(diseases).toContain(DiseaseName.POWDERY_MILDEW);
      expect(diseases).toContain(DiseaseName.RUST);
      expect(diseases).toContain(DiseaseName.BACTERIAL_BLIGHT);
    });

    test('returns diseases for corn', () => {
      const diseases = getDiseasesForCrop(CropType.CORN);

      expect(diseases).toContain(DiseaseName.RUST);
      expect(diseases).toContain(DiseaseName.GRAY_LEAF_SPOT);
      expect(diseases).toContain(DiseaseName.NORTHERN_CORN_LEAF_BLIGHT);
      expect(diseases).toContain(DiseaseName.SOUTHERN_CORN_LEAF_BLIGHT);
      expect(diseases).toContain(DiseaseName.COMMON_RUST_CORN);
    });

    test('returns diseases for soybean', () => {
      const diseases = getDiseasesForCrop(CropType.SOYBEAN);

      expect(diseases).toContain(DiseaseName.RUST);
      expect(diseases).toContain(DiseaseName.ANTHRACNOSE);
      expect(diseases).toContain(DiseaseName.DOWNY_MILDEW);
      expect(diseases).toContain(DiseaseName.FROGEYE_LEAF_SPOT);
      expect(diseases).toContain(DiseaseName.BROWN_SPOT);
      expect(diseases).toContain(DiseaseName.BACTERIAL_BLIGHT);
    });

    test('returns diseases for grape', () => {
      const diseases = getDiseasesForCrop(CropType.GRAPE);

      expect(diseases).toContain(DiseaseName.POWDERY_MILDEW);
      expect(diseases).toContain(DiseaseName.DOWNY_MILDEW);
      expect(diseases).toContain(DiseaseName.BLACK_ROT);
      expect(diseases).toContain(DiseaseName.BOTRYTIS_BUNCH_ROT);
    });

    test('returns diseases for apple', () => {
      const diseases = getDiseasesForCrop(CropType.APPLE);

      expect(diseases).toContain(DiseaseName.APPLE_SCAB);
      expect(diseases).toContain(DiseaseName.FIRE_BLIGHT);
      expect(diseases).toContain(DiseaseName.CEDAR_APPLE_RUST);
    });

    test('returns only relevant diseases for each crop', () => {
      const tomatoDiseases = getDiseasesForCrop(CropType.TOMATO);
      const appleDiseases = getDiseasesForCrop(CropType.APPLE);

      // Apple-specific diseases should not appear in tomato diseases
      expect(tomatoDiseases).not.toContain(DiseaseName.APPLE_SCAB);
      expect(tomatoDiseases).not.toContain(DiseaseName.FIRE_BLIGHT);

      // Tomato-specific diseases should not appear in apple diseases
      expect(appleDiseases).not.toContain(DiseaseName.SEPTORIA_LEAF_SPOT);
      expect(appleDiseases).not.toContain(DiseaseName.FUSARIUM_WILT);
    });
  });

  describe('getDiseaseThreshold', () => {
    test('returns threshold for valid disease', () => {
      const threshold = getDiseaseThreshold(DiseaseName.LATE_BLIGHT);

      expect(threshold).toBeDefined();
      expect(threshold?.tempMin).toBe(10);
      expect(threshold?.tempMax).toBe(25);
    });

    test('returns undefined for invalid disease', () => {
      const threshold = getDiseaseThreshold('invalidDisease' as DiseaseName);

      expect(threshold).toBeUndefined();
    });
  });

  describe('isDiseaseRelevantToCrop', () => {
    test('returns true for relevant disease-crop combinations', () => {
      expect(isDiseaseRelevantToCrop(DiseaseName.LATE_BLIGHT, CropType.TOMATO)).toBe(true);
      expect(isDiseaseRelevantToCrop(DiseaseName.LATE_BLIGHT, CropType.POTATO)).toBe(true);
      expect(isDiseaseRelevantToCrop(DiseaseName.APPLE_SCAB, CropType.APPLE)).toBe(true);
      expect(isDiseaseRelevantToCrop(DiseaseName.RUST, CropType.WHEAT)).toBe(true);
    });

    test('returns false for irrelevant disease-crop combinations', () => {
      expect(isDiseaseRelevantToCrop(DiseaseName.LATE_BLIGHT, CropType.APPLE)).toBe(false);
      expect(isDiseaseRelevantToCrop(DiseaseName.APPLE_SCAB, CropType.TOMATO)).toBe(false);
      expect(isDiseaseRelevantToCrop(DiseaseName.FUSARIUM_WILT, CropType.WHEAT)).toBe(false);
    });
  });

  describe('getAllCropTypes', () => {
    test('returns all crop types', () => {
      const crops = getAllCropTypes();

      expect(crops).toContain(CropType.TOMATO);
      expect(crops).toContain(CropType.POTATO);
      expect(crops).toContain(CropType.WHEAT);
      expect(crops).toContain(CropType.CORN);
      expect(crops).toContain(CropType.SOYBEAN);
      expect(crops).toContain(CropType.GRAPE);
      expect(crops).toContain(CropType.APPLE);
      expect(crops.length).toBe(7);
    });
  });

  describe('getAllDiseaseNames', () => {
    test('returns all disease names', () => {
      const diseases = getAllDiseaseNames();

      expect(diseases).toContain(DiseaseName.LATE_BLIGHT);
      expect(diseases).toContain(DiseaseName.POWDERY_MILDEW);
      expect(diseases).toContain(DiseaseName.RUST);
      expect(diseases.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('getHumanReadableDiseaseName', () => {
    test('returns human-readable disease names', () => {
      expect(getHumanReadableDiseaseName(DiseaseName.LATE_BLIGHT)).toBe('Late Blight');
      expect(getHumanReadableDiseaseName(DiseaseName.POWDERY_MILDEW)).toBe('Powdery Mildew');
      expect(getHumanReadableDiseaseName(DiseaseName.RUST)).toBe('Rust');
      expect(getHumanReadableDiseaseName(DiseaseName.APPLE_SCAB)).toBe('Apple Scab');
    });

    test('returns original name for unmapped diseases', () => {
      const unknownDisease = 'unknownDisease' as DiseaseName;
      expect(getHumanReadableDiseaseName(unknownDisease)).toBe(unknownDisease);
    });
  });

  describe('getHumanReadableCropName', () => {
    test('returns human-readable crop names', () => {
      expect(getHumanReadableCropName(CropType.TOMATO)).toBe('Tomato');
      expect(getHumanReadableCropName(CropType.POTATO)).toBe('Potato');
      expect(getHumanReadableCropName(CropType.WHEAT)).toBe('Wheat');
      expect(getHumanReadableCropName(CropType.CORN)).toBe('Corn');
      expect(getHumanReadableCropName(CropType.SOYBEAN)).toBe('Soybean');
      expect(getHumanReadableCropName(CropType.GRAPE)).toBe('Grape');
      expect(getHumanReadableCropName(CropType.APPLE)).toBe('Apple');
    });

    test('returns original name for unmapped crops', () => {
      const unknownCrop = 'unknownCrop' as CropType;
      expect(getHumanReadableCropName(unknownCrop)).toBe(unknownCrop);
    });
  });

  describe('Temperature range validation', () => {
    test('all diseases have valid temperature ranges', () => {
      const diseases = getAllDiseaseNames();

      diseases.forEach(diseaseName => {
        const threshold = DISEASE_THRESHOLDS[diseaseName];

        // Temperature ranges should be within realistic bounds
        expect(threshold.tempMin).toBeGreaterThanOrEqual(-10);
        expect(threshold.tempMin).toBeLessThanOrEqual(40);
        expect(threshold.tempMax).toBeGreaterThanOrEqual(-10);
        expect(threshold.tempMax).toBeLessThanOrEqual(50);

        // Min should be less than max
        expect(threshold.tempMin).toBeLessThan(threshold.tempMax);

        // Optimal should be within range
        expect(threshold.optimalTemp).toBeGreaterThanOrEqual(threshold.tempMin);
        expect(threshold.optimalTemp).toBeLessThanOrEqual(threshold.tempMax);
      });
    });
  });

  describe('Wetness hours validation', () => {
    test('all diseases have valid wetness hour requirements', () => {
      const diseases = getAllDiseaseNames();

      diseases.forEach(diseaseName => {
        const threshold = DISEASE_THRESHOLDS[diseaseName];

        // Wetness hours should be non-negative
        expect(threshold.minWetnessHours).toBeGreaterThanOrEqual(0);

        // Wetness hours should be realistic (0-72 hours)
        expect(threshold.minWetnessHours).toBeLessThanOrEqual(72);
      });
    });
  });

  describe('Crop coverage', () => {
    test('all supported crops have at least one disease', () => {
      const crops = getAllCropTypes();

      crops.forEach(crop => {
        const diseases = getDiseasesForCrop(crop);
        expect(diseases.length).toBeGreaterThan(0);
      });
    });

    test('each crop has multiple diseases for comprehensive risk assessment', () => {
      expect(getDiseasesForCrop(CropType.TOMATO).length).toBeGreaterThanOrEqual(3);
      expect(getDiseasesForCrop(CropType.POTATO).length).toBeGreaterThanOrEqual(2);
      expect(getDiseasesForCrop(CropType.WHEAT).length).toBeGreaterThanOrEqual(2);
      expect(getDiseasesForCrop(CropType.CORN).length).toBeGreaterThanOrEqual(3);
      expect(getDiseasesForCrop(CropType.SOYBEAN).length).toBeGreaterThanOrEqual(3);
      expect(getDiseasesForCrop(CropType.GRAPE).length).toBeGreaterThanOrEqual(3);
      expect(getDiseasesForCrop(CropType.APPLE).length).toBeGreaterThanOrEqual(3);
    });
  });
});
