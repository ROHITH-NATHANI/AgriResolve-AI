/**
 * Unit Tests for Chemical Safety Checker
 * 
 * Tests specific chemical variations and edge cases.
 * Requirements: 13.2, 13.3
 */

import { ChemicalSafetyChecker } from '../chemicalSafetyChecker.js';

describe('ChemicalSafetyChecker - Unit Tests', () => {
  const checker = new ChemicalSafetyChecker();

  /**
   * Requirement 13.2: Recognize "ml", "milliliter", and "millilitre" as equivalent
   */
  describe('Volume unit detection', () => {
    test('detects "ml" as volume unit', () => {
      expect(checker.hasVolumeUnits('apply 50 ml of solution')).toBe(true);
      expect(checker.hasVolumeUnits('use 100ml per acre')).toBe(true);
    });

    test('detects "milliliter" as volume unit', () => {
      expect(checker.hasVolumeUnits('apply 50 milliliter of solution')).toBe(true);
      expect(checker.hasVolumeUnits('use 100 milliliters per acre')).toBe(true);
    });

    test('detects "millilitre" as volume unit', () => {
      expect(checker.hasVolumeUnits('apply 50 millilitre of solution')).toBe(true);
      expect(checker.hasVolumeUnits('use 100 millilitres per acre')).toBe(true);
    });

    test('detects "mL" (capital L) as volume unit', () => {
      expect(checker.hasVolumeUnits('apply 50 mL of solution')).toBe(true);
    });

    test('does not detect volume units in text without them', () => {
      expect(checker.hasVolumeUnits('water the plants')).toBe(false);
      expect(checker.hasVolumeUnits('apply fertilizer')).toBe(false);
    });
  });

  /**
   * Requirement 13.3: Recognize "g", "gram", and "gramme" as equivalent
   */
  describe('Mass unit detection', () => {
    test('detects "g" as mass unit', () => {
      expect(checker.hasMassUnits('apply 50 g of powder')).toBe(true);
      expect(checker.hasMassUnits('use 100g per acre')).toBe(true);
    });

    test('detects "gram" as mass unit', () => {
      expect(checker.hasMassUnits('apply 50 gram of powder')).toBe(true);
      expect(checker.hasMassUnits('use 100 grams per acre')).toBe(true);
    });

    test('detects "gramme" as mass unit', () => {
      expect(checker.hasMassUnits('apply 50 gramme of powder')).toBe(true);
      expect(checker.hasMassUnits('use 100 grammes per acre')).toBe(true);
    });

    test('detects "gm" as mass unit', () => {
      expect(checker.hasMassUnits('apply 50 gm of powder')).toBe(true);
    });

    test('does not detect mass units in text without them', () => {
      expect(checker.hasMassUnits('water the plants')).toBe(false);
      expect(checker.hasMassUnits('apply fertilizer')).toBe(false);
    });
  });

  /**
   * Requirement 13.1: Detect paraquat and gramoxone synonym
   */
  describe('Paraquat synonym detection', () => {
    test('detects "paraquat" as banned chemical', () => {
      const result = checker.checkInput('use paraquat for weed control');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals.length).toBe(1);
      expect(result.detectedChemicals[0].name).toBe('paraquat');
      expect(result.detectedChemicals[0].restrictionLevel).toBe('banned');
    });

    test('detects "gramoxone" as paraquat synonym', () => {
      const result = checker.checkInput('use gramoxone for weed control');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals.length).toBe(1);
      expect(result.detectedChemicals[0].variations).toContain('gramoxone');
      expect(result.detectedChemicals[0].restrictionLevel).toBe('banned');
    });

    test('detects "para-quat" as paraquat variation', () => {
      const result = checker.checkInput('use para-quat for weed control');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].variations).toContain('para-quat');
    });
  });

  /**
   * Requirement 13.1: Detect chlorpyrifos variations
   */
  describe('Chlorpyrifos variation detection', () => {
    test('detects "chlorpyrifos" as restricted chemical', () => {
      const result = checker.checkInput('apply chlorpyrifos to crops');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].name).toBe('chlorpyrifos');
      expect(result.detectedChemicals[0].restrictionLevel).toBe('restricted');
    });

    test('detects "dursban" as chlorpyrifos synonym', () => {
      const result = checker.checkInput('apply dursban to crops');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].variations).toContain('dursban');
    });

    test('detects "lorsban" as chlorpyrifos synonym', () => {
      const result = checker.checkInput('apply lorsban to crops');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].variations).toContain('lorsban');
    });

    test('detects "chlorpyriphos" as misspelling', () => {
      const result = checker.checkInput('apply chlorpyriphos to crops');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].variations).toContain('chlorpyriphos');
    });

    test('detects "chloropyrifos" as misspelling', () => {
      const result = checker.checkInput('apply chloropyrifos to crops');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals[0].variations).toContain('chloropyrifos');
    });
  });

  /**
   * Test disclaimer is always included
   */
  describe('Disclaimer', () => {
    test('includes disclaimer when chemicals detected', () => {
      const result = checker.checkInput('use paraquat');

      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer).toContain('incomplete');
      expect(result.disclaimer).toContain('consult');
    });

    test('includes disclaimer even when no chemicals detected', () => {
      const result = checker.checkInput('water the plants');

      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer).toContain('incomplete');
    });
  });

  /**
   * Test warnings are generated correctly
   */
  describe('Warnings', () => {
    test('generates warning for banned chemical', () => {
      const result = checker.checkInput('use paraquat');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('banned');
    });

    test('generates warning for restricted chemical', () => {
      const result = checker.checkInput('use chlorpyrifos');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('restrictions');
    });

    test('generates no warnings for safe text', () => {
      const result = checker.checkInput('water the plants daily');

      expect(result.warnings.length).toBe(0);
    });
  });

  /**
   * Test multiple chemical detection
   */
  describe('Multiple chemical detection', () => {
    test('detects multiple chemicals in same text', () => {
      const result = checker.checkInput('use paraquat and chlorpyrifos together');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals.length).toBe(2);
      expect(result.warnings.length).toBe(2);
    });

    test('detects chemicals with units', () => {
      const result = checker.checkInput('apply 50 ml of paraquat and 100 g of chlorpyrifos');

      expect(result.hasRestrictedChemicals).toBe(true);
      expect(result.detectedChemicals.length).toBe(2);
      expect(checker.hasVolumeUnits('apply 50 ml of paraquat')).toBe(true);
      expect(checker.hasMassUnits('100 g of chlorpyrifos')).toBe(true);
    });
  });

  /**
   * Test case insensitivity
   */
  describe('Case insensitivity', () => {
    test('detects chemicals regardless of case', () => {
      const testCases = [
        'paraquat',
        'PARAQUAT',
        'Paraquat',
        'PaRaQuAt',
        'GRAMOXONE',
        'Gramoxone'
      ];

      testCases.forEach(text => {
        const result = checker.checkInput(text);
        expect(result.hasRestrictedChemicals).toBe(true);
      });
    });
  });

  /**
   * Test detectVariations method
   */
  describe('detectVariations method', () => {
    test('returns all variations for known chemical', () => {
      const variations = checker.detectVariations('paraquat');

      expect(variations).toContain('paraquat');
      expect(variations).toContain('gramoxone');
      expect(variations.length).toBeGreaterThan(1);
    });

    test('returns variations for unknown chemical', () => {
      const variations = checker.detectVariations('unknownchemical');

      expect(variations).toContain('unknownchemical');
      expect(variations.length).toBeGreaterThan(0);
    });
  });
});
