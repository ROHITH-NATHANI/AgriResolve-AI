import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { QualityReport } from './QualityEvaluator';

import { HypothesisResult } from './HealthyHypothesisAgent';

export enum DecisionState {
    LIKELY_HEALTHY = "Likely Healthy",
    POSSIBLE_ABNORMALITY = "Possibly Abnormal",
    LIKELY_ABNORMALITY = "Likely Abnormal",
    INDETERMINATE = "Indeterminate"
}

export interface ArbitrationResult {
    decision: string;
    confidence: number;
    rationale: string[];
}

export class ArbitrationAgent extends Agent {
    agentName = "ArbitrationAgent";
    role = "Resolves conflict between Healthy and Disease agents.";

    async run(
        healthyResult: HypothesisResult,
        diseaseResult: HypothesisResult,
        quality: QualityReport,
        language: string = 'en'
    ): Promise<ArbitrationResult> {
        const prompt = `
      Act as the "Arbitration Agent". Judge the debate between Healthy and Disease agents.
      
      Healthy Argument (Score ${healthyResult.score}): ${JSON.stringify(healthyResult.arguments)}
      Disease Argument (Score ${diseaseResult.score}): ${JSON.stringify(diseaseResult.arguments)}
      Quality Report (Score ${quality.score}): ${JSON.stringify(quality)}
      
      Rules:
      - If Quality < 0.5, lean towards Indeterminate.
      - High confidence requires strong evidence from one side.
      - Be objective based on the arguments.
      
      Output JSON:
      - decision: One of ["Likely Healthy", "Possibly Healthy", "Possibly Abnormal", "Likely Abnormal", "Indeterminate"] (ALWAYS KEEP IN ENGLISH)
      - confidence: float 0.0 - 1.0
      - rationale: List of reasons for the decision.

      TRANSLATION INSTRUCTION:
      The user's requested language is: "${language}".
      Ensure the "rationale" array content is written in "${language}".
      IMPORTANT: The "decision" field MUST remain in English (e.g., "Likely Healthy") for system logic.
    `;

        const response = await routeGeminiCall("ARBITRATION_SMART", prompt);
        return this.parseJSON(response) as ArbitrationResult;
    }
}
