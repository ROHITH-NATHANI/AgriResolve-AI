import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { VisionEvidence } from './VisionEvidenceAgent';

export enum QualityFlag {
    OK = "OK",
    BLURRY = "BLURRY",
    LOW_LIGHT = "LOW_LIGHT",
    OVEREXPOSED = "OVEREXPOSED",
    NOT_LEAF = "NOT_LEAF/BACKGROUND_NOISE"
}

export interface QualityReport {
    score: number; // 0.0 to 1.0
    flags: QualityFlag[];
    reasoning: string;
}

export class QualityEvaluator extends Agent {
    agentName = "QualityEvaluator";
    role = "Validates input image quality for reliable analysis.";

    async run(imageB64: string, _existingEvidence?: VisionEvidence): Promise<QualityReport> {
        const prompt = `
      Evaluate the quality of this image for agricultural disease diagnosis.
      Check for blur, lighting issues, and framing.
      
      Output JSON:
      - score: float 0.0 to 1.0 (1.0 is perfect)
      - flags: Array of strings from [BLURRY, LOW_LIGHT, OVEREXPOSED, NOT_LEAF/BACKGROUND_NOISE, OK]
      - reasoning: brief explanation
    `;

        const response = await routeGeminiCall("VISION_FAST", prompt, imageB64);
        return this.parseJSON(response) as QualityReport;
    }
}
