FROM node:20-alpine AS base

# Create app directory
WORKDIR /app

# Install dependencies first, to take advantage of Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build stage (if needed)
FROM base AS build
RUN npm ci && npm run build

# Production stage
FROM base AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 3000

# Run the application
CMD ["node", "src/index.js"]