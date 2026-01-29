import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { sessionManager } from './sessionManager.js';
import { eventProcessor } from './eventProcessor.js';
import { webrtcSignalingServer } from '../webrtc/signalingServer.js';
import { annotationToolManager } from './annotationTools.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

class WebSocketManager {
  private io: SocketIOServer | null = null;
  private redisClient: any = null;
  private redisSubClient: any = null;

  public async initialize(io: SocketIOServer): Promise<void> {
    this.io = io;

    // Set up Redis adapter for horizontal scaling
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = createClient({ url: process.env.REDIS_URL });
        this.redisSubClient = this.redisClient.duplicate();

        await Promise.all([
          this.redisClient.connect(),
          this.redisSubClient.connect()
        ]);

        io.adapter(createAdapter(this.redisClient, this.redisSubClient));
        logger.info('Redis adapter configured for WebSocket scaling');
      } catch (error) {
        logger.warn('Redis connection failed, using memory adapter:', error);
      }
    }

    // Initialize WebRTC signaling server
    webrtcSignalingServer.initialize(io);

    // Authentication middleware
    io.use(this.authenticateSocket.bind(this));

    // Connection handling
    io.on('connection', this.handleConnection.bind(this));

    logger.info('WebSocket manager initialized');
  }

  private async authenticateSocket(socket: AuthenticatedSocket, next: Function): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

      if (!token) {
        // For development, allow unauthenticated connections
        if (process.env.NODE_ENV === 'development') {
          socket.userId = 'dev-user-1';
          socket.userRole = 'farmer';
          return next();
        }

        return next(new Error('Authentication required'));
      }

      // TODO: Implement proper JWT verification
      // For now, extract user info from token
      socket.userId = 'user-' + Math.random().toString(36).substr(2, 9);
      socket.userRole = 'farmer';

      logger.debug(`Socket authenticated: ${socket.userId}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

    // Join user to their personal room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Set up WebRTC signaling handlers
    webrtcSignalingServer.setupSignalingHandlers(socket, socket.userId!);

    // Handle collaboration session events
    this.setupCollaborationHandlers(socket);

    // Handle expert consultation events
    this.setupConsultationHandlers(socket);

    // Handle community events
    this.setupCommunityHandlers(socket);

    // Handle IoT events
    this.setupIoTHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to AgriResolve Collaborative Network',
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });
  }

  private setupCollaborationHandlers(socket: AuthenticatedSocket): void {
    // Join collaboration session
    socket.on('join-session', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;

        // Validate session access
        const canJoin = await sessionManager.canUserJoinSession(socket.userId!, sessionId);
        if (!canJoin) {
          socket.emit('error', { message: 'Access denied to session' });
          return;
        }

        // Leave previous session if any
        if (socket.sessionId) {
          socket.leave(`session:${socket.sessionId}`);
          await sessionManager.removeParticipant(socket.sessionId, socket.userId!);
        }

        // Join new session
        socket.join(`session:${sessionId}`);
        socket.sessionId = sessionId;

        await sessionManager.addParticipant(sessionId, {
          userId: socket.userId!,
          socketId: socket.id,
          role: socket.userRole as any,
          joinedAt: new Date()
        });

        // Notify other participants
        socket.to(`session:${sessionId}`).emit('participant-joined', {
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

        // Send session state to new participant
        const sessionState = await sessionManager.getSessionState(sessionId);
        socket.emit('session-state', sessionState);

        logger.info(`User ${socket.userId} joined session ${sessionId}`);
      } catch (error) {
        logger.error('Error joining session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Leave collaboration session
    socket.on('leave-session', async () => {
      if (socket.sessionId) {
        await this.leaveSession(socket);
      }
    });

    // Handle workspace state changes
    socket.on('workspace-update', async (data: any) => {
      if (!socket.sessionId) {
        socket.emit('error', { message: 'Not in a session' });
        return;
      }

      try {
        // Process the update
        const processedUpdate = await eventProcessor.processWorkspaceUpdate(
          socket.sessionId,
          socket.userId!,
          data
        );

        // Broadcast to other session participants
        socket.to(`session:${socket.sessionId}`).emit('workspace-updated', processedUpdate);

        // Update session state
        await sessionManager.updateSessionState(socket.sessionId, processedUpdate as any);

        logger.debug(`Workspace updated in session ${socket.sessionId} by ${socket.userId}`);
      } catch (error) {
        logger.error('Error processing workspace update:', error);
        socket.emit('error', { message: 'Failed to update workspace' });
      }
    });

    // Handle real-time annotations
    socket.on('annotation-update', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        const annotationUpdate = await eventProcessor.processAnnotationUpdate(
          socket.sessionId,
          socket.userId!,
          data
        );

        socket.to(`session:${socket.sessionId}`).emit('annotation-updated', annotationUpdate);

        logger.debug(`Annotation updated in session ${socket.sessionId}`);
      } catch (error) {
        logger.error('Error processing annotation update:', error);
      }
    });

    // Handle annotation tool events
    socket.on('start-drawing', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        await annotationToolManager.startDrawing(
          socket.sessionId,
          socket.userId!,
          data.toolId,
          data.startPoint,
          data.settings
        );
      } catch (error) {
        logger.error('Error starting drawing:', error);
        socket.emit('error', { message: 'Failed to start drawing' });
      }
    });

    socket.on('continue-drawing', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        await annotationToolManager.continueDrawing(
          socket.sessionId,
          socket.userId!,
          data.point
        );
      } catch (error) {
        logger.error('Error continuing drawing:', error);
      }
    });

    socket.on('finish-drawing', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        const annotation = await annotationToolManager.finishDrawing(
          socket.sessionId,
          socket.userId!,
          data.endPoint,
          data.text
        );

        socket.emit('drawing-completed', { annotation });
      } catch (error) {
        logger.error('Error finishing drawing:', error);
        socket.emit('error', { message: 'Failed to complete drawing' });
      }
    });

    socket.on('cancel-drawing', async () => {
      if (!socket.sessionId) return;

      try {
        await annotationToolManager.cancelDrawing(socket.sessionId, socket.userId!);
      } catch (error) {
        logger.error('Error cancelling drawing:', error);
      }
    });

    socket.on('update-annotation', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        const updatedAnnotation = await annotationToolManager.updateAnnotation(
          socket.sessionId,
          socket.userId!,
          data.annotationId,
          data.updates
        );

        socket.emit('annotation-update-completed', { annotation: updatedAnnotation });
      } catch (error) {
        logger.error('Error updating annotation:', error);
        socket.emit('error', { message: 'Failed to update annotation' });
      }
    });

    socket.on('delete-annotation', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        await annotationToolManager.deleteAnnotation(
          socket.sessionId,
          socket.userId!,
          data.annotationId
        );

        socket.emit('annotation-delete-completed', { annotationId: data.annotationId });
      } catch (error) {
        logger.error('Error deleting annotation:', error);
        socket.emit('error', { message: 'Failed to delete annotation' });
      }
    });

    socket.on('get-annotation-tools', () => {
      const tools = annotationToolManager.getAvailableTools();
      socket.emit('annotation-tools', { tools });
    });

    socket.on('get-session-annotations', (data: any) => {
      if (!socket.sessionId) return;

      try {
        const annotations = annotationToolManager.getSessionAnnotations(
          socket.sessionId,
          data.layerId
        );
        socket.emit('session-annotations', { annotations });
      } catch (error) {
        logger.error('Error getting session annotations:', error);
        socket.emit('error', { message: 'Failed to get annotations' });
      }
    });

    // Handle conflict resolution
    socket.on('resolve-conflict', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        await eventProcessor.handleConflictResolution(
          socket.sessionId,
          data.conflictId,
          data.resolution
        );

        // Notify all participants of conflict resolution
        this.io!.to(`session:${socket.sessionId}`).emit('conflict-resolved', {
          conflictId: data.conflictId,
          resolution: data.resolution,
          resolvedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

        logger.info(`Conflict resolved in session ${socket.sessionId}: ${data.conflictId}`);
      } catch (error) {
        logger.error('Error resolving conflict:', error);
        socket.emit('error', { message: 'Failed to resolve conflict' });
      }
    });

    socket.on('get-pending-conflicts', () => {
      if (!socket.sessionId) return;

      try {
        const conflicts = eventProcessor.getPendingConflicts(socket.sessionId);
        socket.emit('pending-conflicts', { conflicts });
      } catch (error) {
        logger.error('Error getting pending conflicts:', error);
      }
    });

    // Handle batch operations for better performance
    socket.on('batch-operations', async (data: any) => {
      if (!socket.sessionId) return;

      try {
        const updates = await eventProcessor.processBatchOperations(
          socket.sessionId,
          socket.userId!,
          data.operations
        );

        // Broadcast all updates to other participants
        socket.to(`session:${socket.sessionId}`).emit('batch-updates', { updates });

        socket.emit('batch-operations-completed', { updates });
        logger.debug(`Processed batch of ${data.operations.length} operations in session ${socket.sessionId}`);
      } catch (error) {
        logger.error('Error processing batch operations:', error);
        socket.emit('error', { message: 'Failed to process batch operations' });
      }
    });

    // Handle chat messages
    socket.on('chat-message', async (data: { message: string, type?: string }) => {
      if (!socket.sessionId) return;

      try {
        const chatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId: socket.sessionId,
          userId: socket.userId!,
          message: data.message,
          type: (data.type || 'text') as "text" | "image" | "file" | "system",
          timestamp: new Date().toISOString()
        };

        // Broadcast to all session participants
        this.io!.to(`session:${socket.sessionId}`).emit('chat-message', chatMessage);

        // Store message in session history
        await sessionManager.addChatMessage(socket.sessionId, chatMessage);

        logger.debug(`Chat message sent in session ${socket.sessionId}`);
      } catch (error) {
        logger.error('Error processing chat message:', error);
      }
    });
  }

  private setupConsultationHandlers(socket: AuthenticatedSocket): void {
    // Request expert consultation
    socket.on('request-consultation', async (data: any) => {
      try {
        // TODO: Implement expert matching logic
        socket.emit('consultation-requested', {
          requestId: `req-${Date.now()}`,
          status: 'pending',
          timestamp: new Date().toISOString()
        });

        logger.info(`Consultation requested by ${socket.userId}`);
      } catch (error) {
        logger.error('Error requesting consultation:', error);
      }
    });

    // WebRTC signaling for video consultation
    socket.on('webrtc-signal', (data: any) => {
      if (data.targetUserId) {
        socket.to(`user:${data.targetUserId}`).emit('webrtc-signal', {
          ...data,
          fromUserId: socket.userId
        });
      }
    });
  }

  private setupCommunityHandlers(socket: AuthenticatedSocket): void {
    // Join geographic region for outbreak updates
    socket.on('join-region', (data: { region: string }) => {
      socket.join(`region:${data.region}`);
      logger.debug(`User ${socket.userId} joined region ${data.region}`);
    });

    // Submit validation vote
    socket.on('submit-validation', async (data: any) => {
      try {
        // TODO: Process validation vote
        socket.emit('validation-submitted', {
          validationId: data.validationId,
          status: 'recorded',
          timestamp: new Date().toISOString()
        });

        logger.info(`Validation submitted by ${socket.userId}`);
      } catch (error) {
        logger.error('Error submitting validation:', error);
      }
    });
  }

  private setupIoTHandlers(socket: AuthenticatedSocket): void {
    // Subscribe to IoT sensor updates
    socket.on('subscribe-sensors', (data: { farmId: string }) => {
      socket.join(`farm:${data.farmId}`);
      logger.debug(`User ${socket.userId} subscribed to farm ${data.farmId} sensors`);
    });

    // Handle sensor data (for IoT devices)
    socket.on('sensor-data', async (data: any) => {
      try {
        // Broadcast to farm subscribers
        if (data.farmId) {
          socket.to(`farm:${data.farmId}`).emit('sensor-update', {
            ...data,
            timestamp: new Date().toISOString()
          });
        }

        logger.debug(`Sensor data received from ${socket.userId}`);
      } catch (error) {
        logger.error('Error processing sensor data:', error);
      }
    });
  }

  private async leaveSession(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.sessionId) return;

    try {
      socket.leave(`session:${socket.sessionId}`);

      // Notify other participants
      socket.to(`session:${socket.sessionId}`).emit('participant-left', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

      // Remove from session
      await sessionManager.removeParticipant(socket.sessionId, socket.userId!);

      logger.info(`User ${socket.userId} left session ${socket.sessionId}`);
      socket.sessionId = undefined;
    } catch (error) {
      logger.error('Error leaving session:', error);
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    logger.info(`Client disconnected: ${socket.id} (User: ${socket.userId})`);

    // Leave session if connected
    if (socket.sessionId) {
      this.leaveSession(socket);
    }
  }

  // Public methods for broadcasting
  public broadcastToSession(sessionId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`session:${sessionId}`).emit(event, data);
    }
  }

  public broadcastToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  public broadcastToRegion(region: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`region:${region}`).emit(event, data);
    }
  }

  public broadcastToFarm(farmId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`farm:${farmId}`).emit(event, data);
    }
  }
}

export const websocketManager = new WebSocketManager();