# Aruba API Capture System

Reverse-engineer the Aruba Instant On Portal API by capturing real browser traffic and generating live Swagger documentation.

## Architecture

```
Chrome Extension (chrome.debugger)
    │
    ▼  POST /api/capture/batch
FastAPI Backend (localhost:8000)
    │
    ▼  Motor async driver
MongoDB (aruba_capture)
    │
    ▼  On-demand generation
OpenAPI 3.0 Swagger UI (localhost:8000/)
```

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- MongoDB running on `localhost:27017`
- Google Chrome

### 2. Backend Setup
```bash
# Navigate to the backend directory
cd sources/insight/backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/Mac:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Start Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```
*(The backend will run on `http://localhost:8001` and provide the Swagger documentation at `/docs`)*

### 3. Frontend Setup
```bash
# Open a new terminal and navigate to the frontend directory
cd sources/insight/frontend

# Install Node dependencies
npm install

# Setup environment variables
cp .env.example .env

# Start the Vite development server
npm run dev
```

### 4. Load Chrome Extension (Optional, for capturing)
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension` folder (if available)

### 5. Usage
1. Open the frontend React app (usually `http://localhost:5173`) in your browser to view the Insight Dashboard.
2. If using the extension: Click the extension icon → **Start Capture**, navigate to `portal.instant-on.hpe.com` and log in. Captures will be routed to the backend and visible on the dashboard.

## Features

- **chrome.debugger capture** — full request/response bodies, headers, cookies
- **Auth-engine** — auto-detects Bearer tokens, CSRF tokens, session cookies from OAuth2 PKCE flow
- **Real-time Swagger UI** — auto-refreshes every 5 seconds with hash-based change detection
- **Advanced filtering** — by method (GET/POST/PUT/DELETE/PATCH), status code (2xx/3xx/4xx/5xx), domain
- **Full-text search** — keyword search across URLs, request bodies, response bodies (MongoDB text index)
- **Auto-auth proxy** — "Try it out" automatically injects the latest captured Bearer token
- **Aruba-specific normalization** — replaces UUIDs, MAC addresses, serial numbers with path parameters

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Dashboard (Swagger UI) |
| `/api/capture` | POST | Single request capture |
| `/api/capture/batch` | POST | Batch request capture |
| `/api/auth-session` | POST | Store auth token |
| `/api/swagger.json` | GET | OpenAPI 3.0 spec (filtered) |
| `/api/domains` | GET | List captured domains |
| `/api/endpoints` | GET | List endpoints (filtered) |
| `/api/logs` | GET | Full-text search logs |
| `/api/auth/latest` | GET | Latest auth session |
| `/api/data` | DELETE | Wipe all data |
| `/health` | GET | Health check |
