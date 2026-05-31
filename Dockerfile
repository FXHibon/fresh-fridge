# Stage 1: Build stage
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json vite.config.ts index.html db.ts ./
COPY src/ ./src
COPY migrations/ ./migrations
COPY server.ts ./

# Build the frontend and compile the backend server
RUN npm run build

# Stage 2: Production runner stage
FROM node:24-alpine AS runner

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy build output from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose the server port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.cjs"]
