# 🔍 API Capture Tool

A powerful local development tool for capturing, analyzing, and documenting browser HTTP requests. Perfect for API research, learning, and testing purposes.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation Guide](#-installation-guide)
- [Environment Variables](#-environment-variables)
- [Running the Project](#-running-the-project)
- [Usage Guide](#-usage-guide)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Best Practices](#-best-practices)
- [License](#-license)

---

## 🎯 Overview

**API Capture Tool** is a comprehensive solution for intercepting and analyzing HTTP requests made by web applications. It consists of three main components:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend** | Python FastAPI + MongoDB | REST API server for storing and managing captured requests |
| **Dashboard** | React 19 + Vite | Web interface for viewing, filtering, and exporting captured data |
| **Extension** | Chrome Manifest V3 | Browser extension for intercepting HTTP requests |

### Intended Audience

- **Developers** learning how web APIs work
- **QA Engineers** documenting API behavior
- **Security Researchers** analyzing HTTP traffic
- **Students** studying web development and RESTful APIs

---

## ✨ Features

- 🌐 **Real-time Request Capture** - Automatically intercept XHR/Fetch requests
- 📊 **Request Filtering** - Filter by HTTP method, status code, or URL keyword
- 📚 **API Inventory** - Auto-generated API documentation from captured requests
- 📤 **Export Options** - Export to Postman Collection or cURL command
- 🔄 **Auto-refresh** - Dashboard updates every 3 seconds
- 🎨 **Clean UI** - Modern, responsive React dashboard

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Chrome Extension                              │    │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────────────┐  │    │
│  │  │ background.js│  │ content.js  │  │      inject.js        │  │    │
│  │  │   (Service   │◀─│  (Bridge)   │◀─│ (XHR/Fetch Intercept) │  │    │
│  │  │   Worker)    │  │             │  │                       │  │    │
│  │  └──────┬───────┘  └─────────────┘  └───────────────────────┘  │    │
│  └─────────│───────────────────────────────────────────────────────┘    │
└────────────│────────────────────────────────────────────────────────────┘
             │ POST /logs
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (FastAPI)                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │   /logs routes  │   │  /export routes │   │  /inventory routes  │   │
│  │  (CRUD for logs)│   │ (Postman/cURL)  │   │   (API grouping)    │   │
│  └────────┬────────┘   └─────────────────┘   └─────────────────────┘   │
│           │                                                             │
│  ┌────────▼────────────────────────────────────────────────────────┐   │
│  │                         MongoDB (Motor)                          │   │
│  │              Collections: logs, api_inventory                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
             ▲
             │ GET /logs, /inventory
             │
┌─────────────────────────────────────────────────────────────────────────┐
│                         Dashboard (React + Vite)                        │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │    LogTable     │   │   LogDetail     │   │    ApiInventory     │   │
│  │  (Request List) │   │ (Request Info)  │   │  (API Docs View)    │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
API-Testing/
├── backend/                    # FastAPI Backend Server
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # Environment configuration
│   │   ├── database.py         # MongoDB connection (Motor async client)
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── crud.py             # CRUD operations for logs
│   │   ├── crud_inventory.py   # CRUD for API inventory
│   │   ├── normalizer.py       # URL path normalization utilities
│   │   ├── schemas.py          # Pydantic models for logs
│   │   ├── schemas_inventory.py # Pydantic models for inventory
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── logs.py         # Log CRUD endpoints
│   │       ├── export.py       # Export to Postman/cURL
│   │       └── inventory.py    # API inventory endpoints
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Environment variables (create from .env.example)
│   └── venv/                   # Python virtual environment
│
├── dashboard/                  # React Frontend Dashboard
│   ├── src/
│   │   ├── main.jsx           # React entry point
│   │   ├── App.jsx            # Main application component
│   │   ├── App.css            # Application styles
│   │   ├── index.css          # Global styles
│   │   ├── assets/            # Static assets
│   │   └── components/
│   │       ├── LogTable.jsx    # Request list table
│   │       ├── LogTable.css
│   │       ├── LogDetail.jsx   # Request detail panel
│   │       ├── LogDetail.css
│   │       ├── ApiInventory.jsx # API documentation view
│   │       └── ApiInventory.css
│   ├── public/                 # Static public files
│   ├── index.html              # HTML template
│   ├── vite.config.js          # Vite configuration
│   ├── eslint.config.js        # ESLint configuration
│   └── package.json            # Node.js dependencies
│
├── extension/                  # Chrome Browser Extension
│   ├── manifest.json           # Extension manifest (Manifest V3)
│   ├── background.js           # Service worker (sends data to backend)
│   ├── content.js              # Content script (bridge)
│   ├── inject.js               # Injected script (intercepts XHR/Fetch)
│   └── icons/                  # Extension icons
│
├── .gitattributes
└── README.md                   # This file
```

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

| Software | Minimum Version | Download Link |
|----------|-----------------|---------------|
| **Node.js** | v18.0.0+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | [python.org](https://www.python.org/) |
| **MongoDB** | 6.0+ | [mongodb.com](https://www.mongodb.com/try/download/community) |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |
| **Google Chrome** | Latest | [google.com/chrome](https://www.google.com/chrome/) |

### Verify Installations

```bash
# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Check Python version
python --version
# Expected: Python 3.10.x or higher

# Check MongoDB status (Windows)
mongod --version
# Expected: db version v6.x.x or higher

# Check Git version
git --version
# Expected: git version 2.30.x or higher
```

### Supported Operating Systems

- ✅ Windows 10/11
- ✅ macOS 12+ (Monterey and later)
- ✅ Linux (Ubuntu 20.04+, Debian 11+, Fedora 36+)

---

## 🚀 Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/API-Testing.git
cd API-Testing
```

### Step 2: Set Up the Backend

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# On Windows (Command Prompt):
.\venv\Scripts\activate.bat

# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 3: Set Up the Dashboard

```bash
# Navigate to dashboard directory
cd ../dashboard

# Install Node.js dependencies
npm install
```

### Step 4: Install the Chrome Extension

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the `extension/` folder from this project
6. The extension "API Capture Tool" should now appear in your extensions list

### Step 5: Start MongoDB

> **Important:** MongoDB must be running before starting the backend.

#### Windows

```powershell
# Start MongoDB service (if installed as a service)
net start MongoDB

# Or run MongoDB directly
mongod --dbpath "C:\data\db"
```

#### macOS (Homebrew)

```bash
brew services start mongodb-community
```

#### Linux (systemd)

```bash
sudo systemctl start mongod
```

---

## ⚙️ Environment Variables

### Backend Configuration

Create a `.env` file in the `backend/` directory:

```bash
# backend/.env

# MongoDB Connection URL
# Format: mongodb://[username:password@]host[:port]
MONGODB_URL=mongodb://localhost:27017

# Database name for storing captured data
DATABASE_NAME=api_capture
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URL` | Yes | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | Yes | `api_capture` | Name of the database to use |

### `.env.example`

Copy this template to create your `.env` file:

```env
# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=api_capture
```

---

## ▶️ Running the Project

### Quick Start (All Components)

Open **three separate terminal windows** and run:

#### Terminal 1: Backend Server

```bash
cd backend
.\venv\Scripts\Activate.ps1    # Windows PowerShell
# source venv/bin/activate     # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
Connected to MongoDB: api_capture
```

#### Terminal 2: Dashboard

```bash
cd dashboard
npm run dev
```

Expected output:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

#### Terminal 3: Verify Services

```bash
# Test backend health
curl http://localhost:8000/health
# Expected: {"status":"healthy"}

# Test API docs
# Open in browser: http://localhost:8000/docs
```

### Default Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 8000 | http://localhost:8000 |
| Dashboard | 5173 | http://localhost:5173 |
| MongoDB | 27017 | mongodb://localhost:27017 |

### Changing Ports

**Backend (change from 8000):**
```bash
uvicorn app.main:app --reload --port 9000
```

**Dashboard (change from 5173):**
```bash
npm run dev -- --port 3000
```

> ⚠️ **Important:** If you change the backend port, update the `API_BASE` constant in `dashboard/src/App.jsx`:
> ```javascript
> const API_BASE = 'http://localhost:9000'  // Update this
> ```

---

## 📖 Usage Guide

### Capturing API Requests

1. **Start all services** (Backend, Dashboard, MongoDB)
2. **Open the Dashboard** at http://localhost:5173
3. **Open any website** in a new Chrome tab
4. **Browse the website** - all XHR/Fetch requests will be captured
5. **View captured requests** in the Dashboard's "Request Logs" tab

### Filtering Requests

- **By Method:** Select GET, POST, PUT, PATCH, or DELETE
- **By Status:** Filter by 2xx (success), 4xx (client error), or 5xx (server error)
- **By URL:** Enter a keyword to search URLs

### Exporting Requests

1. Select a request from the list
2. In the detail panel, click:
   - **"Export Postman"** - Download as Postman Collection v2.1
   - **"Export cURL"** - Copy cURL command to clipboard

### API Inventory

The "API Inventory" tab automatically groups captured requests by base URL and endpoint, showing:
- All HTTP methods observed for each endpoint
- Sample request/response bodies
- Documentation for discovered APIs

---

## 📚 API Reference

The backend provides a REST API documented with OpenAPI/Swagger.

**Interactive API Docs:** http://localhost:8000/docs

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Root endpoint - health check |
| `GET` | `/health` | Health check endpoint |
| `POST` | `/logs/` | Create a new captured log |
| `GET` | `/logs/` | Get all logs (with filters) |
| `GET` | `/logs/{log_id}` | Get a specific log |
| `DELETE` | `/logs/{log_id}` | Delete a specific log |
| `DELETE` | `/logs/` | Clear all logs |
| `GET` | `/logs/{log_id}/export/postman` | Export as Postman Collection |
| `GET` | `/logs/{log_id}/export/curl` | Export as cURL command |
| `GET` | `/inventory/` | Get API inventory |
| `POST` | `/inventory/refresh` | Refresh API inventory |

---

## 🔧 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed

**Error:**
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017
```

**Solution:**
- Ensure MongoDB is running:
  ```bash
  # Windows
  net start MongoDB
  
  # macOS
  brew services start mongodb-community
  
  # Linux
  sudo systemctl start mongod
  ```
- Verify connection:
  ```bash
  mongosh
  ```

#### 2. CORS Errors in Browser Console

**Error:**
```
Access to fetch has been blocked by CORS policy
```

**Solution:**
- Ensure the backend is running on the correct port (8000)
- The backend is configured to allow all origins for local development

#### 3. Extension Not Capturing Requests

**Possible Causes:**
- Extension not installed properly
- Website using non-standard request methods

**Solution:**
1. Go to `chrome://extensions/`
2. Find "API Capture Tool"
3. Click **"Reload"** button
4. Refresh the target website

#### 4. npm install Fails

**Error:**
```
npm ERR! code ERESOLVE
```

**Solution:**
```bash
npm install --legacy-peer-deps
```

#### 5. Python Virtual Environment Issues

**Error:**
```
'venv' is not recognized as an internal or external command
```

**Solution:**
```bash
# Install venv module
python -m pip install virtualenv

# Use virtualenv instead
virtualenv venv
```

#### 6. Port Already in Use

**Error:**
```
OSError: [Errno 98] Address already in use
```

**Solution:**
```bash
# Find and kill process on port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :8000
kill -9 <PID>
```

---

## 📏 Best Practices

### Coding Standards

- **Python:** Follow PEP 8 style guide
- **JavaScript/React:** Use ESLint configuration provided
- **Commits:** Use conventional commits format

### Commit Message Convention

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Examples:
  feat(backend): add pagination to logs endpoint
  fix(dashboard): resolve filter reset issue
  docs: update installation instructions
```

### Branching Strategy

```
main          # Production-ready code
├── develop   # Integration branch
│   ├── feature/xyz   # New features
│   ├── bugfix/xyz    # Bug fixes
│   └── hotfix/xyz    # Urgent fixes
```

### Security Notes

> ⚠️ **Warning:** This tool is designed for **local development only**.
> 
> - CORS is configured to allow all origins (`*`)
> - No authentication is implemented
> - Do not expose this tool to the public internet

---

## 📄 License

This project is provided for educational and development purposes.

---

## 📝 Additional Notes

### Limitations

- The extension only captures XHR and Fetch API requests
- WebSocket connections are not captured
- Some websites with strict CSP may block the injection script

### Future Improvements

- [ ] WebSocket request capturing
- [ ] Request replay functionality
- [ ] Dark mode for dashboard
- [ ] Export all logs as HAR file

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">

**Made with ❤️ for API explorers and developers**

[Report Bug](../../issues) · [Request Feature](../../issues)

</div>
