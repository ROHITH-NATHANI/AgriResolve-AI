import { routeGeminiCall } from '../../services/gemini';
import { AssessmentData } from '../../types';
import { QualityFlag } from './QualityEvaluator';

export class ConsolidatedAgent {
  async run(imageB64: string, language: string = 'en'): Promise<AssessmentData> {
    const prompt = `
            You are AgriResolve, a conservative agricultural decision-support system. NOT a diagnostic authority.
            Your primary objective is to reduce overconfidence, manage uncertainty, and behave conservatively.

            CORE PRINCIPLES:
            1. Never assume correctness. Prefer uncertainty over false confidence.
            2. "Confidence" is NOT probability. It is the strength of visual alignment.
               - Default to MEDIUM/LOW confidence.
               - MAX confidence 0.85 unless unambiguous.
               - If confidence < 0.6: Decision = "Unknown", do NOT name a disease.
            3. Actively look for doubt: poor quality, occlusion, lookalikes.
            4. MULTI-LEAF HANDLING:
               - If multiple leaves are visible, split analysis into "Leaf A", "Leaf B", "Leaf C".
               - Never collapse multiple leaves into one diagnosis.
            
            CONTEXT:
            - User Language: ${language} (Translate outputs: findings, arguments, decision, rationale, summary, guidance, observations, condition, notes).

            INTERNAL PROCESS:
            0. SUBJECT CHECK: Is the primary subject a PLANT LEAF, FRUIT, or CROP PART?
               - If NO: Return "valid_subject": false.
            1. SCAN: Detect multiple leaves? Quality issues?
            2. ANALYZE: assess each leaf individually.
            3. VERDICT: Weigh evidence conservatively.

            OUTPUT SCHEMA (Strict JSON):
            {
              "subjectValidation": {
                "valid_subject": boolean, 
                "message": "Valid leaf detected" OR "Invalid subject..."
              },
              "visionEvidence": {
                "lesion_color": "string",
                "lesion_shape": "string",
                "texture": "string",
                "distribution": "string",
                "anomalies_detected": ["visual anomaly 1", "visual anomaly 2"],
                "raw_analysis": "brief technical description"
              },
              "leafAssessments": [
                {
                  "id": "Leaf A",
                  "observations": ["Small yellow spots..."],
                  "condition": "Likely Early Blight" OR "Unknown",
                  "confidence": 0.65,
                  "notes": "Occluded by stem..."
                }
              ],
              "uncertaintyFactors": {
                "lowImageQuality": boolean,
                "multipleLeaves": boolean,
                "visuallySimilarConditions": boolean,
                "other": ["list other factors"]
              },
              "quality": { "score": 0.0-1.0, "flags": ["OK", "BLURRY", "NOT_LEAF/BACKGROUND_NOISE"], "reasoning": "string" },
              "healthyResult": { "score": 0.0-1.0, "arguments": [], "evidence_refs": {} },
              "diseaseResult": { "score": 0.0-1.0, "arguments": [], "evidence_refs": {} },
              "arbitrationResult": {
                "decision": "Conservative Decision",
                "confidence": 0.0-1.0, 
                "rationale": ["Reason 1", "Reason 2"]
              },
              "explanation": {
                "summary": "Cautious summary of uncertainty and findings.",
                "guidance": ["Observation step 1", "When to consult expert"]
              }
            }

            CRITICAL RULES:
            - Output ONLY raw JSON. No markdown.
            - If "valid_subject" is false, stop there.
            - If confidence is low, "decision" MUST be "Unknown".
            - SAFETY: Do NOT provide pesticide/fungicide/herbicide product names, mixing instructions, dosing, spray rates, or any hazardous step-by-step guidance.
            - SAFETY: Do NOT provide human/animal medical advice. If the user mentions exposure/poisoning risk, advise contacting local emergency services/poison control.
        `;

    try {
      const responseText = await routeGeminiCall('DEBATE_HIGH_THROUGHPUT', prompt, imageB64);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);

      if (data.subjectValidation && !data.subjectValidation.valid_subject) {
        return {
          imageUrl: null,
          visionEvidence: {
            lesion_color: "none",
            lesion_shape: "none",
            texture: "none",
            distribution: "none",
            anomalies_detected: [],
            raw_analysis: "Invalid subject"
          },
          quality: { score: 0, flags: [QualityFlag.NOT_LEAF], reasoning: data.subjectValidation.message || "Invalid Subject" },
          healthyResult: { score: 0, arguments: [], evidence_refs: {} },
          diseaseResult: { score: 0, arguments: [], evidence_refs: {} },
          arbitrationResult: {
            decision: "Not a Leaf",
            confidence: 0,
            rationale: [data.subjectValidation.message || "Invalid subject."]
          },
          explanation: {
            summary: "Please upload a clear image of a specific crop leaf.",
            guidance: ["Ensure the leaf is the main subject."]
          },
          uncertaintyFactors: {
            lowImageQuality: true,
            multipleLeaves: false,
            visuallySimilarConditions: false,
            other: ["Invalid subject"]
          },
          subjectValidation: data.subjectValidation
        };
      }

      return {
        imageUrl: null,
        visionEvidence: data.visionEvidence || {
          lesion_color: "unknown",
          lesion_shape: "unknown",
          texture: "unknown",
          distribution: "unknown",
          anomalies_detected: [],
          raw_analysis: "No analysis"
        },
        quality: data.quality || { score: 1, flags: [QualityFlag.OK], reasoning: "Acceptable" },
        healthyResult: data.healthyResult || { score: 0, arguments: [], evidence_refs: {} },
        diseaseResult: data.diseaseResult || { score: 0, arguments: [], evidence_refs: {} },
        arbitrationResult: data.arbitrationResult || { decision: "Unknown", confidence: 0, rationale: [] },
        explanation: data.explanation || { summary: "Analysis failed.", guidance: [] },
        leafAssessments: data.leafAssessments || [],
        uncertaintyFactors: data.uncertaintyFactors || {
          lowImageQuality: false,
          multipleLeaves: false,
          visuallySimilarConditions: false,
          other: []
        },
        subjectValidation: data.subjectValidation
      };
    } catch (error) {
      console.error("Consolidated Agent Error:", error);
      throw new Error("Failed to generate assessment.");
    }
  }
}
