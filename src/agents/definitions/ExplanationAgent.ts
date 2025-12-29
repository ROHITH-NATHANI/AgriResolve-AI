import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';

export class ExplanationAgent extends Agent {
    agentName = "ExplanationAgent";
    role = "Generates structured explanations. No decision authority.";

    async run(arbitrationResult: any, healthyResult: any, diseaseResult: any, language: string = 'en'): Promise<{ summary: string, guidance: string[] }> {
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
      - DO NOT prescribe chemicals. Suggest monitoring or expert consultation if needed.
      - Preserve any markdown formatting (bold **, bullets) if used.
    `;

        const response = await routeGeminiCall("EXPLANATION_POLISHED", prompt);
        return this.parseJSON(response);
    }
}
