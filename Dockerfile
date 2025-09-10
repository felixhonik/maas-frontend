# Multi-stage build for React frontend and Node.js backend
FROM node:18-alpine AS frontend-build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy backend code
COPY server.js ./
COPY services/ ./services/

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Create directory for MAAS configuration
RUN mkdir -p /app/config

# Copy example configuration
COPY maas.conf.example ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S maas -u 1001

# Set permissions
RUN chown -R maas:nodejs /app
USER maas

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3001/api/config/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]