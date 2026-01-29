import express from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { sessionManager } from '../websocket/sessionManager';
import { websocketManager } from '../websocket/websocketManager';

interface CollaborationSession {
  sessionId: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'completed' | 'archived';
  participants: SessionParticipant[];
  permissions: SessionPermissions;
  metadata: SessionMetadata;
}

interface SessionParticipant {
  userId: string;
  role: 'farmer' | 'expert' | 'observer';
  permissions: ParticipantPermissions;
  joinedAt: Date;
  lastActivity?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

interface SessionPermissions {
  canInvite: boolean;
  canModerate: boolean;
  canRecord: boolean;
  canShare: boolean;
  maxParticipants: number;
}

interface ParticipantPermissions {
  canAnnotate: boolean;
  canChat: boolean;
  canViewDiagnostics: boolean;
  canMakeRecommendations: boolean;
  canControlSession: boolean;
}

interface SessionMetadata {
  cropType?: string;
  issueCategory?: string;
  location?: {
    latitude: number;
    longitude: number;
    region: string;
  };
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'emergency';
}

class CollaborationService {
  private app: express.Application;
  private db: Pool;
  private port: number;

  constructor(port: number = 3002) {
    this.app = express();
    this.port = port;
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/agriresolve',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeDatabase();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-ID, X-User-Role');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, { 
        userId: req.headers['x-user-id'],
        userRole: req.headers['x-user-role']
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'collaboration-service',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    });

    // Session management routes
    this.app.post('/sessions', this.createSession.bind(this));
    this.app.get('/sessions/:sessionId', this.getSession.bind(this));
    this.app.put('/sessions/:sessionId', this.updateSession.bind(this));
    this.app.delete('/sessions/:sessionId', this.deleteSession.bind(this));
    this.app.get('/sessions', this.listSessions.bind(this));

    // Participant management routes
    this.app.post('/sessions/:sessionId/participants', this.addParticipant.bind(this));
    this.app.delete('/sessions/:sessionId/participants/:userId', this.removeParticipant.bind(this));
    this.app.put('/sessions/:sessionId/participants/:userId', this.updateParticipant.bind(this));
    this.app.get('/sessions/:sessionId/participants', this.getParticipants.bind(this));

    // Session invitations
    this.app.post('/sessions/:sessionId/invitations', this.createInvitation.bind(this));
    this.app.post('/invitations/:invitationId/accept', this.acceptInvitation.bind(this));
    this.app.post('/invitations/:invitationId/reject', this.rejectInvitation.bind(this));

    // Session permissions
    this.app.put('/sessions/:sessionId/permissions', this.updatePermissions.bind(this));
    this.app.get('/sessions/:sessionId/permissions', this.getPermissions.bind(this));

