# Tech Fusion ’26 AI Hackathon — Track B: CityLab Diagnostics
# Production multi-stage Dockerfile for containerized deployment

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# Copy source code and config
COPY . .

# Run unit tests to ensure integrity before build
RUN npx vitest run

# Build production bundle (client + SSR nitro server)
RUN npm run build

# --- Stage 2: Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy prebuilt output from builder
COPY --from=builder /app/.output ./.output

EXPOSE 3000

# Run the Nitro production server
CMD ["node", ".output/server/index.mjs"]
