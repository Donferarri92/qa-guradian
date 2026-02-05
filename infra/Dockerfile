# QA Guardian - Multi-stage Dockerfile
# Build stage for backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Build stage for frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install production dependencies for backend
COPY --from=backend-builder /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --production

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy frontend build
WORKDIR /app
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --production

# Set up runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose ports
EXPOSE 3000 3001

# Copy startup script
COPY --chown=nodejs:nodejs infra/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
