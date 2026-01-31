import { routeGeminiCall } from '../../services/gemini';
import { AssessmentData } from '../../types';
import { QualityFlag } from './QualityEvaluator';
import type { VisionEvidence } from './VisionEvidenceAgent';
import type { QualityReport } from './QualityEvaluator';
import type { HypothesisResult } from './HealthyHypothesisAgent';
import type { ArbitrationResult } from './ArbitrationAgent';

function extractJsonPayload(text: string): string {
  const cleaned = text.replace(/```json\n?|```/g, '').trim();

  // Prefer the first JSON object/array in the response.
  const firstObj = cleaned.indexOf('{');
  const firstArr = cleaned.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start === -1) return cleaned;

  // Try to cut at the last closing brace/bracket.
  const lastObj = cleaned.lastIndexOf('}');
  const lastArr = cleaned.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);

  if (end === -1 || end <= start) return cleaned.slice(start);

  return cleaned.slice(start, end + 1).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string') ? value : fallback;
}

function parseVisionEvidence(value: unknown): VisionEvidence | null {
  if (!isRecord(value)) return null;

  const maybeLeafRegions = Array.isArray(value.leaf_regions) ? (value.leaf_regions as unknown[]) : null;
  const leaf_regions = maybeLeafRegions
    ? maybeLeafRegions
        .filter(isRecord)
        .map((r) => ({
          id: asString(r.id, 'Leaf'),
          x: asNumber(r.x, 0),
          y: asNumber(r.y, 0),
          w: asNumber(r.w, 0),
          h: asNumber(r.h, 0),
          confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
        }))
        .filter((b) => typeof b.id === 'string' && b.id.length > 0 && b.w > 0 && b.h > 0)
    : undefined;

  const maybeBoxes = Array.isArray(value.attention_boxes) ? (value.attention_boxes as unknown[]) : null;
  const attention_boxes = maybeBoxes
    ? maybeBoxes
        .filter(isRecord)
        .map((box) => ({
          x: asNumber(box.x, 0),
          y: asNumber(box.y, 0),
          w: asNumber(box.w, 0),
          h: asNumber(box.h, 0),
          label: typeof box.label === 'string' ? box.label : undefined,
          confidence: typeof box.confidence === 'number' ? box.confidence : undefined,
        }))
        .filter((b) => b.w > 0 && b.h > 0)
    : undefined;

  return {
    lesion_color: asString(value.lesion_color, 'unknown'),
    lesion_shape: asString(value.lesion_shape, 'unknown'),
    texture: asString(value.texture, 'unknown'),
    distribution: asString(value.distribution, 'unknown'),
    anomalies_detected: asStringArray(value.anomalies_detected, []),
    raw_analysis: asString(value.raw_analysis, 'No analysis'),
    leaf_regions,
    attention_boxes,
  };
}

function parseQuality(value: unknown): QualityReport | null {
  if (!isRecord(value)) return null;
  return {
    score: asNumber(value.score, 1),
    flags: Array.isArray(value.flags) ? (value.flags as QualityFlag[]) : [QualityFlag.OK],
    reasoning: asString(value.reasoning, 'Acceptable'),
  };
}

function parseHypothesis(value: unknown): HypothesisResult | null {
  if (!isRecord(value)) return null;
  return {
    score: asNumber(value.score, 0),
    arguments: asStringArray(value.arguments, []),
    evidence_refs: isRecord(value.evidence_refs) ? value.evidence_refs : {},
  };
}

