import { VisionEvidenceAgent } from './definitions/VisionEvidenceAgent';
import { QualityEvaluator } from './definitions/QualityEvaluator';
import { HealthyHypothesisAgent } from './definitions/HealthyHypothesisAgent';
import { DiseaseHypothesisAgent } from './definitions/DiseaseHypothesisAgent';
import { ArbitrationAgent } from './definitions/ArbitrationAgent';
import { ExplanationAgent } from './definitions/ExplanationAgent';
import { AssessmentData, AssessmentStatus } from '../types';

// Instantiate agents (Singletons for this demo)
const visionAgent = new VisionEvidenceAgent();
const qualityAgent = new QualityEvaluator();
const healthyAgent = new HealthyHypothesisAgent();
const diseaseAgent = new DiseaseHypothesisAgent();
const arbitrationAgent = new ArbitrationAgent();
const explanationAgent = new ExplanationAgent();

export type StatusCallback = (status: AssessmentStatus) => void;

export async function runAgenticPipeline(
    imageB64: string,
    onStatusUpdate: StatusCallback,
    language: string = 'en'
): Promise<AssessmentData> {

    // 1. Vision
    onStatusUpdate(AssessmentStatus.PERCEIVING);
    const visionEvidence = await visionAgent.run(imageB64);

    // 2. Quality
    onStatusUpdate(AssessmentStatus.EVALUATING);
    const quality = await qualityAgent.run(imageB64, visionEvidence);

    // 3. Debate (Parallel)
    onStatusUpdate(AssessmentStatus.DEBATING);
    // Run both agents in parallel for efficiency
    const [healthyResult, diseaseResult] = await Promise.all([
        healthyAgent.run(visionEvidence, quality, language),
        diseaseAgent.run(visionEvidence, quality, language)
    ]);

    // 4. Arbitration
    onStatusUpdate(AssessmentStatus.ARBITRATING);
    const arbitrationResult = await arbitrationAgent.run(healthyResult, diseaseResult, quality, language);


    // 5. Explanation
    onStatusUpdate(AssessmentStatus.EXPLAINING);
    // Pass language to generating the explanation
    const explanation = await explanationAgent.run(arbitrationResult, healthyResult, diseaseResult, language);

    onStatusUpdate(AssessmentStatus.COMPLETED);

    return {
        imageUrl: null, // Set by the caller
        visionEvidence,
        quality,
        healthyResult,
        diseaseResult,
        arbitrationResult,
        explanation
    };
}
