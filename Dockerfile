# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Skip vue-tsc type checking in Docker build (handled in dev/CI lint stage)
RUN npx vite build

# ============================================
# Stage 2: Install Backend Dependencies & Compile TS
# ============================================
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Root-level dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev

# Backend dependencies (includes native modules like better-sqlite3)
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

# Compile TypeScript -> JavaScript (eliminates tsx overhead in production)
COPY backend/src/ ./src/
COPY backend/tsconfig.json ./
RUN npm run build

# ============================================
# Stage 3: Final Production Image
# ============================================
FROM node:20-alpine
WORKDIR /app

# Install runtime deps for native modules (better-sqlite3 needs these)
RUN apk add --no-cache python3 make g++

# Copy root node_modules
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy backend: compiled JS only (no tsx, no TypeScript compiler)
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY backend/package*.json ./backend/

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=8002
ENV DATA_DIR=/app/config
ENV MUSIC_DIR=/music

# Create config directory
RUN mkdir -p /app/config

EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8002/api/status || exit 1

# Run compiled JS with explicit heap size limit (forces V8 to GC more aggressively)
CMD ["node", "--max-old-space-size=256", "backend/dist/index.js"]
