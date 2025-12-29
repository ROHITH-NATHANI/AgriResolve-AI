import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("Missing VITE_GEMINI_API_KEY in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Model Registry - Switching to Experimental 2.0 Flash (Often has higher 'Test' quotas than Stable 2.5)
const MODEL_REGISTRY = {
    VISION_FAST: "gemini-2.0-flash-exp",
    DEBATE_HIGH_THROUGHPUT: "gemini-2.0-flash-exp",
    ARBITRATION_SMART: "gemini-2.0-flash-exp",
    EXPLANATION_POLISHED: "gemini-2.0-flash-exp",
    CHAT_INTERACTIVE: "gemini-2.0-flash-exp",
};

export async function routeGeminiCall(
    taskType: keyof typeof MODEL_REGISTRY,
    prompt: string,
    imageB64?: string
): Promise<string> {
    const modelName = MODEL_REGISTRY[taskType];
    const model = ai.models.generateContent;

    const parts: any[] = [{ text: prompt }];

    if (imageB64) {
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: imageB64.split(',')[1] || imageB64,
            },
        });
    }

    let attempt = 0;
    const MAX_RETRIES = 3;

    while (true) {
        try {
            const response = await model({
                model: modelName,
                contents: [{ parts }],
            });

            return response.text || "";
        } catch (error: any) {
            attempt++;

            // Analyze Error Types (New 2025 Strict Quotas)
            const isRateLimit = error?.status === 429 || error?.code === 429 || error?.message?.includes('429');
            const isModelNotFound = error?.status === 404 || error?.code === 404;

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
}
