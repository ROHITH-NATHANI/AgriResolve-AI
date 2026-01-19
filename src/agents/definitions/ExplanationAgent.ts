import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { ArbitrationResult } from './ArbitrationAgent';
import { HypothesisResult } from './HealthyHypothesisAgent';

export class ExplanationAgent extends Agent {
    agentName = "ExplanationAgent";
    role = "Generates structured explanations. No decision authority.";

    async run(arbitrationResult: ArbitrationResult, healthyResult: HypothesisResult, diseaseResult: HypothesisResult, language: string = 'en'): Promise<{ summary: string, guidance: string[] }> {
        const prompt = `
      Generate a final explanation for the farmer based on the arbitration decision.
      
      Decision: ${arbitrationResult.decision}
      Rationale: ${JSON.stringify(arbitrationResult.rationale)}
      
      Healthy Points: ${JSON.stringify(healthyResult.arguments)}
      Disease Points: ${JSON.stringify(diseaseResult.arguments)}
      
      TARGET LANGUAGE: ${language}
      
      Output JSON:
      - summary: A clear, plain-language paragraph explaining the result. TRANSLATE TO TARGET LANGUAGE (${language}).
      - guidance: A list of 2-3 actionable steps. TRANSLATE TO TARGET LANGUAGE (${language}).
      
      IMPORTANT FORMATTING RULES:
      - You MUST Translate 'summary' and 'guidance' values to the target language.
            - DO NOT prescribe chemicals. Do NOT include dosing, spray rates, mixing, or product recommendations.
            - Do NOT give human/animal medical advice.
            - Suggest monitoring, sanitation, and expert consultation if needed.
      - Preserve any markdown formatting (bold **, bullets) if used.
    `;

        const response = await routeGeminiCall("EXPLANATION_POLISHED", prompt);
        return this.parseJSON(response) as { summary: string, guidance: string[] };
    }
}
