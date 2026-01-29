// Test setup file
import { logger } from '../utils/logger';

// Set log level to ERROR to reduce noise during tests
logger.setLevel('ERROR');

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'ERROR';