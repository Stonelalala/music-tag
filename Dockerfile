# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Backend & Final Image
FROM node:20-alpine
WORKDIR /app

# Install runtime dependencies (if any)
# RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install
RUN npm install --prefix backend

# Copy source
COPY backend/ ./backend/
# Copy frontend build from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Env variables
ENV NODE_ENV=production
ENV PORT=8002
ENV DATA_DIR=/app/config
ENV MUSIC_DIR=/music

EXPOSE 8002

# Run with tsx (or compile to JS if preferred, but tsx is easier for this setup)
CMD ["npx", "--prefix", "backend", "tsx", "src/index.ts"]
