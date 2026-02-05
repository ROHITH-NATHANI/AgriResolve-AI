/**
 * Timezone Routes
 * 
 * API endpoints for managing user timezone preferences
 * Requirements: 12.1, 12.3
 */

import { Router, Request, Response } from 'express';
import { getUserTimezone, setUserTimezone } from '../utils/userTimezoneStorage.js';
import { validateTimezone } from '../utils/timezoneUtils.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/timezone
 * Get current user timezone from session
 * Requirement 12.3: Implement user timezone detection and storage
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userTimezone = getUserTimezone(req);

    logger.debug('User timezone retrieved', {
      timezone: userTimezone.timezone,
      method: userTimezone.detectionMethod,
      sessionId: req.session?.id
    });

    res.json({
      success: true,
      timezone: userTimezone.timezone,
      offset: userTimezone.offset,
      detectionMethod: userTimezone.detectionMethod
    });
  } catch (error) {
    logger.error('Failed to get user timezone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve timezone'
    });
  }
});

/**
 * POST /api/timezone
 * Set user timezone in session
 * Requirement 12.3: Implement user timezone storage
 * 
 * Body: { timezone: string, detectionMethod?: string }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { timezone, detectionMethod } = req.body;

    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required and must be a string'
      });
    }

    const validation = validateTimezone(timezone);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Invalid timezone'
      });
    }

    // Validate detection method if provided
    const validMethods = ['browser', 'geolocation', 'manual', 'default'];
    const method = detectionMethod && validMethods.includes(detectionMethod)
      ? detectionMethod
      : 'manual';

    // Store timezone
    const success = setUserTimezone(req, timezone, method);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to store timezone'
      });
    }

    logger.info('User timezone set', {
      timezone,
      method,
      sessionId: req.session?.id
    });

    res.json({
      success: true,
      timezone,
      detectionMethod: method
    });
  } catch (error) {
    logger.error('Failed to set user timezone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set timezone'
    });
  }
});

/**
 * POST /api/timezone/detect
 * Detect and store user timezone from browser
 * Requirement 12.3: Implement user timezone detection
 * 
 * Body: { timezone: string } - timezone detected by browser
 */
router.post('/detect', (req: Request, res: Response) => {
  try {
    const { timezone } = req.body;

    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required'
      });
    }

    const validation = validateTimezone(timezone);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Invalid timezone'
      });
    }

    // Store with 'browser' detection method
    const success = setUserTimezone(req, timezone, 'browser');

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to store detected timezone'
      });
    }

    logger.info('User timezone detected and stored', {
      timezone,
      sessionId: req.session?.id
    });

    res.json({
      success: true,
      timezone,
      detectionMethod: 'browser'
    });
  } catch (error) {
    logger.error('Failed to detect and store timezone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect timezone'
    });
  }
});

export default router;
