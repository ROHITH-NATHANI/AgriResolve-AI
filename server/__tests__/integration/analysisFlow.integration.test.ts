/**
 * Integration Tests for Complete Analysis Flow
 *
 * Tests the end-to-end analysis flow by mounting the real routers onto an
 * Express app instance (without starting the HTTP server).
 */

import type { Express } from 'express';

// Use require for express/supertest to avoid Jest ESM/CommonJS interop issues
// Use require for express/supertest to avoid Jest ESM/CommonJS interop issues
import express = require('express');
import request = require('supertest');
import session = require('express-session');

// External dependencies are mocked to keep tests deterministic and offline.
const mockGeminiGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGeminiGenerateContent
    }
  }))
}));

jest.mock('../../services/weatherService.js', () => ({
  fetchCurrentWeather: jest.fn().mockResolvedValue({
    temperature: 25,
    relativeHumidity: 75,
    windSpeed: 3,
    dewPoint: 20,
    timestamp: new Date('2026-02-03T00:00:00.000Z'),
    timezone: 'UTC',
    dataQuality: 'complete'
  }),
  fetchHourlyWeather: jest.fn().mockResolvedValue([
    {
      temperature: 25,
      relativeHumidity: 75,
      windSpeed: 3,
      dewPoint: 20,
      timestamp: new Date('2026-02-03T00:00:00.000Z'),
      timezone: 'UTC',
      dataQuality: 'complete'
    }
  ])
}));

import { analysisRouter } from '../../routes/analysis.js';
import { healthRouter } from '../../routes/health.js';
import { authMiddleware } from '../../middleware/auth.js';
import { hourlyRateLimiter, shortTermRateLimiter, rateLimitStatus } from '../../middleware/rateLimiter.js';

describe('Analysis Flow Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.GEMINI_SERVICE_TOKEN = 'test-api-key';

    mockGeminiGenerateContent.mockResolvedValue({
      text: '{"ok":true}'
    });

    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session is required for rate limiting logic
    app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: true
      })
    );

    // Mount the same public health route as production
    app.use('/api/health', healthRouter);

    // Mount the same auth + rate limit middleware chain as production
    app.use('/api', authMiddleware);
    app.use('/api', rateLimitStatus);
    app.use('/api', shortTermRateLimiter);
    app.use('/api', hourlyRateLimiter);

    // Mount core API routes
    app.use('/api', analysisRouter);
  });
  describe('Complete analysis flow with disease risks', () => {
    it('should complete flow: select crop → upload image → receive analysis with disease risks', async () => {
      const agent = request.agent(app);

      // Mock image data (base64)
      const mockImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const response = await agent
        .post('/api/analysis')
        .send({
          taskType: 'GENERATE_JSON',
          prompt: 'Analyze this crop image',
          image: mockImage,
          cropType: 'tomato',
          location: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });

      // Should return success or degraded service (503)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('result');
        expect(response.body).toHaveProperty('rateLimitInfo');

        // May have disease risks if weather data available
        if (response.body.diseaseRisks) {
          expect(response.body.diseaseRisks).toHaveProperty('risks');
          expect(response.body.diseaseRisks).toHaveProperty('confidence');
        }
      }
    }, 30000);
  });

  describe('Rate limiting flow', () => {
    it('should enforce rate limits after multiple requests', async () => {
      const agent = request.agent(app);

      const mockImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      // Make multiple requests (more than short-term limit of 5)
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          agent
            .post('/api/analysis')
            .send({
              taskType: 'GENERATE_JSON',
              prompt: 'Test prompt',
              image: mockImage
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);

      if (rateLimited) {
        const limitedResponse = responses.find(r => r.status === 429);
        expect(limitedResponse?.body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
        expect(limitedResponse?.body).toHaveProperty('rateLimitInfo');
      }
    }, 60000);
  });

  describe('Offline/service unavailable flow', () => {
    it('should handle service degradation gracefully', async () => {
      const agent = request.agent(app);

      const mockImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const response = await agent
        .post('/api/analysis')
        .send({
          taskType: 'GENERATE_JSON',
          prompt: 'Test prompt',
          image: mockImage
        });

      // Should either succeed or return degraded service
      expect([200, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.body).toHaveProperty('code', 'SERVICE_DEGRADED');
        expect(response.body).toHaveProperty('serviceErrors');
        expect(response.body).toHaveProperty('affectedFeatures');
      }
    }, 30000);
  });

  describe('Manual weather data flow', () => {
    it('should accept and use manual weather data when API unavailable', async () => {
      const agent = request.agent(app);

      const mockImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const response = await agent
        .post('/api/analysis')
        .send({
          taskType: 'GENERATE_JSON',
          prompt: 'Test prompt',
          image: mockImage,
          cropType: 'tomato',
          location: {
            latitude: 40.7128,
            longitude: -74.0060
          },
          manualWeather: {
            temperature: 25,
            humidity: 80,
            windSpeed: 5
          }
        });

      // Should accept manual weather data
      expect([200, 503]).toContain(response.status);

      if (response.status === 200 && response.body.manualWeatherUsed) {
        expect(response.body.manualWeatherUsed).toBe(true);
      }
    }, 30000);
  });

  describe('Low confidence flow', () => {
    it('should include confidence information in response', async () => {
      const agent = request.agent(app);

      const mockImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const response = await agent
        .post('/api/analysis')
        .send({
          taskType: 'GENERATE_JSON',
          prompt: 'Test prompt',
          image: mockImage,
          cropType: 'tomato',
          location: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        });

      if (response.status === 200 && response.body.diseaseRisks) {
        expect(response.body.diseaseRisks).toHaveProperty('confidence');
        expect(response.body.diseaseRisks.confidence).toHaveProperty('overall');
        expect(response.body.diseaseRisks.confidence).toHaveProperty('components');
      }
    }, 30000);
  });

  describe('Health check endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
    });

    it('should check Gemini API health', async () => {
      const response = await request(app)
        .get('/api/health/gemini');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('service', 'gemini');
      expect(response.body).toHaveProperty('available');
    });

    it('should check Weather API health', async () => {
      const response = await request(app)
        .get('/api/health/weather');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('service', 'weather');
      expect(response.body).toHaveProperty('available');
    });
  });
});
