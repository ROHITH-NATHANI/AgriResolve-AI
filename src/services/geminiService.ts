
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_TOKEN });

export async function processCropHealth(imageB64: string) {
  const model = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageB64.split(',')[1] || imageB64,
            },
          },
          {
            text: `Act as a multi-agent system (AgriResolve AI) to assess this crop leaf image.
            
            Follow these workflow stages:
            1. VISION EVIDENCE: Extract low-level features (textures, colors, anomalies).
            2. QUALITY EVALUATOR: Check for blur, lighting, background contamination. Assign a quality score 0-1.
            3. HYPOTHESIS DEBATE: 
               - Agent A (Healthy): Argue for benign explanations, discount weak anomalies.
               - Agent B (Disease): Highlight risks, elevate uncertainty.
            4. ARBITRATION: Resolve the debate based on evidence quality and confidence. Verdicts: Likely Healthy, Possibly Healthy, Possibly Abnormal, Likely Abnormal, Indeterminate.
            5. EXPLANATION: Provide a plain-language summary and farmer-safe guidance.
            
            STRICT RULES:
            - NO chemical or treatment prescriptions.
            - Focus on risk assessment and monitoring guidance.
            - Encourage expert consultation if abnormal.

            Return the response as a structured JSON object.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visionEvidence: { type: Type.STRING },
          qualityScore: { type: Type.NUMBER },
          qualityFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          healthyHypothesis: { type: Type.STRING },
          diseaseHypothesis: { type: Type.STRING },
          arbitrationVerdict: { type: Type.STRING },
          explanation: { type: Type.STRING },
          guidance: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["visionEvidence", "qualityScore", "qualityFlags", "healthyHypothesis", "diseaseHypothesis", "arbitrationVerdict", "explanation", "guidance"],
      },
    },
  });

  const response = await model;
  return JSON.parse(response.text);
}
