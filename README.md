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
- MongoDB running on `localhost:27017`
- Google Chrome

### 2. Backend Setup
```bash
cd f:\API-Testing
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Start Server
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Load Extension
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `f:\API-Testing\extension`

### 5. Capture
1. Click the extension icon → **Start Capture**
2. Navigate to `portal.arubainstanton.com` and log in
3. Browse around — APIs are captured automatically
4. Open `http://localhost:8000/` to see the auto-generated Swagger docs

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
