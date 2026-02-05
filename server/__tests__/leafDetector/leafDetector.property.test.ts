/**
 * Property-based tests for LeafDetector class
 * 
 * These tests verify universal properties across randomized inputs:
 * - Property 7: Healthy leaf hue range detection
 * - Property 8: Diseased leaf hue range detection
 * - Property 9: Pixel filtering criteria
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * 
 * Feature: agricultural-accuracy-and-security-fixes
 */

import * as fc from 'fast-check';
import { LeafDetector, HSVPixel } from '../../services/leafDetector.js';

describe('LeafDetector - Property-Based Tests', () => {
  let detector: LeafDetector;

  beforeEach(() => {
    detector = new LeafDetector();
  });

  /**
   * Property 7: Healthy leaf hue range detection
   * 
   * For any image pixel with hue value between 70 and 170 degrees
   * (and meeting saturation/brightness criteria), the pixel should be
   * classified as a candidate healthy leaf region.
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 7: Healthy leaf hue range detection', () => {
    it('should classify pixels with hue 70-170° and valid saturation/brightness as healthy leaves', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 170, noNaN: true }), // hue in healthy range
          fc.double({ min: 20, max: 100, noNaN: true }), // saturation >= 20%
          fc.double({ min: 15, max: 95, noNaN: true }),  // brightness 15-95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };
            const result = detector.isHealthyLeaf(hsv);

            // Should be classified as healthy leaf
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT classify pixels with hue outside 70-170° as healthy leaves', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: 0, max: 69.99, noNaN: true }),    // below range
            fc.double({ min: 170.01, max: 360, noNaN: true })  // above range
          ),
          fc.double({ min: 20, max: 100, noNaN: true }), // saturation >= 20%
          fc.double({ min: 15, max: 95, noNaN: true }),  // brightness 15-95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };
            const result = detector.isHealthyLeaf(hsv);

            // Should NOT be classified as healthy leaf (wrong hue)
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Diseased leaf hue range detection
   * 
   * For any image pixel with hue value between 35 and 70 degrees
   * (and meeting saturation/brightness criteria), the pixel should be
   * classified as a candidate diseased leaf region.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 8: Diseased leaf hue range detection', () => {
    it('should classify pixels with hue 35-70° and valid saturation/brightness as diseased leaves', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 35, max: 70, noNaN: true }),  // hue in diseased range
          fc.double({ min: 20, max: 100, noNaN: true }), // saturation >= 20%
          fc.double({ min: 15, max: 95, noNaN: true }),  // brightness 15-95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };
            const result = detector.isDiseasedLeaf(hsv);

            // Should be classified as diseased leaf
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT classify pixels with hue outside 35-70° as diseased leaves', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: 0, max: 34.99, noNaN: true }),   // below range
            fc.double({ min: 70.01, max: 360, noNaN: true })  // above range
          ),
          fc.double({ min: 20, max: 100, noNaN: true }), // saturation >= 20%
          fc.double({ min: 15, max: 95, noNaN: true }),  // brightness 15-95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };
            const result = detector.isDiseasedLeaf(hsv);

            // Should NOT be classified as diseased leaf (wrong hue)
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Pixel filtering criteria
   * 
   * For any candidate leaf pixel, if its saturation is below 20% OR
   * its brightness is below 15% OR above 95%, it should be excluded
   * from leaf regions.
   * 
   * **Validates: Requirements 3.3, 3.4**
   */
  describe('Property 9: Pixel filtering criteria', () => {
    it('should reject pixels with saturation below 20%', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 170, noNaN: true }),  // valid healthy hue
          fc.double({ min: 0, max: 19.99, noNaN: true }), // saturation < 20%
          fc.double({ min: 15, max: 95, noNaN: true }),   // valid brightness
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };

            // Should fail saturation filter
            expect(detector.passesSaturationFilter(hsv)).toBe(false);

            // Should NOT be classified as healthy leaf
            expect(detector.isHealthyLeaf(hsv)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pixels with brightness below 15%', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 170, noNaN: true }),  // valid healthy hue
          fc.double({ min: 20, max: 100, noNaN: true }),  // valid saturation
          fc.double({ min: 0, max: 14.99, noNaN: true }), // brightness < 15%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };

            // Should fail brightness filter
            expect(detector.passesBrightnessFilter(hsv)).toBe(false);

            // Should NOT be classified as healthy leaf
            expect(detector.isHealthyLeaf(hsv)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pixels with brightness above 95%', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 170, noNaN: true }),    // valid healthy hue
          fc.double({ min: 20, max: 100, noNaN: true }),    // valid saturation
          fc.double({ min: 95.01, max: 100, noNaN: true }), // brightness > 95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };

            // Should fail brightness filter
            expect(detector.passesBrightnessFilter(hsv)).toBe(false);

            // Should NOT be classified as healthy leaf
            expect(detector.isHealthyLeaf(hsv)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept pixels meeting all criteria (saturation >= 20%, brightness 15-95%)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 70, max: 170, noNaN: true }),  // valid healthy hue
          fc.double({ min: 20, max: 100, noNaN: true }),  // saturation >= 20%
          fc.double({ min: 15, max: 95, noNaN: true }),   // brightness 15-95%
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };

            // Should pass both filters
            expect(detector.passesSaturationFilter(hsv)).toBe(true);
            expect(detector.passesBrightnessFilter(hsv)).toBe(true);

            // Should be classified as healthy leaf
            expect(detector.isHealthyLeaf(hsv)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply same filtering criteria to diseased leaf detection', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 35, max: 70, noNaN: true }),   // valid diseased hue
          fc.double({ min: 0, max: 100, noNaN: true }),   // any saturation
          fc.double({ min: 0, max: 100, noNaN: true }),   // any brightness
          (hue, saturation, brightness) => {
            const hsv: HSVPixel = { h: hue, s: saturation, v: brightness };
            const result = detector.isDiseasedLeaf(hsv);

            // Should only be true if saturation and brightness pass filters
            const shouldPass = saturation >= 20 && brightness >= 15 && brightness <= 95;
            expect(result).toBe(shouldPass);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: HSV conversion should preserve color information
   */
  describe('HSV conversion properties', () => {
    it('should produce hue values in range 0-360', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // r
          fc.integer({ min: 0, max: 255 }), // g
          fc.integer({ min: 0, max: 255 }), // b
          (r, g, b) => {
            const hsv = detector.convertToHSV({ r, g, b });

            // Hue should be in valid range
            expect(hsv.h).toBeGreaterThanOrEqual(0);
            expect(hsv.h).toBeLessThan(360);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce saturation values in range 0-100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // r
          fc.integer({ min: 0, max: 255 }), // g
          fc.integer({ min: 0, max: 255 }), // b
          (r, g, b) => {
            const hsv = detector.convertToHSV({ r, g, b });

            // Saturation should be in valid range
            expect(hsv.s).toBeGreaterThanOrEqual(0);
            expect(hsv.s).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce brightness values in range 0-100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }), // r
          fc.integer({ min: 0, max: 255 }), // g
          fc.integer({ min: 0, max: 255 }), // b
          (r, g, b) => {
            const hsv = detector.convertToHSV({ r, g, b });

            // Brightness should be in valid range
            expect(hsv.v).toBeGreaterThanOrEqual(0);
            expect(hsv.v).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: False positive rate threshold
   * 
   * For any set of test images containing non-leaf objects (soil, wood, background),
   * the leaf detector's false positive rate should be below 5%.
   * 
   * **Validates: Requirements 3.6**
   */
  describe('Property 10: False positive rate threshold', () => {
    it('should maintain false positive rate below 5% for images with non-leaf objects', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }), // image size
          fc.double({ min: 0, max: 1, noNaN: true }), // ratio of non-leaf pixels
          (size, nonLeafRatio) => {
            // Create an image with mix of leaf and non-leaf pixels
            const pixels: any[] = [];
            const totalPixels = size * size;
            const nonLeafCount = Math.floor(totalPixels * nonLeafRatio);

            // Add non-leaf pixels (gray/brown colors that might be confused with leaves)
            for (let i = 0; i < nonLeafCount; i++) {
              // Gray pixels (low saturation - should be filtered)
              pixels.push({ r: 100, g: 100, b: 100 });
            }

            // Add leaf pixels (green with good saturation)
            for (let i = nonLeafCount; i < totalPixels; i++) {
              const greenValue = 180 + (i % 40);
              pixels.push({ r: 0, g: greenValue, b: 0 });
            }

            const image = {
              width: size,
              height: size,
              pixels,
            };

            const result = detector.detectLeaves(image);

            // False positive rate should be below 5% (0.05)
            expect(result.falsePositiveRate).toBeLessThanOrEqual(0.05);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report zero false positive rate when no regions are detected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }), // image size
          (size) => {
            // Create an image with only non-leaf pixels (gray)
            const pixels: any[] = [];
            for (let i = 0; i < size * size; i++) {
              pixels.push({ r: 128, g: 128, b: 128 });
            }

            const image = {
              width: size,
              height: size,
              pixels,
            };

            const result = detector.detectLeaves(image);

            // Should have zero false positive rate when nothing detected
            expect(result.falsePositiveRate).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain low false positive rate with varying image sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }), // width
          fc.integer({ min: 10, max: 100 }), // height
          (width, height) => {
            // Create an image with leaf pixels in center
            const pixels: any[] = [];
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            const leafRadius = Math.min(width, height) / 4;

            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < leafRadius) {
                  // Leaf pixels in center
                  const greenValue = 180 + ((x + y) % 40);
                  pixels.push({ r: 0, g: greenValue, b: 0 });
                } else {
                  // Background pixels
                  pixels.push({ r: 128, g: 128, b: 128 });
                }
              }
            }

            const image = {
              width,
              height,
              pixels,
            };

            const result = detector.detectLeaves(image);

            // False positive rate should be below 5%
            expect(result.falsePositiveRate).toBeLessThanOrEqual(0.05);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
