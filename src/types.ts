
export enum AssessmentStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PERCEIVING = 'PERCEIVING',
  EVALUATING = 'EVALUATING',
  DEBATING = 'DEBATING',
  ARBITRATING = 'ARBITRATING',
  EXPLAINING = 'EXPLAINING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

import { VisionEvidence } from './agents/definitions/VisionEvidenceAgent';
import { QualityReport } from './agents/definitions/QualityEvaluator';
import { HypothesisResult } from './agents/definitions/HealthyHypothesisAgent';
import { ArbitrationResult, DecisionState } from './agents/definitions/ArbitrationAgent';

export type { VisionEvidence, QualityReport, HypothesisResult, ArbitrationResult, DecisionState };

// Comprehensive Assessment Data covering all agents
export interface AssessmentData {
  imageUrl: string | null;
  // Agent Outputs
  visionEvidence: VisionEvidence;
  quality: QualityReport;
  healthyResult: HypothesisResult;
  diseaseResult: HypothesisResult;
  arbitrationResult: ArbitrationResult;
  explanation: {
    summary: string;
    guidance: string[];
  };
  leafAssessments?: Array<{
    id: string; // "Leaf A", "Leaf B", "Leaf C"
    observations: string[];
    condition: string;
    confidence: number;
    notes: string;
  }>;
  uncertaintyFactors?: {
    lowImageQuality: boolean;
    multipleLeaves: boolean;
    visuallySimilarConditions: boolean;
    other: string[];
  };
  subjectValidation?: SubjectValidation;
}

export interface SubjectValidation {
  valid_subject: boolean;
  message: string;
}
