/**
 * Chemical Safety Checker
 * 
 * Detects restricted chemicals and their variations/synonyms in user inputs.
 * Requirements: 13.1, 13.2, 13.3, 13.5
 */

/**
 * Restriction level for chemicals
 */
export type RestrictionLevel = 'banned' | 'restricted' | 'caution';

/**
 * Detected chemical information
 */
export interface DetectedChemical {
  name: string;
  variations: string[];
  restrictionLevel: RestrictionLevel;
  recommendation: string;
}

/**
 * Result of chemical safety check
 */
export interface ChemicalSafetyResult {
  hasRestrictedChemicals: boolean;
  detectedChemicals: DetectedChemical[];
  warnings: string[];
  disclaimer: string;
}

/**
 * Chemical pattern configuration
 */
interface ChemicalPattern {
  names: string[];
  level: RestrictionLevel;
  recommendation: string;
}

/**
 * CHEMICAL_PATTERNS constant with volume units, mass units, and restricted chemicals
 * 
 * Requirements:
 * - 13.1: Detect common spelling variations
 * - 13.2: Recognize "ml", "milliliter", and "millilitre" as equivalent
 * - 13.3: Recognize "g", "gram", and "gramme" as equivalent
 */
const CHEMICAL_PATTERNS = {
  // Requirement 13.2: Volume unit variations
  volumeUnits: ['ml', 'milliliter', 'millilitre', 'mL', 'millilitres', 'milliliters', 'millilitre', 'milliliter'],

  // Requirement 13.3: Mass unit variations
  massUnits: ['g', 'gram', 'gramme', 'grams', 'grammes', 'gm', 'grm'],

  // Requirement 13.1: Restricted chemicals with synonyms and variations
  restrictedChemicals: [
    {
      names: ['paraquat', 'gramoxone', 'para-quat', 'paraqat', 'paraquot'],
      level: 'banned' as RestrictionLevel,
      recommendation: 'This chemical is banned in many regions. Consult local authorities before use.'
    },
    {
      names: ['chlorpyrifos', 'dursban', 'lorsban', 'chlorpyriphos', 'chloropyrifos'],
      level: 'restricted' as RestrictionLevel,
      recommendation: 'This chemical has restrictions in many regions. Verify local regulations before use.'
    },
    {
      names: ['ddt', 'dichlorodiphenyltrichloroethane', 'dichloro-diphenyl-trichloroethane'],
      level: 'banned' as RestrictionLevel,
      recommendation: 'This chemical is banned internationally. Do not use under any circumstances.'
    },
    {
      names: ['endosulfan', 'thiodan', 'endosulphan'],
      level: 'banned' as RestrictionLevel,
      recommendation: 'This chemical is banned in most countries. Consult local authorities.'
    },
    {
      names: ['carbofuran', 'furadan', 'carbofuraan'],
      level: 'restricted' as RestrictionLevel,
      recommendation: 'This chemical is highly toxic and restricted. Use only with proper authorization.'
    },
    {
      names: ['monocrotophos', 'azodrin', 'monocrotofos'],
      level: 'banned' as RestrictionLevel,
      recommendation: 'This chemical is banned in many regions due to high toxicity.'
    },
    {
      names: ['methyl parathion', 'parathion-methyl', 'methylparathion'],
      level: 'banned' as RestrictionLevel,
      recommendation: 'This chemical is banned in most countries due to extreme toxicity.'
    },
    {
      names: ['phorate', 'thimet', 'forat'],
      level: 'restricted' as RestrictionLevel,
      recommendation: 'This chemical is highly toxic and restricted. Requires special handling.'
    },
    {
      names: ['aldicarb', 'temik', 'aldicarbe'],
      level: 'restricted' as RestrictionLevel,
      recommendation: 'This chemical is highly toxic and restricted in many regions.'
    },
    {
      names: ['glyphosate', 'roundup', 'glyfosate', 'gliphosate'],
      level: 'caution' as RestrictionLevel,
      recommendation: 'This chemical is under review in many regions. Follow label instructions carefully.'
    }
  ]
};

/**
 * ChemicalSafetyChecker class
 * 
 * Detects restricted chemicals and their variations in user inputs.
 */
