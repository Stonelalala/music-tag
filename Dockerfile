# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Install Backend Dependencies
# ============================================
FROM node:20-alpine AS backend-deps
WORKDIR /app

# Root-level dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund --omit=dev

# Backend dependencies (includes native modules like better-sqlite3)
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund

# ============================================
# Stage 3: Final Production Image
# ============================================
FROM node:20-alpine
WORKDIR /app

# Install runtime deps for native modules (better-sqlite3 needs these)
RUN apk add --no-cache python3 make g++

# Copy root node_modules
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy backend node_modules and source
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package*.json ./backend/
COPY backend/src/ ./backend/src/
COPY backend/tsconfig.json ./backend/

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

CMD ["npx", "--prefix", "backend", "tsx", "src/index.ts"]
