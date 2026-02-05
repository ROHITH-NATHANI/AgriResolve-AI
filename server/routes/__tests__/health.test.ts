/**
 * Health Check Routes Tests
 * 
 * Unit tests for service availability checking endpoints
 * Feature: agricultural-accuracy-and-security-fixes
 * Requirements: 16.1, 16.2
 */

import type { Express } from 'express';
import { healthRouter } from '../health.js';

// Use require for express and supertest to avoid ESM/CommonJS interop issues in Jest
import express = require('express');
import request = require('supertest');

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock GoogleGenAI with the structure used by server/routes/health.ts
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent
    }
  }))
}));

// Mock fetch for weather API
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Set up environment variable
process.env.GEMINI_SERVICE_TOKEN = 'test-api-key';

describe('Health Check Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/health', healthRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are available', async () => {
      // Mock successful Gemini API call
      mockGenerateContent.mockResolvedValue({ text: 'pong' });

      // Mock successful weather API call
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20 } })
      } as Response);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        services: {
          gemini: {
            available: true,
            message: 'Gemini API is operational'
          },
          weather: {
            available: true,
            message: 'Weather API is operational'
          }
        }
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return degraded status when Gemini API is unavailable', async () => {
      // Mock failed Gemini API call
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Mock successful weather API call
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20 } })
      } as Response);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        services: {
          gemini: {
            available: false
          },
          weather: {
            available: true
          }
        }
      });
    });

    it('should return degraded status when Weather API is unavailable', async () => {
      // Mock successful Gemini API call
      mockGenerateContent.mockResolvedValue({ text: 'pong' });

      // Mock failed weather API call
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        services: {
          gemini: {
            available: true
          },
          weather: {
            available: false
          }
        }
      });
    });
  });

  describe('GET /api/health/gemini', () => {
    it('should return available when Gemini API is operational', async () => {
      // Mock successful Gemini API call
      mockGenerateContent.mockResolvedValue({ text: 'pong' });

      const response = await request(app).get('/api/health/gemini');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        service: 'gemini',
        available: true,
        message: 'Gemini API is operational'
      });
    });

    it('should return unavailable when Gemini API key is missing', async () => {
      // Temporarily remove API key
      const originalKey = process.env.GEMINI_SERVICE_TOKEN;
      delete process.env.GEMINI_SERVICE_TOKEN;

      const response = await request(app).get('/api/health/gemini');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        service: 'gemini',
        available: false,
        message: 'Gemini API key not configured'
      });

      // Restore API key
      if (originalKey) {
        process.env.GEMINI_SERVICE_TOKEN = originalKey;
      }
    });

    it('should return unavailable when Gemini API call fails', async () => {
      // Mock failed Gemini API call
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      const response = await request(app).get('/api/health/gemini');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        service: 'gemini',
        available: false
      });
    });
  });

  describe('GET /api/health/weather', () => {
    it('should return available when Weather API is operational', async () => {
      // Mock successful weather API call
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20 } })
      } as Response);

      const response = await request(app).get('/api/health/weather');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        service: 'weather',
        available: true,
        message: 'Weather API is operational'
      });
    });

    it('should return unavailable when Weather API returns error status', async () => {
      // Mock failed weather API call
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 503
      } as Response);

      const response = await request(app).get('/api/health/weather');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        service: 'weather',
        available: false,
        message: 'Weather API returned status 503'
      });
    });

    it('should return unavailable when Weather API times out', async () => {
      // Mock timeout
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Timeout'));

      const response = await request(app).get('/api/health/weather');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        service: 'weather',
        available: false,
        message: 'Weather API is unavailable'
      });
    });
  });
});