    // Error handling
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Collaboration service error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create collaboration_sessions table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS collaboration_sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status VARCHAR(50) DEFAULT 'active',
          permissions JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'completed', 'archived'))
        )
      `);

      // Create session_participants table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS session_participants (
          session_id VARCHAR(255) REFERENCES collaboration_sessions(session_id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'observer',
          permissions JSONB DEFAULT '{}',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE,
          connection_status VARCHAR(50) DEFAULT 'disconnected',
          PRIMARY KEY (session_id, user_id),
          CONSTRAINT valid_role CHECK (role IN ('farmer', 'expert', 'observer')),
          CONSTRAINT valid_connection_status CHECK (connection_status IN ('connected', 'disconnected', 'reconnecting'))
        )
      `);

      // Create session_invitations table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS session_invitations (
          invitation_id VARCHAR(255) PRIMARY KEY,
          session_id VARCHAR(255) REFERENCES collaboration_sessions(session_id) ON DELETE CASCADE,
          invited_by VARCHAR(255) NOT NULL,
          invited_user VARCHAR(255) NOT NULL,
          invited_email VARCHAR(255),
          role VARCHAR(50) NOT NULL DEFAULT 'observer',
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE,
          CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
        )
      `);

      // Create indexes for better performance
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON collaboration_sessions(created_by);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON collaboration_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON collaboration_sessions(created_at);
        CREATE INDEX IF NOT EXISTS idx_participants_user_id ON session_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON session_invitations(invited_user);
        CREATE INDEX IF NOT EXISTS idx_invitations_status ON session_invitations(status);
      `);

      logger.info('Collaboration service database initialized');
    } catch (error) {
      logger.error('Failed to initialize collaboration service database:', error);
      throw error;
    }
  }

  // Session management methods will be added in the next part
  private async createSession(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { title, description, metadata, permissions } = req.body;
      const createdBy = req.headers['x-user-id'] as string;

      if (!createdBy) {
        res.status(401).json({ error: 'User authentication required' });
        return;
      }

      if (!title) {
        res.status(400).json({ error: 'Session title is required' });
        return;
      }

      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Default permissions
      const defaultPermissions: SessionPermissions = {
        canInvite: true,
        canModerate: true,
        canRecord: true,
        canShare: true,
        maxParticipants: 10,
        ...permissions
      };

      // Default metadata
      const defaultMetadata: SessionMetadata = {
        tags: [],
        priority: 'medium',
        ...metadata
      };

      // Insert session into database
      await this.db.query(
        `INSERT INTO collaboration_sessions 
         (session_id, title, description, created_by, permissions, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, title, description, createdBy, JSON.stringify(defaultPermissions), JSON.stringify(defaultMetadata)]
      );

      // Add creator as first participant with full permissions
      const creatorPermissions: ParticipantPermissions = {
        canAnnotate: true,
        canChat: true,
        canViewDiagnostics: true,
        canMakeRecommendations: true,
        canControlSession: true
      };

      await this.db.query(
        `INSERT INTO session_participants 
         (session_id, user_id, role, permissions) 
         VALUES ($1, $2, $3, $4)`,
        [sessionId, createdBy, 'farmer', JSON.stringify(creatorPermissions)]
      );

      // Create session in memory manager
      await sessionManager.createSession(sessionId, title, createdBy);

      const session = await this.getSessionFromDb(sessionId);
      
      logger.info(`Session created: ${sessionId} by ${createdBy}`);
      res.status(201).json(session);
    } catch (error) {
      logger.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  // Additional methods will be added in separate files to keep this manageable
  public async start(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        this.app.listen(this.port, () => {
          logger.info(`🤝 Collaboration Service running on port ${this.port}`);
          resolve();
        });
      });
    } catch (error) {
      logger.error('Failed to start collaboration service:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.db.end();
      logger.info('Collaboration service stopped');
    } catch (error) {
      logger.error('Error stopping collaboration service:', error);
    }
  }

  // Helper method for getting session from database
  private async getSessionFromDb(sessionId: string): Promise<CollaborationSession | null> {
    try {
      const result = await this.db.query(
        `SELECT s.*, 
                COALESCE(
                  json_agg(
                    json_build_object(
                      'userId', sp.user_id,
                      'role', sp.role,
                      'permissions', sp.permissions,
                      'joinedAt', sp.joined_at,
                      'lastActivity', sp.last_activity,
                      'connectionStatus', sp.connection_status
                    )
                  ) FILTER (WHERE sp.user_id IS NOT NULL), 
                  '[]'
                ) as participants
         FROM collaboration_sessions s
         LEFT JOIN session_participants sp ON s.session_id = sp.session_id
         WHERE s.session_id = $1
         GROUP BY s.session_id`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        title: row.title,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        participants: row.participants,
        permissions: row.permissions,
        metadata: row.metadata
      };
    } catch (error) {
      logger.error('Error getting session from database:', error);
      return null;
    }
  }

  // Placeholder methods - will implement the rest
  private async getSession(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async updateSession(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async deleteSession(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async listSessions(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async addParticipant(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async removeParticipant(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async updateParticipant(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async getParticipants(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async createInvitation(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async acceptInvitation(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async rejectInvitation(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async updatePermissions(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  private async getPermissions(req: express.Request, res: express.Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented yet' });
  }
}

export { CollaborationService };

// Start service if run directly
if (require.main === module) {
  const service = new CollaborationService();
  service.start().catch(error => {
    logger.error('Failed to start collaboration service:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down collaboration service');
    await service.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down collaboration service');
    await service.stop();
    process.exit(0);
  });
}