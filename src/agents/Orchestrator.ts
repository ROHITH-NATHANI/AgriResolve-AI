import { VisionEvidenceAgent } from './definitions/VisionEvidenceAgent';
import { QualityEvaluator } from './definitions/QualityEvaluator';
import { ConsensusAgent } from './definitions/ConsensusAgent';
import { ArbitrationAgent } from './definitions/ArbitrationAgent';
import { ExplanationAgent } from './definitions/ExplanationAgent';
import { AssessmentData, AssessmentStatus } from '../types';

// Instantiate agents (Singletons for this demo)
const visionAgent = new VisionEvidenceAgent();
const qualityAgent = new QualityEvaluator();
const consensusAgent = new ConsensusAgent(); // Replaces Healthy + Disease
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

    // 3. Debate (Consolidated)
    onStatusUpdate(AssessmentStatus.DEBATING);
    // Runs both sides of the argument in ONE API call to save latency and quota
    const consensusResult = await consensusAgent.run(visionEvidence, quality, language);

    const healthyResult = {
        is_healthy: consensusResult.healthy.score > 0.5,
        score: consensusResult.healthy.score,
        arguments: consensusResult.healthy.arguments,
        evidence_refs: { quality_score: quality.score }
    };

    const diseaseResult = {
        score: consensusResult.disease.score,
        arguments: consensusResult.disease.arguments,
        evidence_refs: { quality_score: quality.score }
    };

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
