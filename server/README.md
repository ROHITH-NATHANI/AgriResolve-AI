# AgriResolve Backend Server

## Overview

The AgriResolve backend server provides a secure API proxy for the agricultural AI diagnostic tool. It implements security best practices including session management, CORS configuration, and secure API key handling.

## Features

### Security
- **Session Management**: Secure session handling with httpOnly cookies
- **CORS Configuration**: Properly configured CORS for frontend communication
- **Localhost Binding**: Development server binds to 127.0.0.1 only
- **API Key Protection**: Server-side API key management (never exposed to clients)
- **Helmet Security**: Content Security Policy and other security headers

### Configuration

#### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Backend Server Configuration
NODE_ENV=development
HOST=127.0.0.1
PORT=3001

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173

# Session Configuration
SESSION_SECRET=change-this-secret-in-production-use-a-long-random-string

# Gemini API Configuration (server-side)
GEMINI_SERVICE_TOKEN=your_gemini_api_key_here

# JWT Configuration (for authentication)
JWT_SECRET=your-secret-key-change-in-production
```

See `.env.example` for a complete template.

#### Development vs Production

**Development Mode** (NODE_ENV=development):
- Server binds to `127.0.0.1` (localhost only)
- Session cookies are not marked as secure
- Detailed error messages in responses
- Default development user for testing

**Production Mode** (NODE_ENV=production):
- Server binds to `HOST` environment variable (default: `0.0.0.0`)
- Session cookies are marked as secure (HTTPS only)
- Minimal error messages
- Full authentication required

## Running the Server

### Development
```bash
npm run dev:server
```

This starts the server with nodemon for automatic reloading on file changes.

### Production Build
```bash
npm run build:server
npm run start:server
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status and service availability.

### API Gateway
```
/api/*
```
All API routes are proxied through the gateway with authentication and rate limiting.

## Security Features

### Session Management
- Sessions are stored server-side
- Session cookies are httpOnly (not accessible via JavaScript)
- Session cookies are secure in production (HTTPS only)
- 24-hour session expiration

### CORS Configuration
- Configured to accept requests from frontend URL only
- Credentials (cookies) are allowed
- Prevents unauthorized cross-origin requests

### Host Binding
- **Development**: Binds to `127.0.0.1` to prevent network exposure
- **Production**: Configurable via `HOST` environment variable

### API Key Protection
- Gemini API keys are stored server-side only
- Never exposed in client-side code or network traffic
- API requests are proxied through the backend

## Testing

Run the test suite:
```bash
npm test
```

Run specific test file:
```bash
npm test -- server/__tests__/server-config.test.ts
```

## Architecture

The server follows a modular architecture:

```
server/
├── index.ts                 # Main server entry point
├── gateway/                 # API gateway and routing
├── middleware/              # Authentication, error handling
├── services/                # Business logic services
├── utils/                   # Utility functions
├── websocket/               # WebSocket handlers
└── __tests__/              # Test files
```

## Requirements Addressed

This implementation addresses the following requirements from the Agricultural Accuracy and Security Fixes specification:

- **Requirement 5.1**: Backend API proxying for all Gemini API calls
- **Requirement 5.4**: Server-side API credential injection
- **Requirement 6.1**: Localhost binding in development mode
- **Requirement 6.3**: Explicit network binding configuration for production

## Migration Guide

### For Existing Deployments

1. **Update Environment Variables**:
   - Add `SESSION_SECRET` with a strong random string
   - Add `GEMINI_SERVICE_TOKEN` for server-side use
   - Set `HOST` appropriately for production
   - Verify `FRONTEND_URL` matches your frontend deployment

2. **Install Dependencies**:
   ```bash
   npm install express-session @types/express-session
   ```

3. **Update Frontend**:
   - Remove direct Gemini API calls from frontend
   - Update API calls to use backend proxy endpoints
   - Remove `VITE_GEMINI_API_TOKEN` from client-side code

4. **Test Security**:
   - Verify API keys are not visible in browser DevTools
   - Test CORS configuration with your frontend
   - Verify session cookies are set correctly

## Troubleshooting

### Server won't start
- Check that PORT is not already in use
- Verify all required environment variables are set
- Check logs for specific error messages

### CORS errors
- Verify `FRONTEND_URL` matches your frontend origin exactly
- Ensure credentials are included in frontend requests
- Check that CORS middleware is configured before routes

### Session issues
- Verify `SESSION_SECRET` is set
- Check that cookies are being sent with requests
- Ensure frontend includes `credentials: 'include'` in fetch requests

## Contributing

When adding new features:
1. Follow the existing modular architecture
2. Add appropriate tests
3. Update this README with new endpoints or configuration
4. Ensure security best practices are maintained
