import { Agent } from './BaseAgent';
import { routeGeminiCall } from '../../services/gemini';
import { VisionEvidence } from './VisionEvidenceAgent';
import { QualityReport } from './QualityEvaluator';

export interface ConsensusResult {
    healthy: {
        score: number;
        arguments: string[];
    };
    disease: {
        score: number;
        arguments: string[];
    };
}

export class ConsensusAgent extends Agent {
    agentName = "ConsensusAgent";
    role = "Simulates a debate between a Healthy Advocate and a Disease Detective.";

    async run(evidence: VisionEvidence, quality: QualityReport, language: string = 'en'): Promise<ConsensusResult> {
        const prompt = `
      Act as a Debate Moderator simulating two agents:
      1. "Healthy Advocate": Argues for benign causes (abiotic, mechanical, lighting). PREFERS FALSE NEGATIVES.
      2. "Disease Detective": Argues for pathology risks. PREFERS FALSE POSITIVES. 

      Input Evidence: ${JSON.stringify(evidence)}
      Input Quality: ${JSON.stringify(quality)}
      
      Output a single JSON object with two sections. 
      
      TRANSLATION INSTRUCTION:
      The user's requested language is: "${language}".
      Ensure the "arguments" arrays are written in "${language}".
      Keep all keys (healthy, disease, score, arguments) in English.

      Output JSON Structure:
      {
        "healthy": {
            "score": 0.0-1.0,
            "arguments": ["list of strings in ${language}"]
        },
        "disease": {
            "score": 0.0-1.0,
            "arguments": ["list of strings in ${language}"]
        }
      }
    `;

        const response = await routeGeminiCall("DEBATE_HIGH_THROUGHPUT", prompt);
        return this.parseJSON(response) as ConsensusResult;
    }
}
