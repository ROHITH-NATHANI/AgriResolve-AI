import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';

export interface VisionEvidence {
    lesion_color: string;
    lesion_shape: string;
    texture: string;
    distribution: string;
    anomalies_detected: string[];
    raw_analysis: string;
    // OPTIONAL per-leaf bounding boxes (preferred for UI leaf borders)
    // Normalized to the original image (0..1). Label leaves left-to-right as Leaf A, Leaf B, Leaf C.
    leaf_regions?: Array<{
        id: string; // "Leaf A" | "Leaf B" | "Leaf C"
        x: number;
        y: number;
        w: number;
        h: number;
        confidence?: number;
    }>;
    attention_boxes?: Array<{
        // Normalized coordinates relative to the original image (0..1)
        x: number;
        y: number;
        w: number;
        h: number;
        label?: string;
        confidence?: number;
    }>;
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
    - leaf_regions: OPTIONAL array of detected leaf bounding boxes.
        Each item: { id, x, y, w, h, confidence? } where id is "Leaf A", "Leaf B", "Leaf C".
        IMPORTANT: label leaves left-to-right across the image.
            - attention_boxes: OPTIONAL array of up to 5 boxes highlighting the most relevant regions.
                Each item: { x, y, w, h, label?, confidence? } with x/y/w/h normalized to 0..1.
    `;

        const response = await routeGeminiCall("VISION_FAST", prompt, imageB64);
        return this.parseJSON(response) as VisionEvidence;
    }
}
