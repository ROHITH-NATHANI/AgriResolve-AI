
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_SERVICE_TOKEN;

if (!apiKey) {
    console.error("Error: GEMINI_SERVICE_TOKEN not found in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: apiKey });

async function listModels() {
    try {
        console.log("Fetching available models...");
        // The SDK structure might be slightly different, let's try the standard way or REST if SDK fails
        // For @google/genai, it might be ai.models.list()
        const response = await ai.models.list();

        console.log("Response Keys:", Object.keys(response));
        console.log("Full Response:", JSON.stringify(response, null, 2));

        // If it's an array directly
        if (Array.isArray(response)) {
            response.forEach((model) => {
                console.log(`- ${model.name}`);
            });
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
