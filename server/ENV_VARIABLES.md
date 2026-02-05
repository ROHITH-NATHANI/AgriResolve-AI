# Environment Variables Documentation

This document describes all environment variables required for the AgriResolve-AI backend server.

## Required Variables

### GEMINI_SERVICE_TOKEN

**Description**: API key for Google Gemini AI service

**Required**: Yes

**Security**: CRITICAL - Must be kept secret and never exposed in client-side code

**Format**: String starting with "AI" followed by alphanumeric characters

**Example**: `GEMINI_SERVICE_TOKEN=AIzaSyD...`

**Usage**: Used by the backend server to authenticate with the Gemini API for image analysis and AI-powered disease detection.

**Notes**:
- This key should ONLY be in the backend `.env` file
- Never commit this key to version control
- Never expose this key in frontend code or network traffic
- The backend proxy handles all Gemini API calls securely

---

### SESSION_SECRET

**Description**: Secret key for session management and cookie signing

**Required**: Yes

**Security**: CRITICAL - Must be a strong, random string

**Format**: Random string (minimum 32 characters recommended)

**Example**: `SESSION_SECRET=your-super-secret-random-string-here-change-in-production`

**Usage**: Used by Express session middleware to sign session cookies and prevent tampering.

**Notes**:
- Generate a strong random string for production
- Change the default value immediately
- Keep this secret secure and never commit to version control
- Changing this value will invalidate all existing sessions

**Generate a secure secret**:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

---

## Optional Variables

### HOST

**Description**: Host address to bind the server to

**Required**: No

**Default**: 
- Development: `127.0.0.1` (localhost only)
- Production: `0.0.0.0` (all interfaces)

**Format**: IP address or hostname

**Example**: `HOST=0.0.0.0`

**Usage**: Controls which network interfaces the server listens on.

**Notes**:
- In development, defaults to `127.0.0.1` for security (localhost only)
- In production, defaults to `0.0.0.0` to accept connections from any interface
- Use `127.0.0.1` to restrict access to localhost only
- Use `0.0.0.0` to allow external connections (production)

---

### PORT

**Description**: Port number for the server to listen on

**Required**: No

**Default**: `3001`

**Format**: Integer (1-65535)

**Example**: `PORT=3001`

**Usage**: Specifies which port the backend server listens on.

**Notes**:
- Must not conflict with other services
- Frontend should be configured to connect to this port
- Common ports: 3000 (frontend), 3001 (backend)

---

### FRONTEND_URL / CLIENT_URL

**Description**: URL of the frontend application for CORS configuration

**Required**: No

**Default**: `http://localhost:5173`

**Format**: Full URL including protocol

**Example**: 
```
FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173
```

**Usage**: Configures CORS to allow requests from the frontend application.

**Notes**:
- Both `FRONTEND_URL` and `CLIENT_URL` are supported (aliases)
- Must match the exact URL where your frontend is hosted
- Include protocol (http:// or https://)
- No trailing slash
- In production, set to your actual frontend domain

---

### NODE_ENV

**Description**: Environment mode (development or production)

**Required**: No

**Default**: `development`

**Format**: String (`development` or `production`)

**Example**: `NODE_ENV=production`

**Usage**: Controls various environment-specific behaviors:
- Security settings (HTTPS cookies, etc.)
- Logging levels
- Error detail exposure
- Host binding defaults

**Notes**:
- Set to `production` in production environments
- Affects security settings and performance optimizations
- Changes default HOST binding behavior

---

## Example Configuration Files

### Development (.env)

```bash
# Backend API Key (REQUIRED)
GEMINI_SERVICE_TOKEN=AIzaSyD...your-key-here

# Session Secret (REQUIRED - change this!)
SESSION_SECRET=change-this-secret-in-production

# Server Configuration (Optional)
PORT=3001
HOST=127.0.0.1
NODE_ENV=development

# Frontend URL (Optional)
FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173
```

### Production (.env.production)

```bash
# Backend API Key (REQUIRED)
GEMINI_SERVICE_TOKEN=AIzaSyD...your-production-key

# Session Secret (REQUIRED - use strong random string!)
SESSION_SECRET=<generate-secure-random-string-here>

# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# Frontend URL (set to your actual domain)
FRONTEND_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
```

---

## Security Best Practices

1. **Never commit `.env` files to version control**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as a template (without actual secrets)

2. **Use different keys for development and production**
   - Development keys should have limited quotas
   - Production keys should be tightly controlled

3. **Rotate secrets regularly**
   - Change `SESSION_SECRET` periodically
   - Rotate API keys according to security policy

4. **Restrict access to environment files**
   - Set appropriate file permissions (e.g., `chmod 600 .env`)
   - Limit who can access production servers

5. **Use environment-specific configurations**
   - Separate `.env.development` and `.env.production`
   - Never use development keys in production

6. **Monitor for exposed secrets**
   - Use tools to scan for accidentally committed secrets
   - Immediately rotate any exposed keys

---

## Troubleshooting

### "GEMINI_SERVICE_TOKEN not found in environment variables"

**Solution**: Ensure `GEMINI_SERVICE_TOKEN` is set in your `.env` file in the backend directory.

### "Session secret not configured"

**Solution**: Set `SESSION_SECRET` in your `.env` file. Generate a secure random string.

### CORS errors from frontend

**Solution**: Ensure `FRONTEND_URL` or `CLIENT_URL` matches your frontend's exact URL including protocol.

### Server not accessible from other machines

**Solution**: Set `HOST=0.0.0.0` to allow external connections (production only).

---

## Migration from Frontend API Key

If you previously had `VITE_GEMINI_API_TOKEN` in your frontend `.env`:

1. **Remove from frontend**: Delete `VITE_GEMINI_API_TOKEN` from frontend `.env`
2. **Add to backend**: Add `GEMINI_SERVICE_TOKEN` to backend `.env`
3. **Update frontend code**: Frontend now uses `/api/analysis` endpoint (already updated)
4. **Test**: Verify analysis requests work through the backend proxy

**Security Note**: The old approach exposed API keys in the frontend, which is insecure. The new approach keeps keys server-side only.
