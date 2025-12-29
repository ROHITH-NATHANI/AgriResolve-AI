import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { QualityReport } from './QualityEvaluator';

export enum DecisionState {
    HEALTHY = "Likely Healthy",
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
        healthyResult: any,
        diseaseResult: any,
        quality: QualityReport
    ): Promise<ArbitrationResult> {
        const prompt = `
      Act as the "Arbitration Agent". Judge the debate between Healthy and Disease agents.
      
      Healthy Argument (Score ${healthyResult.score}): ${JSON.stringify(healthyResult.arguments)}
      Disease Argument (Score ${diseaseResult.score}): ${JSON.stringify(diseaseResult.arguments)}
      Quality Report (Score ${quality.score}): ${JSON.stringify(quality)}
      
      Rules:
      - If Quality < 0.5, lean towards Indeterminate.
      - High confidence requires strong evidence from one side.
      - Better safe than sorry? No, be objective based on the arguments.
      
      Output JSON:
      - decision: One of ["Likely Healthy", "Possibly Healthy", "Possibly Abnormal", "Likely Abnormal", "Indeterminate"]
      - confidence: float 0.0 - 1.0
      - rationale: List of reasons for the decision.
    `;

        const response = await routeGeminiCall("ARBITRATION_SMART", prompt);
        return this.parseJSON(response);
    }
}
