# Instant Insight - API Mapping & Architecture (V4)

This document outlines the **Clean V4 Architecture** where the Insight Backend acting as the **Single Gateway** for the React Frontend.

## 1. Authentication Strategy

- **Frontend -> Insight Backend (Port 8000)**:
    - Header: `X-Internal-App-Auth`
    - Value: `secret-internal-key-change-me` (Defined in `.env`)
    - *Note: The Frontend handles this automatically via `apiClient.js`.*

## 2. API Routes (Insight Backend - Port 8000)

The React Frontend **ONLY** communicates with Port 8000.

### A. Core Product Routes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `ANY` | `/api/proxy/{path}` | **Secure Gateway** to Aruba Portal. Forwards traffic with scrubbing. |
| `GET` | `/health` | System health check. |

### B. Toolkit Proxy Routes (Forwarded to Port 8001)
*These routes are transparently proxied to the Capture Toolkit.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cloner/sites` | List sites captured in logs. |
| `GET` | `/api/cloner/live-sites` | List sites from active live session. |
| `POST` | `/api/cloner/preview` | Generate clone operations preview. |
| `POST` | `/api/cloner/apply` | Execute cloning to target sites. |
| `GET` | `/api/logs/{logId}` | Retrieve detailed request/response log. |

## 3. External API (Aruba Portal)
*Accessed via `/api/proxy`*

- **Base URL**: `https://portal.instant-on.hpe.com`
- **Auth**: Managed via Cookies/Session in the Backend (Scrubbed from Frontend view).

## 4. Toolkit Backend (Port 8001) - Internal Use Only
*Direct access is restricted to the Insight Backend Proxy.*

- **Swagger UI**: `http://localhost:8001/docs` (For developers only)
- **Features**:
    - Raw Log Storage (MongoDB)
    - Traffic Replay Engine
    - Swagger Auto-Generation
