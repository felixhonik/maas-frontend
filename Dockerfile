# Multi-stage build for React frontend and Python FastAPI backend
FROM node:18-alpine AS frontend-build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production stage
FROM python:3.11-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    curl

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app.py ./
COPY services/ ./services/

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Create directory for MAAS configuration
RUN mkdir -p /app/config

# Copy example configuration
COPY maas.conf.example ./

# Create non-root user
RUN addgroup -g 1001 -S python && \
    adduser -S maas -u 1001 -G python

# Set permissions
RUN chown -R maas:python /app
USER maas

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/config/status || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "3001"]