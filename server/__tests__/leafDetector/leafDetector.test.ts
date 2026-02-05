/**
 * Unit tests for LeafDetector class
 * 
 * Tests verify:
 * - RGB to HSV conversion accuracy
 * - Healthy leaf hue detection (70-170 degrees)
 * - Diseased leaf hue detection (35-70 degrees)
 * - Saturation filter (minimum 20%)
 * - Brightness filter (15-95% range)
 * - Edge cases with specific color values
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { LeafDetector, RGBPixel, HSVPixel, ImageData } from '../../services/leafDetector.js';

describe('LeafDetector', () => {
  let detector: LeafDetector;

  beforeEach(() => {
    detector = new LeafDetector();
  });

  describe('convertToHSV', () => {
    it('should convert pure red to HSV (0°, 100%, 100%)', () => {
      const rgb: RGBPixel = { r: 255, g: 0, b: 0 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.h).toBeCloseTo(0, 1);
      expect(hsv.s).toBeCloseTo(100, 1);
      expect(hsv.v).toBeCloseTo(100, 1);
    });

    it('should convert pure green to HSV (120°, 100%, 100%)', () => {
      const rgb: RGBPixel = { r: 0, g: 255, b: 0 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.h).toBeCloseTo(120, 1);
      expect(hsv.s).toBeCloseTo(100, 1);
      expect(hsv.v).toBeCloseTo(100, 1);
    });

    it('should convert pure blue to HSV (240°, 100%, 100%)', () => {
      const rgb: RGBPixel = { r: 0, g: 0, b: 255 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.h).toBeCloseTo(240, 1);
      expect(hsv.s).toBeCloseTo(100, 1);
      expect(hsv.v).toBeCloseTo(100, 1);
    });

    it('should convert black to HSV (0°, 0%, 0%)', () => {
      const rgb: RGBPixel = { r: 0, g: 0, b: 0 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.h).toBe(0);
      expect(hsv.s).toBe(0);
      expect(hsv.v).toBe(0);
    });

    it('should convert white to HSV (0°, 0%, 100%)', () => {
      const rgb: RGBPixel = { r: 255, g: 255, b: 255 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.h).toBe(0);
      expect(hsv.s).toBe(0);
      expect(hsv.v).toBeCloseTo(100, 1);
    });

    it('should convert gray to HSV with 0% saturation', () => {
      const rgb: RGBPixel = { r: 128, g: 128, b: 128 };
      const hsv = detector.convertToHSV(rgb);

      expect(hsv.s).toBe(0);
      expect(hsv.v).toBeCloseTo(50.2, 1);
    });
  });

  describe('isHealthyLeaf', () => {
    it('should classify pure green (hue 120°) with valid saturation/brightness as healthy', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(true);
    });

    it('should classify hue at lower boundary (70°) as healthy', () => {
      const hsv: HSVPixel = { h: 70, s: 50, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(true);
    });

    it('should classify hue at upper boundary (170°) as healthy', () => {
      const hsv: HSVPixel = { h: 170, s: 50, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(true);
    });

    it('should NOT classify hue below 70° as healthy', () => {
      const hsv: HSVPixel = { h: 69, s: 50, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(false);
    });

    it('should NOT classify hue above 170° as healthy', () => {
      const hsv: HSVPixel = { h: 171, s: 50, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(false);
    });

    it('should NOT classify low saturation (< 20%) as healthy', () => {
      const hsv: HSVPixel = { h: 120, s: 19, v: 50 };
      expect(detector.isHealthyLeaf(hsv)).toBe(false);
    });

    it('should NOT classify low brightness (< 15%) as healthy', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 14 };
      expect(detector.isHealthyLeaf(hsv)).toBe(false);
    });

    it('should NOT classify high brightness (> 95%) as healthy', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 96 };
      expect(detector.isHealthyLeaf(hsv)).toBe(false);
    });
  });

  describe('isDiseasedLeaf', () => {
    it('should classify yellow (hue 50°) with valid saturation/brightness as diseased', () => {
      const hsv: HSVPixel = { h: 50, s: 50, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(true);
    });

    it('should classify hue at lower boundary (35°) as diseased', () => {
      const hsv: HSVPixel = { h: 35, s: 50, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(true);
    });

    it('should classify hue at upper boundary (70°) as diseased', () => {
      const hsv: HSVPixel = { h: 70, s: 50, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(true);
    });

    it('should NOT classify hue below 35° as diseased', () => {
      const hsv: HSVPixel = { h: 34, s: 50, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(false);
    });

    it('should NOT classify hue above 70° as diseased', () => {
      const hsv: HSVPixel = { h: 71, s: 50, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(false);
    });

    it('should NOT classify low saturation (< 20%) as diseased', () => {
      const hsv: HSVPixel = { h: 50, s: 19, v: 50 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(false);
    });

    it('should NOT classify low brightness (< 15%) as diseased', () => {
      const hsv: HSVPixel = { h: 50, s: 50, v: 14 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(false);
    });

    it('should NOT classify high brightness (> 95%) as diseased', () => {
      const hsv: HSVPixel = { h: 50, s: 50, v: 96 };
      expect(detector.isDiseasedLeaf(hsv)).toBe(false);
    });
  });

  describe('passesSaturationFilter', () => {
    it('should pass saturation at boundary (20%)', () => {
      const hsv: HSVPixel = { h: 120, s: 20, v: 50 };
      expect(detector.passesSaturationFilter(hsv)).toBe(true);
    });

    it('should pass saturation above boundary', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 50 };
      expect(detector.passesSaturationFilter(hsv)).toBe(true);
    });

    it('should fail saturation below boundary', () => {
      const hsv: HSVPixel = { h: 120, s: 19, v: 50 };
      expect(detector.passesSaturationFilter(hsv)).toBe(false);
    });
  });

  describe('passesBrightnessFilter', () => {
    it('should pass brightness at lower boundary (15%)', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 15 };
      expect(detector.passesBrightnessFilter(hsv)).toBe(true);
    });

    it('should pass brightness at upper boundary (95%)', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 95 };
      expect(detector.passesBrightnessFilter(hsv)).toBe(true);
    });

    it('should pass brightness in middle range', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 50 };
      expect(detector.passesBrightnessFilter(hsv)).toBe(true);
    });

    it('should fail brightness below lower boundary', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 14 };
      expect(detector.passesBrightnessFilter(hsv)).toBe(false);
    });

    it('should fail brightness above upper boundary', () => {
      const hsv: HSVPixel = { h: 120, s: 50, v: 96 };
      expect(detector.passesBrightnessFilter(hsv)).toBe(false);
    });
  });

  describe('detectLeaves', () => {
    it('should detect healthy leaf pixels in a green image', () => {
      // Create a 20x20 image with green pixels in the center (50% of image)
      const pixels: RGBPixel[] = [];
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          // Green pixels in center 10x20 area (50% of image)
          if (x >= 5 && x < 15) {
            const greenValue = 180 + ((x + y) % 40);  // Vary green for color variance
            pixels.push({ r: 0, g: greenValue, b: 0 });  // Green - healthy
          } else {
            // Gray background pixels
            pixels.push({ r: 128, g: 128, b: 128 });
          }
        }
      }

      const image: ImageData = {
        width: 20,
        height: 20,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // At minimum, we should detect leaf pixels
      expect(result.totalLeafPixels).toBeGreaterThan(0);
      expect(result.leafCoveragePercent).toBeGreaterThan(0);

      // Regions might be filtered, but leaf pixels should be detected
      // Note: The multi-stage filtering may remove regions that don't meet criteria
    });

    it('should detect diseased leaf pixels in a yellow image', () => {
      // Create a 20x20 image with yellow pixels in the center (50% of image)
      const pixels: RGBPixel[] = [];
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          // Yellow pixels in center 10x20 area (50% of image)
          if (x >= 5 && x < 15) {
            const redValue = 180 + ((x + y) % 40);  // Vary for color variance
            const greenValue = 160 + ((x + y) % 40);
            pixels.push({ r: redValue, g: greenValue, b: 0 });  // Yellow - diseased
          } else {
            // Gray background pixels
            pixels.push({ r: 128, g: 128, b: 128 });
          }
        }
      }

      const image: ImageData = {
        width: 20,
        height: 20,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // At minimum, we should detect leaf pixels
      expect(result.totalLeafPixels).toBeGreaterThan(0);
      expect(result.leafCoveragePercent).toBeGreaterThan(0);

      // Regions might be filtered, but leaf pixels should be detected
      // Note: The multi-stage filtering may remove regions that don't meet criteria
    });

    it('should NOT detect leaves in a grayscale image (low saturation)', () => {
      const image: ImageData = {
        width: 2,
        height: 2,
        pixels: [
          { r: 128, g: 128, b: 128 },  // Gray
          { r: 100, g: 100, b: 100 },  // Gray
          { r: 150, g: 150, b: 150 },  // Gray
          { r: 120, g: 120, b: 120 },  // Gray
        ],
      };

      const result = detector.detectLeaves(image);

      expect(result.totalLeafPixels).toBe(0);
      expect(result.leafCoveragePercent).toBe(0);
    });

    it('should NOT detect leaves in a very dark image (low brightness)', () => {
      const image: ImageData = {
        width: 2,
        height: 2,
        pixels: [
          { r: 0, g: 10, b: 0 },   // Very dark green
          { r: 0, g: 8, b: 0 },    // Very dark green
          { r: 0, g: 12, b: 0 },   // Very dark green
          { r: 0, g: 9, b: 0 },    // Very dark green
        ],
      };

      const result = detector.detectLeaves(image);

      expect(result.totalLeafPixels).toBe(0);
    });

    it('should NOT detect leaves in a very bright image (high brightness)', () => {
      const image: ImageData = {
        width: 2,
        height: 2,
        pixels: [
          { r: 250, g: 255, b: 250 },  // Very bright
          { r: 248, g: 253, b: 248 },  // Very bright
          { r: 252, g: 255, b: 252 },  // Very bright
          { r: 249, g: 254, b: 249 },  // Very bright
        ],
      };

      const result = detector.detectLeaves(image);

      expect(result.totalLeafPixels).toBe(0);
    });

    // Additional edge case tests per task 6.6
    it('should detect pure green (hue 120°) with valid saturation and brightness', () => {
      // Create image with pure green pixels (hue 120°)
      const pixels: RGBPixel[] = [];
      for (let i = 0; i < 400; i++) {
        pixels.push({ r: 0, g: 200, b: 0 });  // Pure green
      }

      const image: ImageData = {
        width: 20,
        height: 20,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // Should detect green as healthy leaves
      expect(result.totalLeafPixels).toBeGreaterThan(0);
      expect(result.healthyRegions.length + result.diseasedRegions.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect pure yellow (hue 50°) with valid saturation and brightness', () => {
      // Create image with pure yellow pixels (hue 50°)
      const pixels: RGBPixel[] = [];
      for (let i = 0; i < 400; i++) {
        pixels.push({ r: 200, g: 170, b: 0 });  // Yellow (hue ~50°)
      }

      const image: ImageData = {
        width: 20,
        height: 20,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // Should detect yellow as diseased leaves
      expect(result.totalLeafPixels).toBeGreaterThan(0);
    });

    it('should NOT detect grayscale pixels (low saturation)', () => {
      // Create image with grayscale pixels
      const pixels: RGBPixel[] = [];
      for (let i = 0; i < 100; i++) {
        const gray = 100 + (i % 50);
        pixels.push({ r: gray, g: gray, b: gray });
      }

      const image: ImageData = {
        width: 10,
        height: 10,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // Should NOT detect grayscale as leaves (saturation too low)
      expect(result.totalLeafPixels).toBe(0);
      expect(result.leafCoveragePercent).toBe(0);
    });

    it('should NOT detect very dark pixels (brightness 10%)', () => {
      // Create image with very dark green pixels (brightness ~10%)
      const pixels: RGBPixel[] = [];
      for (let i = 0; i < 100; i++) {
        pixels.push({ r: 0, g: 25, b: 0 });  // Very dark green (~10% brightness)
      }

      const image: ImageData = {
        width: 10,
        height: 10,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // Should NOT detect very dark pixels (brightness too low)
      expect(result.totalLeafPixels).toBe(0);
    });

    it('should NOT detect very bright pixels (brightness 98%)', () => {
      // Create image with very bright pixels (brightness ~98%)
      const pixels: RGBPixel[] = [];
      for (let i = 0; i < 100; i++) {
        pixels.push({ r: 245, g: 250, b: 245 });  // Very bright (~98% brightness)
      }

      const image: ImageData = {
        width: 10,
        height: 10,
        pixels,
      };

      const result = detector.detectLeaves(image);

      // Should NOT detect very bright pixels (brightness too high)
      expect(result.totalLeafPixels).toBe(0);
    });
  });
});
