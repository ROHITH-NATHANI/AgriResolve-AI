/**
 * Property-Based Tests for Chemical Safety Checker
 * 
 * **Property 34: Chemical variation detection**
 * **Property 35: Consistent warnings for chemical variations**
 * **Validates: Requirements 13.1, 13.5**
 */

import * as fc from 'fast-check';
import { ChemicalSafetyChecker, DetectedChemical } from '../chemicalSafetyChecker.js';

describe('ChemicalSafetyChecker - Property Tests', () => {
  const checker = new ChemicalSafetyChecker();

  /**
   * Property 34: Chemical variation detection
   * 
   * For any restricted chemical with known spelling variations or synonyms,
   * the chemical safety checker should detect all variations when present in user input.
   * 
   * **Validates: Requirements 13.1**
   */
  describe('Property 34: Chemical variation detection', () => {
    test('detects paraquat and its variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('paraquat', 'gramoxone', 'para-quat', 'paraqat', 'paraquot'),
          fc.constantFrom('', ' ', '  ', '\n', '\t'),
          fc.constantFrom('', 'use ', 'apply ', 'spray '),
          fc.constantFrom('', ' ml', ' grams', ' liters'),
          (chemical, whitespace1, prefix, suffix) => {
            const text = `${prefix}${chemical}${whitespace1}${suffix}`;
            const result = checker.checkInput(text);

            // Should detect the chemical
            expect(result.hasRestrictedChemicals).toBe(true);
            expect(result.detectedChemicals.length).toBeGreaterThan(0);

            // Should identify it as paraquat (primary name)
            const detected = result.detectedChemicals.find((c: DetectedChemical) =>
              c.name === 'paraquat' || c.variations.includes('paraquat')
            );
            expect(detected).toBeDefined();
            expect(detected?.restrictionLevel).toBe('banned');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detects chlorpyrifos and its variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('chlorpyrifos', 'dursban', 'lorsban', 'chlorpyriphos', 'chloropyrifos'),
          fc.constantFrom('', ' ', '  '),
          fc.constantFrom('', 'use ', 'apply '),
          (chemical, whitespace, prefix) => {
            const text = `${prefix}${chemical}${whitespace}`;
            const result = checker.checkInput(text);

            // Should detect the chemical
            expect(result.hasRestrictedChemicals).toBe(true);

            // Should identify it as chlorpyrifos
            const detected = result.detectedChemicals.find((c: DetectedChemical) =>
              c.name === 'chlorpyrifos' || c.variations.includes('chlorpyrifos')
            );
            expect(detected).toBeDefined();
            expect(detected?.restrictionLevel).toBe('restricted');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detects glyphosate and its variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('glyphosate', 'roundup', 'glyfosate', 'gliphosate'),
          fc.string({ minLength: 0, maxLength: 20 }),
          (chemical, surroundingText) => {
            const text = `${surroundingText} ${chemical} ${surroundingText}`;
            const result = checker.checkInput(text);

            // Should detect the chemical
            expect(result.hasRestrictedChemicals).toBe(true);

            // Should identify it as glyphosate
            const detected = result.detectedChemicals.find((c: DetectedChemical) =>
              c.name === 'glyphosate' || c.variations.includes('glyphosate')
            );
            expect(detected).toBeDefined();
            expect(detected?.restrictionLevel).toBe('caution');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 35: Consistent warnings for chemical variations
   * 
   * For any detected chemical variation or synonym, the system should apply
   * the same safety warnings as the primary chemical name.
   * 
   * **Validates: Requirements 13.5**
   */
  describe('Property 35: Consistent warnings for chemical variations', () => {
    test('all variations of paraquat produce the same warning', () => {
      const variations = ['paraquat', 'gramoxone', 'para-quat'];
      const results = variations.map(v => checker.checkInput(v));

      // All should detect a restricted chemical
      results.forEach(result => {
        expect(result.hasRestrictedChemicals).toBe(true);
      });

      // All should have the same restriction level
      const restrictionLevels = results.map(r => r.detectedChemicals[0]?.restrictionLevel);
      expect(new Set(restrictionLevels).size).toBe(1);
      expect(restrictionLevels[0]).toBe('banned');

      // All should have the same recommendation
      const recommendations = results.map(r => r.detectedChemicals[0]?.recommendation);
      expect(new Set(recommendations).size).toBe(1);
    });

    test('all variations of chlorpyrifos produce the same warning', () => {
      const variations = ['chlorpyrifos', 'dursban', 'lorsban'];
      const results = variations.map(v => checker.checkInput(v));

      // All should detect a restricted chemical
      results.forEach(result => {
        expect(result.hasRestrictedChemicals).toBe(true);
      });

      // All should have the same restriction level
      const restrictionLevels = results.map(r => r.detectedChemicals[0]?.restrictionLevel);
      expect(new Set(restrictionLevels).size).toBe(1);
      expect(restrictionLevels[0]).toBe('restricted');

      // All should have the same recommendation
      const recommendations = results.map(r => r.detectedChemicals[0]?.recommendation);
      expect(new Set(recommendations).size).toBe(1);
    });

    test('case variations produce consistent warnings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('paraquat', 'PARAQUAT', 'Paraquat', 'PaRaQuAt'),
          (chemical) => {
            const result = checker.checkInput(chemical);

            // Should always detect regardless of case
            expect(result.hasRestrictedChemicals).toBe(true);
            expect(result.detectedChemicals[0]?.restrictionLevel).toBe('banned');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('whitespace variations produce consistent warnings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('paraquat', ' paraquat', 'paraquat ', ' paraquat ', '  paraquat  '),
          (chemical) => {
            const result = checker.checkInput(chemical);

            // Should always detect regardless of whitespace
            expect(result.hasRestrictedChemicals).toBe(true);
            expect(result.detectedChemicals[0]?.restrictionLevel).toBe('banned');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Disclaimer is always present
   */
  test('disclaimer is always present in results', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (text) => {
          const result = checker.checkInput(text);

          // Disclaimer should always be present
          expect(result.disclaimer).toBeDefined();
          expect(result.disclaimer.length).toBeGreaterThan(0);
          expect(result.disclaimer).toContain('incomplete');
          expect(result.disclaimer).toContain('consult');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: No false positives for safe text
   */
  test('does not detect chemicals in safe agricultural text', () => {
    const safeTexts = [
      'water the plants daily',
      'apply organic fertilizer',
      'prune the branches',
      'harvest the crops',
      'till the soil',
      'plant the seeds',
      'irrigate the field'
    ];

    safeTexts.forEach(text => {
      const result = checker.checkInput(text);
      expect(result.hasRestrictedChemicals).toBe(false);
      expect(result.detectedChemicals.length).toBe(0);
    });
  });
});
