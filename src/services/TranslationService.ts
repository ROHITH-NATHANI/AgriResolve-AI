
import { routeGeminiCall } from './gemini';
import { AssessmentData } from '../types';

/**
 * Translates the existing AssessmentData to the target language.
 * It strictly preserves the JSON structure and logic keys (decision codes).
 */
export async function translateAssessmentData(
    data: AssessmentData,
    targetLanguage: string
): Promise<AssessmentData> {

    // Safety check: specific to this app structure
    if (!data.explanation || !data.healthyResult || !data.diseaseResult || !data.arbitrationResult) {
        console.warn("Incomplete assessment data, skipping translation");
        return data;
    }

    const prompt = `
    You are a precise JSON Translator for an Agricultural AI App.
    
    Target Language: "${targetLanguage}"

    Your task is to translate the user-facing text content within the provided JSON.

    RULES:
    1. Translate "summary", "guidance", "arguments", "rationale", and "label" values to ${targetLanguage}.
    2. DO NOT translate keys.
    3. DO NOT translate the "decision" value (e.g. "Likely Healthy", "Indeterminate") - this MUST remain in English for system logic.
    4. DO NOT translate "status" or "score" values.
    5. Return ONLY the valid JSON, no markdown formatting like \`\`\`json.

    INPUT JSON:
    ${JSON.stringify({
        explanation: data.explanation,
        healthyResult: data.healthyResult,
        diseaseResult: data.diseaseResult,
        arbitrationResult: data.arbitrationResult,
        // We do not translate visionEvidence or Quality here as they are mostly technical/numeric
    })}
    `;

    try {
        const responseJson = await routeGeminiCall("EXPLANATION_POLISHED", prompt);

        // Clean up markdown if Gemini adds it despite instructions
        const cleanJson = responseJson.replace(/```json/g, '').replace(/```/g, '').trim();
        const translatedParts = JSON.parse(cleanJson);

        // Merge back into original object
        return {
            ...data,
            explanation: translatedParts.explanation,
            healthyResult: translatedParts.healthyResult,
            diseaseResult: translatedParts.diseaseResult,
            arbitrationResult: translatedParts.arbitrationResult
        };

    } catch (error) {
        console.error("Translation Failed:", error);
        // Fallback: return original data if translation fails to avoid crashing UI
        return data;
    }
}
