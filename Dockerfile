FROM node:20-alpine AS base

# Create app directory
WORKDIR /app

# Install system dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init curl bash && \
    rm -rf /var/cache/apk/*

# Install dependencies first, to take advantage of Docker layer caching
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code (excluding unnecessary files)
COPY --chown=node:node . .

# Build stage (if needed)
FROM base AS build
RUN npm ci && npm run build

# Production stage
FROM base AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user with specific UID/GID for better security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create and set proper permissions for logs and storage directories
RUN mkdir -p /app/logs /app/storage && \
    chown -R nodejs:nodejs /app/logs /app/storage && \
    chmod 755 /app/logs /app/storage

# Set ownership for entire app
RUN chown -R nodejs:nodejs /app

# Remove unnecessary files to reduce attack surface
RUN find /app -type f -name "*.md" -delete && \
    find /app -type f -name "*.spec.js" -delete && \
    find /app -type f -name "*.test.js" -delete && \
    rm -rf /app/.git /app/docs /app/examples

# Switch to non-root user
USER nodejs

# Healthcheck to verify container health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Expose the port
EXPOSE 3000

# Use dumb-init as an init system to properly handle signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run the application with production flags for better performance
CMD ["node", "--max-old-space-size=2048", "--heapsnapshot-signal=SIGUSR2", "src/index.js"]