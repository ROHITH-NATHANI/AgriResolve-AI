import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { apiGateway } from './gateway/apiGateway.js';
import { websocketManager } from './websocket/websocketManager.js';
import { serviceRegistry } from './services/serviceRegistry.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: serviceRegistry.getHealthStatus()
  });
});

// Authentication middleware for protected routes
app.use('/api', authMiddleware);

// API Gateway routing
app.use('/api', apiGateway);

// WebSocket connection handling
websocketManager.initialize(io);

// Error handling middleware
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 AgriResolve Collaborative Server running on port ${PORT}`);
  logger.info(`📡 WebSocket server initialized`);
  logger.info(`🔒 Security middleware active`);

  // Initialize services
  serviceRegistry.startServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    serviceRegistry.stopServices();
    process.exit(0);
  });
});

export { app, server, io };