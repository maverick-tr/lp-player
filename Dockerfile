# ── LP Player — Docker Image ────────────────────────────────
# Build:  docker build -t lp-player .
# Run:    docker run -p 4243:4243 lp-player
# ────────────────────────────────────────────────────────────

FROM node:20-slim AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source for frontend build
COPY . .

# Build frontend
RUN npm run build

# ── Production stage ────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Copy only what's needed for production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/server/services ./server/services
COPY --from=build /app/package.json ./package.json

# Write clean default data (no personal data)
RUN mkdir -p src/data && \
    echo '{"tools":[]}' > src/data/tools.json && \
    echo '{"ai":{"apiUrl":"","apiKey":"","model":""},"installation":{"autoConfirmPortChanges":false,"autoRunWithoutReview":false,"alwaysCreatePythonVenv":true,"preferUv":true,"autoSkipIncompatiblePackages":false},"environment":{"globalVariables":{}},"soundEffects":{"enabled":true,"genre":"90s pop"},"paths":{"defaultProjectsFolder":""}}' > src/data/settings.json

EXPOSE 4243

ENV HOST=0.0.0.0
ENV PORT=4243

CMD ["node", "server.cjs"]
