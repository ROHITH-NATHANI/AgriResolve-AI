
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

    Your task is to translate ALL user-facing text content within the provided JSON.

    RULES:
    1. Translate text values inside:
       - explanation.summary, explanation.guidance
       - healthyResult.arguments, diseaseResult.arguments
       - arbitrationResult.rationale
       - subjectValidation.message
             - visionEvidence.lesion_color, visionEvidence.lesion_shape, visionEvidence.texture, visionEvidence.distribution, visionEvidence.anomalies_detected, visionEvidence.raw_analysis
                 (but NOT visionEvidence.leaf_regions or visionEvidence.attention_boxes)
       - uncertaintyFactors.other
       - leafAssessments[].observations, leafAssessments[].notes, leafAssessments[].condition
       - quality.issues
    2. DO NOT translate JSON keys.
    3. DO NOT translate arbitrationResult.decision (must remain English).
    4. DO NOT translate arbitrationResult.final_diagnosis.
    5. DO NOT translate leafAssessments[].id (e.g. "Leaf A").
    6. If leafAssessments[].condition is exactly "Unknown", keep it as "Unknown".
    7. Keep all numbers/booleans unchanged.
    8. Return ONLY valid JSON (no markdown, no extra text).

    INPUT JSON:
    ${JSON.stringify({
        subjectValidation: data.subjectValidation,
        visionEvidence: data.visionEvidence,
        leafAssessments: data.leafAssessments,
        uncertaintyFactors: data.uncertaintyFactors,
        quality: data.quality,
        explanation: data.explanation,
        healthyResult: data.healthyResult,
        diseaseResult: data.diseaseResult,
        arbitrationResult: data.arbitrationResult,
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
            subjectValidation: translatedParts.subjectValidation ?? data.subjectValidation,
            visionEvidence: translatedParts.visionEvidence ?? data.visionEvidence,
            leafAssessments: translatedParts.leafAssessments ?? data.leafAssessments,
            uncertaintyFactors: translatedParts.uncertaintyFactors ?? data.uncertaintyFactors,
            quality: translatedParts.quality ?? data.quality,
            explanation: translatedParts.explanation ?? data.explanation,
            healthyResult: translatedParts.healthyResult ?? data.healthyResult,
            diseaseResult: translatedParts.diseaseResult ?? data.diseaseResult,
            arbitrationResult: translatedParts.arbitrationResult ?? data.arbitrationResult
        } as AssessmentData;

    } catch (error) {
        console.error("Translation Failed:", error);
        // Fallback: return original data if translation fails to avoid crashing UI
        return data;
    }
}