export class ChemicalSafetyChecker {
  /**
   * Check user input for restricted chemicals
   * 
   * Requirements:
   * - 13.1: Detect common spelling variations
   * - 13.5: Apply same safety warnings for variations
   * 
   * @param text - User input text to check
   * @returns Chemical safety check result
   */
  checkInput(text: string): ChemicalSafetyResult {
    const normalizedText = text.toLowerCase();
    const detected: DetectedChemical[] = [];

    // Check for each restricted chemical and its variations
    for (const chemical of CHEMICAL_PATTERNS.restrictedChemicals) {
      const matchedVariations: string[] = [];

      for (const name of chemical.names) {
        // Check for exact match and common variations
        const patterns = this.generateSearchPatterns(name);

        for (const pattern of patterns) {
          if (normalizedText.includes(pattern)) {
            matchedVariations.push(name);
            break; // Found this variation, move to next
          }
        }
      }

      // If any variation was detected, add to results
      if (matchedVariations.length > 0) {
        detected.push({
          name: chemical.names[0], // Primary name
          variations: chemical.names,
          restrictionLevel: chemical.level,
          recommendation: chemical.recommendation
        });
      }
    }

    // Generate warnings
    const warnings = detected.map((c: DetectedChemical) => c.recommendation);

    return {
      hasRestrictedChemicals: detected.length > 0,
      detectedChemicals: detected,
      warnings,
      disclaimer: 'This database is incomplete. Always consult local agricultural extension offices before applying any chemicals.'
    };
  }

  /**
   * Detect chemical name variations
   * 
   * Requirement 13.1: Detect common spelling variations
   * 
   * @param chemicalName - Base chemical name
   * @returns Array of possible variations
   */
  detectVariations(chemicalName: string): string[] {
    const variations: string[] = [chemicalName.toLowerCase()];

    // Find if this chemical is in our database
    for (const chemical of CHEMICAL_PATTERNS.restrictedChemicals) {
      if (chemical.names.some(name => name.toLowerCase() === chemicalName.toLowerCase())) {
        return chemical.names;
      }
    }

    // If not in database, generate common variations
    variations.push(...this.generateCommonMisspellings(chemicalName));

    return variations;
  }

  /**
   * Generate search patterns for a chemical name
   * 
   * Includes the name itself and common variations
   * 
   * @param name - Chemical name
   * @returns Array of search patterns
   */
  private generateSearchPatterns(name: string): string[] {
    const patterns: string[] = [name.toLowerCase()];

    // Add patterns with spaces removed
    patterns.push(name.replace(/\s+/g, '').toLowerCase());
    patterns.push(name.replace(/-/g, '').toLowerCase());

    // Add common misspellings
    patterns.push(...this.generateCommonMisspellings(name));

    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Generate common misspellings for a chemical name
   * 
   * Requirement 13.1: Detect common spelling variations
   * 
   * @param name - Chemical name
   * @returns Array of common misspellings
   */
  private generateCommonMisspellings(name: string): string[] {
    const misspellings: string[] = [];
    const lower = name.toLowerCase();

    // Common letter substitutions
    const substitutions: Record<string, string[]> = {
      'ph': ['f'],
      'f': ['ph'],
      's': ['z'],
      'z': ['s'],
      'c': ['k'],
      'k': ['c'],
      'i': ['y'],
      'y': ['i']
    };

    // Apply substitutions
    for (const [from, toList] of Object.entries(substitutions)) {
      if (lower.includes(from)) {
        for (const to of toList) {
          misspellings.push(lower.replace(from, to));
        }
      }
    }

    // Double letter variations (e.g., "paraquat" -> "paraquatt")
    const doubleLetterPattern = /([a-z])\1/g;
    if (doubleLetterPattern.test(lower)) {
      // Remove double letters
      misspellings.push(lower.replace(/([a-z])\1/g, '$1'));
    } else {
      // Add double letters for single letters
      const singleLetters = lower.match(/[a-z]/g) || [];
      for (let i = 0; i < singleLetters.length; i++) {
        const doubled = lower.slice(0, i) + singleLetters[i] + lower.slice(i);
        misspellings.push(doubled);
      }
    }

    return misspellings;
  }

  /**
   * Check if text contains volume unit variations
   * 
   * Requirement 13.2: Recognize volume unit variations
   * 
   * @param text - Text to check
   * @returns True if volume units detected
   */
  hasVolumeUnits(text: string): boolean {
    const normalizedText = text.toLowerCase();
    return CHEMICAL_PATTERNS.volumeUnits.some(unit =>
      normalizedText.includes(unit.toLowerCase())
    );
  }

  /**
   * Check if text contains mass unit variations
   * 
   * Requirement 13.3: Recognize mass unit variations
   * 
   * @param text - Text to check
   * @returns True if mass units detected
   */
  hasMassUnits(text: string): boolean {
    const normalizedText = text.toLowerCase();
    return CHEMICAL_PATTERNS.massUnits.some(unit =>
      normalizedText.includes(unit.toLowerCase())
    );
  }
}

/**
 * Default export for convenience
 */
export default ChemicalSafetyChecker;
