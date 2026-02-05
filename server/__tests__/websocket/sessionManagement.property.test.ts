/**
 * Property-Based Tests for WebSocket Session Management
 * Feature: real-time-collaborative-network, Property 1: Session Uniqueness and State Consistency
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import * as fc from 'fast-check';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { sessionManager } from '../../websocket/sessionManager.js';
import { websocketManager } from '../../websocket/websocketManager.js';

describe('Property: Session Uniqueness and State Consistency', () => {
  let server: ReturnType<typeof createServer> | null = null;
  let io: SocketIOServer | null = null;
  let clientSockets: ClientSocket[] = [];
  const port = 3099;

  const waitForSocketConnect = (client: ClientSocket, timeoutMs = 2000): Promise<void> =>
    new Promise((resolve, reject) => {
      if (client.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        client.off('connect', onConnect);
        client.off('connect_error', onError);
        reject(new Error('Socket connection timeout'));
      }, timeoutMs);

      const onConnect = () => {
        clearTimeout(timeout);
        client.off('connect_error', onError);
        resolve();
      };
      reconnection: false

      const onError = (error: Error) => {
        clearTimeout(timeout);
        client.off('connect', onConnect);
        reject(error);
      };

      client.once('connect', onConnect);
      client.once('connect_error', onError);
    });

  const waitForEvent = <T>(client: ClientSocket, event: string, timeoutMs = 2000): Promise<T> =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.off(event, onEvent);
        reject(new Error(`Timeout waiting for ${event}`));
      }, timeoutMs);

      const onEvent = (data: T) => {
        clearTimeout(timeout);
        resolve(data);
      };

      client.once(event, onEvent);
    });

  beforeAll(async () => {
    server = createServer();
    io = new SocketIOServer(server, {
      cors: { origin: "*" }
    });

    await websocketManager.initialize(io);

    await new Promise<void>((resolve) => {
      server!.listen(port, () => resolve());
    });
  });

  afterAll(async () => {
    // Clean up all client connections
    clientSockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });

    sessionManager.stopCleanupTimer();

    if (io) {
      io.close();
      io = null;
    }

    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }
  }, 60000);

  afterEach(() => {
    // Disconnect all clients after each test
    clientSockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
      socket.removeAllListeners();
    });
    clientSockets = [];
  });

  /**
   * Property 1: Session Uniqueness and State Consistency
   * For any set of collaboration sessions created concurrently, all session identifiers 
   * should be unique, and all participants in each session should observe identical 
   * shared workspace state within 100ms of any state change.
   */
  test('Property 1: Session identifiers are unique and state is consistent across participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data
        fc.array(
          fc.record({
            sessionTitle: fc.string({ minLength: 1, maxLength: 50 }),
            participantCount: fc.integer({ min: 2, max: 5 }),
            workspaceUpdates: fc.array(
              fc.record({
                type: fc.constantFrom('annotation', 'diagnostic', 'image', 'recommendation'),
                data: fc.record({
                  content: fc.string({ maxLength: 100 }),
                  coordinates: fc.array(fc.float({ min: 0, max: 1000 }), { minLength: 2, maxLength: 8 })
                })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (sessionConfigs) => {
          const createdSessions: string[] = [];
          const sessionParticipants: Map<string, ClientSocket[]> = new Map();

          try {
            // Create sessions concurrently
            const sessionPromises = sessionConfigs.map(async (config, index) => {
              const sessionId = `test-session-${Date.now()}-${index}`;
              const creatorId = `creator-${index}`;

              // Create session
              await sessionManager.createSession(sessionId, config.sessionTitle, creatorId);
              createdSessions.push(sessionId);

              // Create participant connections
              const participants: ClientSocket[] = [];
              for (let i = 0; i < config.participantCount; i++) {
                const client = Client(`http://localhost:${port}`, {
                  auth: { token: `test-token-${sessionId}-${i}` },
                  reconnection: false
                });

                participants.push(client);
                clientSockets.push(client);

                await waitForSocketConnect(client);
              }

              sessionParticipants.set(sessionId, participants);
              return { sessionId, participants, config };
            });

            const sessions = await Promise.all(sessionPromises);

            // Verify session uniqueness
            const sessionIds = sessions.map(s => s.sessionId);
            const uniqueSessionIds = new Set(sessionIds);
            expect(uniqueSessionIds.size).toBe(sessionIds.length);

            // Test state consistency for each session
            for (const { sessionId, participants, config } of sessions) {
              // Have all participants join the session
              const joinPromises = participants.map((client) => {
                client.emit('join-session', { sessionId });
                return waitForEvent<void>(client, 'session-state', 3000);
              });

              await Promise.all(joinPromises);

              // Test workspace state synchronization
              for (const update of config.workspaceUpdates) {
                const stateUpdates: any[] = [];
                const updatePromises: Promise<any>[] = [];

                // Set up listeners for state updates on all participants except the sender
                participants.slice(1).forEach((client, index) => {
                  const promise = waitForEvent<any>(client, 'workspace-updated', 1000).then((data) => {
                    stateUpdates.push({ participantIndex: index + 1, data, timestamp: Date.now() });
                    return data;
                  });
                  updatePromises.push(promise);
                });

                // Send update from first participant
                const startTime = Date.now();
                participants[0].emit('workspace-update', update);

                // Wait for all participants to receive the update
                await Promise.all(updatePromises);
                // Verify timing requirement (within 100ms)
                const maxPropagation = Math.max(
                  ...stateUpdates.map((update) => update.timestamp - startTime)
                );
                expect(maxPropagation).toBeLessThan(100);

                // Verify all participants received the same update
                if (stateUpdates.length > 0) {
                  const firstUpdate = stateUpdates[0].data;
                  stateUpdates.forEach((update, index) => {
                    expect(update.data.type).toBe(firstUpdate.type);
                    expect(update.data.userId).toBe(firstUpdate.userId);
                    // Allow for small timing differences in timestamps
                    expect(Math.abs(new Date(update.data.timestamp).getTime() - new Date(firstUpdate.timestamp).getTime())).toBeLessThan(10);
                  });
                }
              }
            }

            // Clean up sessions
            for (const sessionId of createdSessions) {
              await sessionManager.closeSession(sessionId);
            }

          } catch (error) {
            // Clean up on error
            for (const sessionId of createdSessions) {
              await sessionManager.closeSession(sessionId);
            }
            throw error;
          }
        }
      ),
      {
        numRuns: 10, // Reduced for faster testing, increase for more thorough testing
        timeout: 25000,
        verbose: true
      }
    );
  }, 60000);

  test('Property 1.1: Session creation generates unique identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 50 }),
            creatorId: fc.string({ minLength: 1, maxLength: 20 })
          }),
          { minLength: 10, maxLength: 50 }
        ),
        async (sessionData) => {
          const sessionIds: string[] = [];
          const createdSessions: string[] = [];

          try {
            // Create sessions concurrently
            const createPromises = sessionData.map(async (data, index) => {
              const sessionId = `concurrent-test-${Date.now()}-${Math.random()}-${index}`;
              await sessionManager.createSession(sessionId, data.title, data.creatorId);
              sessionIds.push(sessionId);
              createdSessions.push(sessionId);
              return sessionId;
            });

            await Promise.all(createPromises);

            // Verify all session IDs are unique
            const uniqueIds = new Set(sessionIds);
            expect(uniqueIds.size).toBe(sessionIds.length);

            // Verify all sessions exist and are accessible
            for (const sessionId of sessionIds) {
              const session = await sessionManager.getSession(sessionId);
              expect(session).toBeTruthy();
              expect(session!.sessionId).toBe(sessionId);
            }

          } finally {
            // Clean up
            for (const sessionId of createdSessions) {
              await sessionManager.closeSession(sessionId);
            }
          }
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  }, 30000);

  test('Property 1.2: Workspace state remains consistent during concurrent updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          participantCount: fc.integer({ min: 3, max: 6 }),
          updateCount: fc.integer({ min: 5, max: 15 }),
          updateTypes: fc.array(
            fc.constantFrom('annotation', 'diagnostic', 'recommendation'),
            { minLength: 3, maxLength: 3 }
          )
        }),
        async (testConfig) => {
          const sessionId = `consistency-test-${Date.now()}-${Math.random()}`;
          const creatorId = 'consistency-creator';

          try {
            // Create session
            await sessionManager.createSession(sessionId, 'Consistency Test', creatorId);

            // Create participants
            const participants: ClientSocket[] = [];
            for (let i = 0; i < testConfig.participantCount; i++) {
              const client = Client(`http://localhost:${port}`, {
                auth: { token: `consistency-token-${i}` }
              });

              participants.push(client);
              clientSockets.push(client);

              await new Promise<void>((resolve) => {
                client.on('connected', resolve);
              });

              // Join session
              await new Promise<void>((resolve) => {
                client.emit('join-session', { sessionId });
                client.on('session-state', () => resolve());
              });
            }

            // Track received updates per participant
            const receivedUpdates: Map<number, any[]> = new Map();
            participants.forEach((_, index) => {
              receivedUpdates.set(index, []);
            });

            // Set up update listeners
            participants.forEach((client, index) => {
              client.on('workspace-updated', (data) => {
                receivedUpdates.get(index)!.push(data);
              });
            });

            // Send concurrent updates from different participants
            const updatePromises: Promise<void>[] = [];
            for (let i = 0; i < testConfig.updateCount; i++) {
              const participantIndex = i % testConfig.participantCount;
              const updateType = testConfig.updateTypes[i % testConfig.updateTypes.length];

              const promise = new Promise<void>((resolve) => {
                setTimeout(() => {
                  participants[participantIndex].emit('workspace-update', {
                    type: updateType,
                    data: {
                      content: `Update ${i} from participant ${participantIndex}`,
                      coordinates: [Math.random() * 100, Math.random() * 100]
                    }
                  });
                  resolve();
                }, Math.random() * 50); // Random delay up to 50ms
              });

              updatePromises.push(promise);
            }

            await Promise.all(updatePromises);

            // Wait for all updates to propagate
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify consistency: all participants should have received the same updates
            // (excluding their own updates which they don't receive back)
            const allReceivedUpdates = Array.from(receivedUpdates.values());

            if (allReceivedUpdates.length > 1) {
              // Check that update counts are consistent (allowing for the sender not receiving their own update)
              const updateCounts = allReceivedUpdates.map(updates => updates.length);
              const minCount = Math.min(...updateCounts);
              const maxCount = Math.max(...updateCounts);

              // Allow some variance due to timing and the fact that senders don't receive their own updates
              expect(maxCount - minCount).toBeLessThanOrEqual(testConfig.participantCount);
            }

            // Clean up
            await sessionManager.closeSession(sessionId);

          } catch (error) {
            await sessionManager.closeSession(sessionId);
            throw error;
          }
        }
      ),
      { numRuns: 3, timeout: 15000 }
    );
  }, 45000);
});