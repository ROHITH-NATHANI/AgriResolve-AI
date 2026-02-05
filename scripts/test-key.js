
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for ES modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_SERVICE_TOKEN;

console.log("Testing Key:", apiKey ? `${apiKey.substring(0, 5)}...` : "MISSING");

if (!apiKey) {
    console.error("No API Key found in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function test() {
    try {
        const model = ai.models.generateContent;
        const result = await model({
            model: 'gemini-2.5-flash-lite',
            contents: [{ parts: [{ text: "Hello" }] }]
        });
        console.log("Success! Response:", result.text);
    } catch (e) {
        console.error("API Call Failed:", e.message);
        process.exit(1);
    }
}

test();
