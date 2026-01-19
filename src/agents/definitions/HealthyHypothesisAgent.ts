import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { VisionEvidence } from './VisionEvidenceAgent';
import { QualityReport } from './QualityEvaluator';

export interface HypothesisResult {
    score: number; // 0.0 to 1.0 confidence
    arguments: string[];
    evidence_refs: Record<string, unknown>;
}

interface HypothesisResponse {
    score: number;
    arguments: string[];
}

export class HealthyHypothesisAgent extends Agent {
    agentName = "HealthyHypothesisAgent";
    role = "Argues for benign explanations, preferring false negatives. Conservative.";

    async run(evidence: VisionEvidence, quality: QualityReport, language: string = 'en'): Promise<HypothesisResult> {
        const prompt = `
      Act as the "Healthy Hypothesis Agent". Your goal is to argue that the crop is HEALTHY or that anomalies are benign (abiotic, lighting, etc.).
      You are skeptical of disease claims.
      
      Input Evidence: ${JSON.stringify(evidence)}
      Input Quality: ${JSON.stringify(quality)}
      
      Output JSON:
      - score: Confidence (0.0 - 1.0) that the plant is HEALTHY.
      - arguments: List of strings arguing WHY it looks healthy (e.g. "Spots are irregular and suggest mechanical damage", "Green area dominates").
      
      TRANSLATION INSTRUCTION:
      The user's requested language is: "${language}".
      Ensure the "arguments" array content is written in "${language}".
      However, keep the JSON keys (score, arguments) in English.
    `;

        const response = await routeGeminiCall("DEBATE_HIGH_THROUGHPUT", prompt);
        const result = this.parseJSON(response) as HypothesisResponse;

        return {
            score: result.score,
            arguments: result.arguments,
            evidence_refs: { quality_score: quality.score }
        };
    }
}
