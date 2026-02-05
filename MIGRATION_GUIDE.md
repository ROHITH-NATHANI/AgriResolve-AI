# Migration Guide: Agricultural Accuracy and Security Fixes

This guide helps you migrate existing AgriResolve-AI deployments to the new secure backend architecture with enhanced disease risk assessment.

## Overview of Changes

This update introduces:

1. **Backend API Proxy**: All Gemini API calls now go through a secure backend server
2. **API Key Security**: API keys moved from frontend to backend (never exposed to clients)
3. **Disease Risk Model**: Crop-specific disease risk assessment with weather data integration
4. **Graceful Degradation**: System continues working when services are unavailable
5. **Rate Limiting**: Session-based rate limiting to prevent abuse
6. **Enhanced Error Handling**: Comprehensive error responses with retry information

---

## Migration Steps

### Step 1: Backend Server Setup

#### 1.1 Install Backend Dependencies

```bash
cd server
npm install
```

Required new dependencies:
- `express` - Web server framework
- `express-session` - Session management
- `express-rate-limit` - Rate limiting
- `cors` - Cross-origin resource sharing
- `helmet` - Security headers
- `dotenv` - Environment variable management

#### 1.2 Create Backend Environment File

Create `server/.env` with the following variables:

```bash
# REQUIRED: Move your Gemini API key from frontend to backend
GEMINI_SERVICE_TOKEN=your-gemini-api-key-here

# REQUIRED: Generate a secure session secret
SESSION_SECRET=your-secure-random-string-here

# OPTIONAL: Server configuration
PORT=3001
HOST=127.0.0.1  # Use 0.0.0.0 in production
NODE_ENV=development

# OPTIONAL: Frontend URL for CORS
FRONTEND_URL=http://localhost:5173
```

**Generate a secure session secret**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 1.3 Start Backend Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The backend server will start on `http://localhost:3001` (or your configured PORT).

---

### Step 2: Frontend Configuration Changes

#### 2.1 Remove API Key from Frontend

**IMPORTANT**: Remove `VITE_GEMINI_API_TOKEN` from your frontend `.env` file.

**Before** (frontend `.env`):
```bash
VITE_GEMINI_API_TOKEN=AIzaSyD...  # DELETE THIS
```

**After** (frontend `.env`):
```bash
# API key is now in backend only
# Optionally configure backend URL if not using default
VITE_API_URL=http://localhost:3001/api
```

#### 2.2 Update Frontend Code

The frontend code has been updated to use the backend proxy automatically. No code changes are required if you're using the latest version.

**Key changes** (already implemented):
- `src/services/gemini.ts` - Now routes through backend p