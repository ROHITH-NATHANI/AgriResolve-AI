import { GoogleGenAI } from "@google/genai";

const API_KEY =
    import.meta.env.GEMINI_API_TOKEN ||
    (typeof process !== 'undefined' ? process.env?.GEMINI_API_TOKEN : undefined);

if (!API_KEY) {
    console.warn("Missing GEMINI_API_TOKEN in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

function toInlineImage(imageB64: string): { mimeType: string; data: string } {
    const match = imageB64.match(/^data:(image\/[^;]+);base64,(.*)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }

    return {
        mimeType: 'image/jpeg',
        data: imageB64.split(',')[1] || imageB64,
    };
}

const SAFETY_SYSTEM_INSTRUCTION = `
You are AgriResolve AI, a cautious agricultural decision-support assistant.

Safety rules (highest priority):
- Do NOT provide instructions for making, mixing, concentrating, or dosing chemicals (pesticides/fungicides/herbicides), nor application rates, nor any step-by-step hazardous procedure.
- Do NOT give human/animal medical advice. If asked about poisoning/exposure, recommend contacting local emergency services/poison control and following the product label/SDS.
- If a request is unsafe or illegal, refuse briefly and offer safer alternatives (monitoring, sanitation, scouting, consult agronomist, follow local guidelines).

Output rules:
- Follow the user-provided format requirements (e.g., JSON) and language requirements in the prompt.
- Be conservative with certainty; call out uncertainty clearly.
`;

const DEFAULT_CONFIG = {
    temperature: 0.2,
    maxOutputTokens: 1400,
    // Library/API versions differ; keep these as plain strings for compatibility.
    safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
};

// Model Registry - Fallback to 2.5 Flash-Lite (Limit: 20/day) as 1.5/2.0 are unavailable/quota-0
const MODEL_REGISTRY = {
    VISION_FAST: "gemini-2.5-flash-lite",
    DEBATE_HIGH_THROUGHPUT: "gemini-2.5-flash-lite",
    ARBITRATION_SMART: "gemini-2.5-flash-lite",
    EXPLANATION_POLISHED: "gemini-2.5-flash-lite",
    CHAT_INTERACTIVE: "gemini-2.5-flash-lite",
};

export async function routeGeminiCall(
    taskType: keyof typeof MODEL_REGISTRY,
    prompt: string,
    imageB64?: string
): Promise<string> {
    const modelName = MODEL_REGISTRY[taskType];
    console.log(`[Gemini Service] Routing '${taskType}' to model: ${modelName}`);
    const model = ai.models.generateContent;

    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{ text: prompt }];

    if (imageB64) {
        const inline = toInlineImage(imageB64);
        parts.push({
            inlineData: {
                mimeType: inline.mimeType,
                data: inline.data,
            },
        });
    }

    let attempt = 0;
    const MAX_RETRIES = 3;

    while (attempt <= MAX_RETRIES) {
        try {
            const response = await model({
                model: modelName,
                contents: [{ parts }],
                config: {
                    ...DEFAULT_CONFIG,
                    systemInstruction: { parts: [{ text: SAFETY_SYSTEM_INSTRUCTION }] },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
            });

            return response.text || "";
        } catch (error: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as any;
            attempt++;

            // Analyze Error Types (New 2025 Strict Quotas)
            const isRateLimit = err?.status === 429 || err?.code === 429 || err?.message?.includes('429');
            const isModelNotFound = err?.status === 404 || err?.code === 404;

            // Immediate Fail for 404 (Model Retired)
            if (isModelNotFound) {
                console.error(`CRITICAL: Model ${modelName} not found. It may be retired.`);
                throw new Error(`Model ${modelName} is retired/unavailable. Check API docs.`);
            }

            // Retry Logic for 429 (Quota) or 503 (Server)
            if (isRateLimit && attempt <= MAX_RETRIES) {
                const delay = 3000 * Math.pow(2, attempt - 1); // Aggressive backoff: 3s, 6s, 12s
                console.warn(`Gemini 2.5 Quota Hit (${taskType}). Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Fatal Error Handling
            console.error(`Gemini API Error (${taskType}):`, error);

            if (isRateLimit) {
                throw new Error("Free Tier Quota Exceeded (Limit: ~20/day). Please link a Billing Account to Google Cloud Project.");
            }

            throw error;
        }
    }

    // Defensive fallback (should be unreachable)
    return "";
}