function parseArbitration(value: unknown): ArbitrationResult | null {
  if (!isRecord(value)) return null;
  return {
    decision: asString(value.decision, 'Unknown'),
    confidence: asNumber(value.confidence, 0),
    rationale: asStringArray(value.rationale, []),
  };
}

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
                "raw_analysis": "brief technical description",
                "leaf_regions": [
                  { "id": "Leaf A", "x": 0.1, "y": 0.2, "w": 0.4, "h": 0.6, "confidence": 0.8 }
                ]
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

    const strictJsonReminder = `\n\nIMPORTANT: Return ONLY valid JSON. Do not include trailing commas, comments, markdown, or extra text. Ensure all strings are properly closed and escaped.`;

    try {
      const responseText = await routeGeminiCall('DEBATE_HIGH_THROUGHPUT', prompt, imageB64);

  let data: unknown;
      try {
        data = JSON.parse(extractJsonPayload(responseText));
      } catch {
        // One retry with stricter instruction. This handles occasional model hiccups.
        const retryText = await routeGeminiCall('DEBATE_HIGH_THROUGHPUT', prompt + strictJsonReminder, imageB64);
        data = JSON.parse(extractJsonPayload(retryText));
      }

  if (!isRecord(data)) {
    throw new Error('Model returned non-object JSON payload');
  }

      const subjectValidation = isRecord(data.subjectValidation)
        ? (data.subjectValidation as Record<string, unknown>)
        : undefined;

      if (subjectValidation && subjectValidation.valid_subject === false) {
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
          quality: {
            score: 0,
            flags: [QualityFlag.NOT_LEAF],
            reasoning: typeof subjectValidation.message === 'string' ? subjectValidation.message : 'Invalid Subject'
          },
          healthyResult: { score: 0, arguments: [], evidence_refs: {} },
          diseaseResult: { score: 0, arguments: [], evidence_refs: {} },
          arbitrationResult: {
            decision: "Not a Leaf",
            confidence: 0,
            rationale: [typeof subjectValidation.message === 'string' ? subjectValidation.message : 'Invalid subject.']
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
          subjectValidation: {
            valid_subject: false,
            message: typeof subjectValidation.message === 'string' ? subjectValidation.message : 'Invalid subject.'
          }
        };
      }

      const parsedVisionEvidence = parseVisionEvidence(data.visionEvidence) ?? {
        lesion_color: 'unknown',
        lesion_shape: 'unknown',
        texture: 'unknown',
        distribution: 'unknown',
        anomalies_detected: [],
        raw_analysis: 'No analysis',
      };

      const parsedQuality = parseQuality(data.quality) ?? {
        score: 1,
        flags: [QualityFlag.OK],
        reasoning: 'Acceptable',
      };

      const parsedHealthy = parseHypothesis(data.healthyResult) ?? { score: 0, arguments: [], evidence_refs: {} };
      const parsedDisease = parseHypothesis(data.diseaseResult) ?? { score: 0, arguments: [], evidence_refs: {} };
      const parsedArbitration = parseArbitration(data.arbitrationResult) ?? {
        decision: 'Unknown',
        confidence: 0,
        rationale: [],
      };

      const parsedExplanation = isRecord(data.explanation)
        ? {
            summary: asString(data.explanation.summary, 'Analysis failed.'),
            guidance: asStringArray(data.explanation.guidance, []),
          }
        : { summary: 'Analysis failed.', guidance: [] };

      const parsedLeafAssessments = Array.isArray(data.leafAssessments)
        ? (data.leafAssessments as unknown[])
            .filter(isRecord)
            .map(item => ({
              id: asString(item.id, 'Leaf'),
              observations: asStringArray(item.observations, []),
              condition: asString(item.condition, 'Unknown'),
              confidence: asNumber(item.confidence, 0),
              notes: asString(item.notes, ''),
            }))
        : [];

      const parsedUncertainty = isRecord(data.uncertaintyFactors)
        ? {
            lowImageQuality: Boolean(data.uncertaintyFactors.lowImageQuality),
            multipleLeaves: Boolean(data.uncertaintyFactors.multipleLeaves),
            visuallySimilarConditions: Boolean(data.uncertaintyFactors.visuallySimilarConditions),
            other: asStringArray(data.uncertaintyFactors.other, []),
          }
        : {
            lowImageQuality: false,
            multipleLeaves: false,
            visuallySimilarConditions: false,
            other: [],
          };

      const parsedSubjectValidation = subjectValidation
        ? {
            valid_subject: Boolean(subjectValidation.valid_subject),
            message: asString(subjectValidation.message, 'Valid leaf detected'),
          }
        : undefined;

      return {
        imageUrl: null,
        visionEvidence: parsedVisionEvidence,
        quality: parsedQuality,
        healthyResult: parsedHealthy,
        diseaseResult: parsedDisease,
        arbitrationResult: parsedArbitration,
        explanation: parsedExplanation,
        leafAssessments: parsedLeafAssessments,
        uncertaintyFactors: parsedUncertainty,
        subjectValidation: parsedSubjectValidation,
      };
    } catch (error) {
      console.error("Consolidated Agent Error:", error);
      throw new Error("Failed to generate assessment.");
    }
  }
}
