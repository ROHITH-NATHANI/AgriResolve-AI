import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { VisionEvidence } from './VisionEvidenceAgent';
import { QualityReport } from './QualityEvaluator';

export class DiseaseHypothesisAgent extends Agent {
    agentName = "DiseaseHypothesisAgent";
    role = "Argues for abnormal pathology. Risk-sensitive, anomaly-seeking.";

    async run(evidence: VisionEvidence, quality: QualityReport, language: string = 'en'): Promise<{ score: number, arguments: string[], evidence_refs: any }> {
        const prompt = `
      Act as the "Disease Hypothesis Agent". Your goal is to highlight potential RISKS and ABNORMALITIES.
      You prefer false positives over missing a disease.
      
      Input Evidence: ${JSON.stringify(evidence)}
      Input Quality: ${JSON.stringify(quality)}
      
      Output JSON:
      - score: Confidence (0.0 - 1.0) that the plant has a DISEASE/ABNORMALITY.
      - arguments: List of strings highlighting risks.

      TRANSLATION INSTRUCTION:
      The user's requested language is: "${language}".
      Ensure the "arguments" array content is written in "${language}".
      However, keep the JSON keys (score, arguments) in English.
    `;

        const response = await routeGeminiCall("DEBATE_HIGH_THROUGHPUT", prompt);
        const result = this.parseJSON(response);

        return {
            score: result.score,
            arguments: result.arguments,
            evidence_refs: { quality_score: quality.score }
        };
    }
}
