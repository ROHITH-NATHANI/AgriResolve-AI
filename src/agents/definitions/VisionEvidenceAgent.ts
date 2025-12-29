import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';

export interface VisionEvidence {
    lesion_color: string;
    lesion_shape: string;
    texture: string;
    distribution: string;
    anomalies_detected: string[];
    raw_analysis: string;
}

export class VisionEvidenceAgent extends Agent {
    agentName = "VisionEvidenceAgent";
    role = "Extracts granular visual features without diagnosis.";

    async run(imageB64: string): Promise<VisionEvidence> {
        const prompt = `
      Analyze this crop leaf image as a computer vision system. 
      Extract objective visual features. DO NOT DIAGNOSE.
      
      Output JSON with these fields:
      - lesion_color: dominant color of spots/lesions (or "none")
      - lesion_shape: shape description (circular, irregular, etc.)
      - texture: surface texture (smooth, rough, pustules, etc.)
      - distribution: scattered, clustered, marginal, etc.
      - anomalies_detected: list of specific visual anomalies
      - raw_analysis: A brief technical description of the visual patterns.
    `;

        const response = await routeGeminiCall("VISION_FAST", prompt, imageB64);
        return this.parseJSON(response);
    }
}
