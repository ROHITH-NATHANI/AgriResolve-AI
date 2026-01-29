import { logger } from '../utils/logger';

interface SessionParticipant {
  userId: string;
  socketId: string;
  role: 'farmer' | 'expert' | 'observer';
  joinedAt: Date;
  lastActivity?: Date;
}

interface SessionState {
  sessionId: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  participants: SessionParticipant[];
  workspaceState: WorkspaceState;
  chatHistory: ChatMessage[];
  status: 'active' | 'paused' | 'completed';
}

interface WorkspaceState {
  cropImages: ImageAnnotation[];
  diagnosticData: any[];
  annotations: DrawingAnnotation[];
  expertRecommendations: Recommendation[];
}

interface ImageAnnotation {
  id: string;
  imageUrl: string;
  annotations: DrawingAnnotation[];
  metadata: Record<string, any>;
}

interface DrawingAnnotation {
  id: string;
  type: 'circle' | 'rectangle' | 'arrow' | 'text' | 'freehand';
  coordinates: number[];
  style: {
    color: string;
    strokeWidth: number;
    fillColor?: string;
  };
  text?: string;
  createdBy: string;
  createdAt: Date;
}

interface Recommendation {
  id: string;
  expertId: string;
  title: string;
  description: string;
  confidence: number;
  createdAt: Date;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  message: string;
  type: 'text' | 'image' | 'file' | 'system';
  timestamp: string;
}

class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  public async createSession(
    sessionId: string,
    title: string,
    createdBy: string
  ): Promise<SessionState> {
    const session: SessionState = {
      sessionId,
      title,
      createdBy,
      createdAt: new Date(),
      participants: [],
      workspaceState: {
        cropImages: [],
        diagnosticData: [],
        annotations: [],
        expertRecommendations: []
      },
      chatHistory: [],
      status: 'active'
    };

    this.sessions.set(sessionId, session);
    
    // Add creator as first participant
    await this.addParticipant(sessionId, {
      userId: createdBy,
      socketId: '', // Will be set when they connect
      role: 'farmer',
      joinedAt: new Date()
    });

    logger.info(`Session created: ${sessionId} by ${createdBy}`);
    return session;
  }

  public async getSession(sessionId: string): Promise<SessionState | null> {
    return this.sessions.get(sessionId) || null;
  }

  public async getSessionState(sessionId: string): Promise<WorkspaceState | null> {
    const session = this.sessions.get(sessionId);
    return session ? session.workspaceState : null;
  }

  public async updateSessionState(
    sessionId: string,
    update: Partial<WorkspaceState>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Merge the update with existing state
    session.workspaceState = {
      ...session.workspaceState,
      ...update
    };

    logger.debug(`Session state updated: ${sessionId}`);
  }

  public async addParticipant(
    sessionId: string,
    participant: SessionParticipant
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Remove existing participant with same userId (reconnection case)
    session.participants = session.participants.filter(p => p.userId !== participant.userId);
    
    // Add new participant
    session.participants.push(participant);

    // Track user sessions
    if (!this.userSessions.has(participant.userId)) {
      this.userSessions.set(participant.userId, new Set());
    }
    this.userSessions.get(participant.userId)!.add(sessionId);

    logger.debug(`Participant added to session ${sessionId}: ${participant.userId}`);
  }

  public async removeParticipant(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Session might have been cleaned up
    }

    session.participants = session.participants.filter(p => p.userId !== userId);

    // Update user sessions tracking
    const userSessionSet = this.userSessions.get(userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(userId);
      }
    }

    logger.debug(`Participant removed from session ${sessionId}: ${userId}`);
  }

  public async canUserJoinSession(userId: string, sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // For now, allow anyone to join any active session
    // TODO: Implement proper access control based on invitations, permissions, etc.
    return session.status === 'active';
  }

  public async addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.chatHistory.push(message);

    // Keep only last 100 messages in memory
    if (session.chatHistory.length > 100) {
      session.chatHistory = session.chatHistory.slice(-100);
    }

    logger.debug(`Chat message added to session ${sessionId}`);
  }

  public async addAnnotation(
    sessionId: string,
    imageId: string,
    annotation: DrawingAnnotation
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Find or create image annotation
    let imageAnnotation = session.workspaceState.cropImages.find(img => img.id === imageId);
    if (!imageAnnotation) {
      imageAnnotation = {
        id: imageId,
        imageUrl: '', // Will be set when image is uploaded
        annotations: [],
        metadata: {}
      };
      session.workspaceState.cropImages.push(imageAnnotation);
    }

    imageAnnotation.annotations.push(annotation);
    logger.debug(`Annotation added to session ${sessionId}, image ${imageId}`);
  }

  public async addRecommendation(
    sessionId: string,
    recommendation: Recommendation
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.workspaceState.expertRecommendations.push(recommendation);
    logger.debug(`Recommendation added to session ${sessionId} by ${recommendation.expertId}`);
  }

  public async getParticipants(sessionId: string): Promise<SessionParticipant[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.participants : [];
  }

  public async getUserSessions(userId: string): Promise<string[]> {
    const sessionSet = this.userSessions.get(userId);
    return sessionSet ? Array.from(sessionSet) : [];
  }

  public async updateParticipantActivity(
    sessionId: string,
    userId: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.lastActivity = new Date();
    }
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    
    // Remove participants from tracking
    session.participants.forEach(participant => {
      const userSessionSet = this.userSessions.get(participant.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(participant.userId);
        }
      }
    });

    logger.info(`Session closed: ${sessionId}`);
  }

  public async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = Math.max(
        session.createdAt.getTime(),
        ...session.participants.map(p => p.lastActivity?.getTime() || 0)
      );

      if (now.getTime() - lastActivity > inactiveThreshold) {
        await this.closeSession(sessionId);
        this.sessions.delete(sessionId);
        logger.info(`Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  // Periodic cleanup
  public startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60 * 60 * 1000); // Run every hour
  }
}

export const sessionManager = new SessionManager();

// Start cleanup timer
sessionManager.startCleanupTimer();