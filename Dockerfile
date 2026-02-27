# === Stage 1: Build Frontend ===
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY sources/InstantOn-Insight/frontend/package*.json ./
RUN npm install
COPY sources/InstantOn-Insight/frontend/ .
RUN npm run build

# === Stage 2: Build Backend & Serve ===
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy Backend Code
COPY sources/InstantOn-Insight/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY sources/InstantOn-Insight/backend/app ./app

# Copy Built Frontend Assets to Backend Static (Logic needed here)
# For this setup, we assume Nginx or serving via FastAPI StaticFiles is desired.
# Simplest for now: Copy React build to app/ui/static/dist (or similar)
COPY --from=frontend-builder /app/frontend/dist ./app/ui/static/dist

# Env variables (Defaults)
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose
EXPOSE 8000

# Command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
