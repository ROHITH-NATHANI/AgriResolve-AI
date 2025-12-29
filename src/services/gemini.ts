import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("Missing VITE_GEMINI_API_KEY in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Model Registry optimized for speed and reasoning depth
const MODEL_REGISTRY = {
    VISION_FAST: "models/gemini-2.5-flash-lite", // User requested specifically
    DEBATE_HIGH_THROUGHPUT: "models/gemini-2.5-flash-lite", // Moved to Lite to avoid 429 on 2.0-flash
    ARBITRATION_SMART: "models/gemini-2.5-flash", // Better reasoning for verdicts
    EXPLANATION_POLISHED: "models/gemini-2.5-flash", // High quality generation
};

export async function routeGeminiCall(
    taskType: keyof typeof MODEL_REGISTRY,
    prompt: string,
    imageB64?: string
): Promise<string> {
    const modelName = MODEL_REGISTRY[taskType];
    const model = ai.models.generateContent;

    try {
        const parts: any[] = [{ text: prompt }];

        if (imageB64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageB64.split(',')[1] || imageB64,
                },
            });
        }

        const response = await model({
            model: modelName,
            contents: [{ parts }],
        });

        return response.text || "";
    } catch (error) {
        console.error(`Gemini API Error (${taskType}):`, error);
        throw error;
    }
}
