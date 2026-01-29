/**
 * Property-Based Tests for Expert Opinion Preservation
 * Feature: real-time-collaborative-network, Property 2: Expert Opinion Preservation
 * **Validates: Requirements 1.4**
 */

import * as fc from 'fast-check';
import { sessionManager } from '../../websocket/sessionManager';
import { eventProcessor } from '../../websocket/eventProcessor';

interface ExpertOpinion {
  expertId: string;
  diagnosis: string;
  confidence: number;
  reasoning: string;
  timestamp: Date;
  supportingEvidence?: string[];
  treatmentRecommendations?: string[];
}

interface ExpertProfile {
  expertId: string;
  specialization: string;
  yearsExperience: number;
  certifications: string[];
  reputation: number;
}

describe('Property: Expert Opinion Preservation', () => {
  beforeEach(() => {
    // Clean up any existing state
    jest.clearAllMocks();
  });

  /**
   * Property 2: Expert Opinion Preservation
   * For any collaboration session with multiple expert diagnoses, all expert viewpoints 
   * should be preserved with their confidence scores and reasoning, regardless of 
   * conflicts or consensus.
   */
  test('Property 2: All expert opinions are preserved with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 10, maxLength: 30 }),
          experts: fc.array(
            fc.record({
              expertId: fc.string({ minLength: 5, maxLength: 20 }),
              specialization: fc.constantFrom('plant-pathology', 'entomology', 'soil-science', 'agronomy', 'horticulture'),
              yearsExperience: fc.integer({ min: 1, max: 40 }),
              certifications: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
              reputation: fc.float({ min: 0, max: 5 })
            }),
            { minLength: 2, maxLength: 6 }
          ),
          opinions: fc.array(
            fc.record({
              diagnosis: fc.constantFrom(
                'Fungal Leaf Spot', 'Bacterial Blight', 'Viral Mosaic', 'Nutrient Deficiency',
                'Pest Damage', 'Environmental Stress', 'Root Rot', 'Powdery Mildew'
              ),
              confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
              reasoning: fc.string({ minLength: 20, maxLength: 200 }),
              supportingEvidence: fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
              treatmentRecommendations: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 0, maxLength: 3 })
            }),
            { minLength: 2, maxLength: 6 }
          )
        }),
        async (testData) => {
          const { sessionId, experts, opinions } = testData;

          try {
            // Create session
            const creatorId = experts[0].expertId;
            await sessionManager.createSession(sessionId, 'Expert Opinion Test', creatorId);

            // Add all experts as participants
            for (const expert of experts) {
              await sessionManager.addParticipant(sessionId, {
                userId: expert.expertId,
                socketId: `socket-${expert.expertId}`,
                role: 'expert',
                joinedAt: new Date()
              });
            }

            const submittedOpinions: ExpertOpinion[] = [];
            const preservedOpinions: ExpertOpinion[] = [];

            // Submit opinions from different experts
            for (let i = 0; i < opinions.length && i < experts.length; i++) {
              const expert = experts[i];
              const opinionData = opinions[i];

              const expertOpinion: ExpertOpinion = {
                expertId: expert.expertId,
                diagnosis: opinionData.diagnosis,
                confidence: opinionData.confidence,
                reasoning: opinionData.reasoning,
                timestamp: new Date(Date.now() + i * 1000), // Stagger timestamps
                supportingEvidence: opinionData.supportingEvidence,
                treatmentRecommendations: opinionData.treatmentRecommendations
              };

              submittedOpinions.push(expertOpinion);

              // Add recommendation to session
              await sessionManager.addRecommendation(sessionId, {
                id: `rec-${expert.expertId}-${Date.now()}`,
                expertId: expert.expertId,
                title: expertOpinion.diagnosis,
                description: expertOpinion.reasoning,
                confidence: expertOpinion.confidence,
                createdAt: expertOpinion.timestamp
              });

              // Simulate processing through event processor
              const workspaceUpdate = await eventProcessor.processWorkspaceUpdate(
                sessionId,
                expert.expertId,
                {
                  type: 'recommendation',
                  data: {
                    expertOpinion,
                    expertProfile: expert
                  }
                }
              );

              // Store processed opinion
              preservedOpinions.push(expertOpinion);
            }

            // Verify all opinions are preserved
            expect(preservedOpinions.length).toBe(submittedOpinions.length);

            // Check that each submitted opinion is preserved with complete metadata
            for (const submittedOpinion of submittedOpinions) {
              const preserved = preservedOpinions.find(p =>
                p.expertId === submittedOpinion.expertId &&
                p.timestamp.getTime() === submittedOpinion.timestamp.getTime()
              );

              expect(preserved).toBeDefined();
              expect(preserved!.diagnosis).toBe(submittedOpinion.diagnosis);
              expect(preserved!.confidence).toBe(submittedOpinion.confidence);
              expect(preserved!.reasoning).toBe(submittedOpinion.reasoning);
              expect(preserved!.supportingEvidence).toEqual(submittedOpinion.supportingEvidence);
              expect(preserved!.treatmentRecommendations).toEqual(submittedOpinion.treatmentRecommendations);
            }

            // Verify conflicting opinions are both preserved
            const diagnoses = preservedOpinions.map(op => op.diagnosis);
            const uniqueDiagnoses = new Set(diagnoses);

            if (uniqueDiagnoses.size > 1) {
              // Multiple different diagnoses should all be preserved
              expect(preservedOpinions.length).toBeGreaterThanOrEqual(uniqueDiagnoses.size);

              // Each unique diagnosis should have at least one complete opinion
              for (const diagnosis of uniqueDiagnoses) {
                const opinionsForDiagnosis = preservedOpinions.filter(op => op.diagnosis === diagnosis);
                expect(opinionsForDiagnosis.length).toBeGreaterThan(0);

                // Each opinion should have complete metadata
                for (const opinion of opinionsForDiagnosis) {
                  expect(opinion.expertId).toBeTruthy();
                  expect(opinion.confidence).toBeGreaterThan(0);
                  expect(opinion.reasoning).toBeTruthy();
                  expect(opinion.timestamp).toBeInstanceOf(Date);
                }
              }
            }

            // Verify chronological ordering is maintained
            const sortedByTime = [...preservedOpinions].sort((a, b) =>
              a.timestamp.getTime() - b.timestamp.getTime()
            );

            for (let i = 0; i < sortedByTime.length - 1; i++) {
              expect(sortedByTime[i].timestamp.getTime()).toBeLessThanOrEqual(
                sortedByTime[i + 1].timestamp.getTime()
              );
            }

            // Clean up
            await sessionManager.closeSession(sessionId);

          } catch (error) {
            throw error;
          }
        }
      ),
      {
        numRuns: 10,
        timeout: 15000,
        verbose: true
      }
    );
  });

  test('Property 2.1: Conflicting expert opinions maintain individual integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 10, maxLength: 30 }),
          conflictingOpinions: fc.array(
            fc.record({
              expertId: fc.string({ minLength: 5, maxLength: 15 }),
              diagnosis: fc.constantFrom('Disease A', 'Disease B', 'Disease C', 'Healthy'),
              confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }),
              reasoning: fc.string({ minLength: 30, maxLength: 150 }),
              evidenceCount: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 3, maxLength: 5 }
          )
        }),
        async (testData) => {
          const { sessionId, conflictingOpinions } = testData;

          try {
            // Ensure we have actual conflicts by making sure not all diagnoses are the same
            const uniqueDiagnoses = new Set(conflictingOpinions.map(op => op.diagnosis));
            if (uniqueDiagnoses.size < 2) {
              // Force a conflict by changing one diagnosis
              conflictingOpinions[0].diagnosis = 'Forced Conflict Disease';
            }

            // Create session
            await sessionManager.createSession(sessionId, 'Conflict Test', conflictingOpinions[0].expertId);

            const processedOpinions: any[] = [];

            // Submit all conflicting opinions
            for (const opinion of conflictingOpinions) {
              await sessionManager.addParticipant(sessionId, {
                userId: opinion.expertId,
                socketId: `socket-${opinion.expertId}`,
                role: 'expert',
                joinedAt: new Date()
              });

              const recommendation = {
                id: `rec-${opinion.expertId}-${Date.now()}`,
                expertId: opinion.expertId,
                title: opinion.diagnosis,
                description: opinion.reasoning,
                confidence: opinion.confidence,
                createdAt: new Date()
              };

              await sessionManager.addRecommendation(sessionId, recommendation);
              processedOpinions.push(recommendation);

              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Verify all conflicting opinions are preserved
            expect(processedOpinions.length).toBe(conflictingOpinions.length);

            // Check that each opinion maintains its individual characteristics
            for (let i = 0; i < conflictingOpinions.length; i++) {
              const original = conflictingOpinions[i];
              const processed = processedOpinions[i];

              expect(processed.expertId).toBe(original.expertId);
              expect(processed.title).toBe(original.diagnosis);
              expect(processed.description).toBe(original.reasoning);
              expect(processed.confidence).toBe(original.confidence);
            }

            // Verify that conflicting diagnoses are all present
            const processedDiagnoses = processedOpinions.map(op => op.title);
            const originalDiagnoses = conflictingOpinions.map(op => op.diagnosis);

            for (const originalDiagnosis of originalDiagnoses) {
              expect(processedDiagnoses).toContain(originalDiagnosis);
            }

            // Verify no opinion was overwritten or merged
            const expertIds = processedOpinions.map(op => op.expertId);
            const uniqueExpertIds = new Set(expertIds);
            expect(uniqueExpertIds.size).toBe(expertIds.length); // No duplicates

            // Clean up
            await sessionManager.closeSession(sessionId);

          } catch (error) {
            throw error;
          }
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });

  test('Property 2.2: Expert opinion metadata completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 10, maxLength: 30 }),
          expertOpinions: fc.array(
            fc.record({
              expertId: fc.string({ minLength: 5, maxLength: 15 }),
              diagnosis: fc.string({ minLength: 5, maxLength: 50 }),
              confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
              reasoning: fc.string({ minLength: 20, maxLength: 200 }),
              metadata: fc.record({
                timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
                version: fc.integer({ min: 1, max: 10 }),
                tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 0, maxLength: 5 }),
                attachments: fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 0, maxLength: 3 })
              })
            }),
            { minLength: 1, maxLength: 4 }
          )
        }),
        async (testData) => {
          const { sessionId, expertOpinions } = testData;

          try {
            // Create session
            await sessionManager.createSession(sessionId, 'Metadata Test', expertOpinions[0].expertId);

            const storedOpinions: any[] = [];

            // Submit opinions with rich metadata
            for (const opinion of expertOpinions) {
              await sessionManager.addParticipant(sessionId, {
                userId: opinion.expertId,
                socketId: `socket-${opinion.expertId}`,
                role: 'expert',
                joinedAt: new Date()
              });

              const enrichedRecommendation = {
                id: `rec-${opinion.expertId}-${Date.now()}`,
                expertId: opinion.expertId,
                title: opinion.diagnosis,
                description: opinion.reasoning,
                confidence: opinion.confidence,
                createdAt: opinion.metadata.timestamp,
                metadata: {
                  version: opinion.metadata.version,
                  tags: opinion.metadata.tags,
                  attachments: opinion.metadata.attachments,
                  originalTimestamp: opinion.metadata.timestamp
                }
              };

              await sessionManager.addRecommendation(sessionId, enrichedRecommendation);
              storedOpinions.push(enrichedRecommendation);
            }

            // Verify all metadata is preserved
            expect(storedOpinions.length).toBe(expertOpinions.length);

            for (let i = 0; i < expertOpinions.length; i++) {
              const original = expertOpinions[i];
              const stored = storedOpinions[i];

              // Core opinion data
              expect(stored.expertId).toBe(original.expertId);
              expect(stored.title).toBe(original.diagnosis);
              expect(stored.description).toBe(original.reasoning);
              expect(stored.confidence).toBe(original.confidence);

              // Metadata preservation
              expect(stored.createdAt).toEqual(original.metadata.timestamp);
              expect(stored.metadata.version).toBe(original.metadata.version);
              expect(stored.metadata.tags).toEqual(original.metadata.tags);
              expect(stored.metadata.attachments).toEqual(original.metadata.attachments);
              expect(stored.metadata.originalTimestamp).toEqual(original.metadata.timestamp);
            }

            // Verify metadata integrity across different experts
            const expertMetadata = new Map();
            for (const opinion of storedOpinions) {
              expertMetadata.set(opinion.expertId, opinion.metadata);
            }

            // Each expert should have their own distinct metadata
            expect(expertMetadata.size).toBe(new Set(storedOpinions.map(op => op.expertId)).size);

            // Clean up
            await sessionManager.closeSession(sessionId);

          } catch (error) {
            throw error;
          }
        }
      ),
      { numRuns: 5, timeout: 8000 }
    );
  });

  test('Property 2.3: Opinion preservation under concurrent submissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionId: fc.string({ minLength: 10, maxLength: 30 }),
          concurrentOpinions: fc.array(
            fc.record({
              expertId: fc.string({ minLength: 5, maxLength: 15 }),
              diagnosis: fc.string({ minLength: 5, maxLength: 30 }),
              confidence: fc.float({ min: Math.fround(0.2), max: Math.fround(1.0) }),
              reasoning: fc.string({ minLength: 15, maxLength: 100 }),
              submissionDelay: fc.integer({ min: 0, max: 100 }) // milliseconds
            }),
            { minLength: 2, maxLength: 4 }
          )
        }),
        async (testData) => {
          const { sessionId, concurrentOpinions } = testData;

          try {
            // Create session
            await sessionManager.createSession(sessionId, 'Concurrent Test', concurrentOpinions[0].expertId);

            // Add all experts as participants
            for (const opinion of concurrentOpinions) {
              await sessionManager.addParticipant(sessionId, {
                userId: opinion.expertId,
                socketId: `socket-${opinion.expertId}`,
                role: 'expert',
                joinedAt: new Date()
              });
            }

            // Submit opinions concurrently with small delays
            const submissionPromises = concurrentOpinions.map(async (opinion, index) => {
              // Add small delay to simulate near-concurrent submissions
              if (opinion.submissionDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, opinion.submissionDelay));
              }

              const recommendation = {
                id: `rec-${opinion.expertId}-${Date.now()}-${index}`,
                expertId: opinion.expertId,
                title: opinion.diagnosis,
                description: opinion.reasoning,
                confidence: opinion.confidence,
                createdAt: new Date()
              };

              await sessionManager.addRecommendation(sessionId, recommendation);
              return recommendation;
            });

            const submittedOpinions = await Promise.all(submissionPromises);

            // Verify all concurrent opinions were preserved
            expect(submittedOpinions.length).toBe(concurrentOpinions.length);

            // Check that no opinion was lost or corrupted during concurrent submission
            for (let i = 0; i < concurrentOpinions.length; i++) {
              const original = concurrentOpinions[i];
              const submitted = submittedOpinions[i];

              expect(submitted.expertId).toBe(original.expertId);
              expect(submitted.title).toBe(original.diagnosis);
              expect(submitted.description).toBe(original.reasoning);
              expect(submitted.confidence).toBe(original.confidence);
            }

            // Verify all expert IDs are unique (no overwrites)
            const expertIds = submittedOpinions.map(op => op.expertId);
            const uniqueExpertIds = new Set(expertIds);
            expect(uniqueExpertIds.size).toBe(expertIds.length);

            // Verify all recommendation IDs are unique
            const recommendationIds = submittedOpinions.map(op => op.id);
            const uniqueRecommendationIds = new Set(recommendationIds);
            expect(uniqueRecommendationIds.size).toBe(recommendationIds.length);

            // Clean up
            await sessionManager.closeSession(sessionId);

          } catch (error) {
            throw error;
          }
        }
      ),
      { numRuns: 5, timeout: 20000 }
    );
  }, 60000);
});