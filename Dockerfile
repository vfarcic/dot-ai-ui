# Build stage - compile TypeScript and bundle React app
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files needed for build
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/
COPY server/ ./server/

# Build frontend (TypeScript compilation + Vite bundle)
RUN npm run build

# Compile server TypeScript to JavaScript using project configuration
RUN npx tsc --project server/tsconfig.json

# Prune devDependencies for production
RUN npm prune --omit=dev

# Runtime stage - minimal image for serving
FROM node:24-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy compiled server code
COPY --from=builder /app/server-dist ./server-dist

# Copy package.json for module type
COPY --from=builder /app/package.json ./

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment variables with sensible defaults
ENV NODE_ENV=production
ENV PORT=3000
# DOT_AI_MCP_URL must be set at runtime to point to the MCP server
# Example: http://dot-ai:3456 in Kubernetes
ENV DOT_AI_MCP_URL=http://localhost:8080
# DOT_AI_AUTH_TOKEN should be set at runtime, not in image

EXPOSE 3000

# Use exec form for proper signal handling
CMD ["node", "server-dist/index.js"]
