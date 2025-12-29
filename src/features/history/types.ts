export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface AgentInsight {
    step: string;
    observation: string;
    timestamp: number;
}

export interface CropAnalysisRecord {
    id: string; // UUID v4
    timestamp: number;
    // Raw binary data of the uploaded crop image, stored as a Blob
    imageBlob: Blob;
    // Optional: Optimized preview for the list view to improve performance
    thumbnailBlob?: Blob;
    diagnosis: {
        primaryIssue: string;
        confidence: number;
        description: string;
        recommendedActions: string;
    };
    healthStatus: HealthStatus;
    // Preserves the "reasoning" chain of the Multi-Agent System
    agentLogs: AgentInsight[];
    // State required to restore the 3D visualization to the exact moment of analysis
    visualMetadata?: {
        cameraPosition: [number, number, number];
        highlightedZones: string; // IDs of meshes highlighted in R3F
    };
}
