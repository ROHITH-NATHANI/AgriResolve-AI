/**
 * User Timezone Storage
 * 
 * Manages user timezone detection and storage in session
 * Requirement 12.3: Implement user timezone detection and storage
 */

/// <reference path="../types/express.d.ts" />

import { Request } from 'express';
import { detectUserTimezone, validateTimezone, UserTimezoneInfo } from './timezoneUtils.js';



/**
 * Get user timezone from session or detect it
 * Requirement 12.3: Request user's timezone when missing
 * 
 * @param req - Express request object with session
 * @returns User timezone information
 */
export function getUserTimezone(req: Request): UserTimezoneInfo {
  // Check if timezone is already stored in session
  if (req.session?.userTimezone) {
    return req.session.userTimezone;
  }

  // Detect timezone (will default to UTC if detection fails)
  const detectedTimezone = detectUserTimezone();

  // Store in session for future requests
  if (req.session) {
    req.session.userTimezone = detectedTimezone;
  }

  return detectedTimezone;
}

/**
 * Set user timezone in session
 * Requirement 12.3: Implement user timezone storage
 * 
 * @param req - Express request object with session
 * @param timezone - Timezone string to store
 * @param detectionMethod - How the timezone was determined
 * @returns True if successfully stored, false otherwise
 */
export function setUserTimezone(
  req: Request,
  timezone: string,
  detectionMethod: 'browser' | 'geolocation' | 'manual' | 'default' = 'manual'
): boolean {
  // Validate timezone first
  const validation = validateTimezone(timezone);
  if (!validation.isValid) {
    return false;
  }

  // Calculate offset
  const now = new Date();
  const offset = -now.getTimezoneOffset();

  const timezoneInfo: UserTimezoneInfo = {
    timezone: validation.timezone!,
    offset,
    detectionMethod
  };

  // Store in session
  if (req.session) {
    req.session.userTimezone = timezoneInfo;
    return true;
  }

  return false;
}

/**
 * Clear user timezone from session
 * 
 * @param req - Express request object with session
 */
export function clearUserTimezone(req: Request): void {
  if (req.session?.userTimezone) {
    delete req.session.userTimezone;
  }
}

/**
 * Get timezone string for weather API requests
 * Requirement 12.1: Add explicit timezone parameter to weather API requests
 * 
 * @param req - Express request object with session
 * @returns Timezone string for API requests (defaults to 'auto')
 */
export function getTimezoneForWeatherAPI(req: Request): string {
  const userTimezone = getUserTimezone(req);

  // If we have a valid user timezone, use it
  // Otherwise, use 'auto' to let the API determine it from coordinates
  if (userTimezone.detectionMethod !== 'default') {
    return userTimezone.timezone;
  }

  return 'auto';
}
