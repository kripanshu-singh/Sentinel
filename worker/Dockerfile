# syntax=docker/dockerfile:1
#
# Build context = the `worker/` directory (set as Render's Root Directory).
# All COPY paths are therefore relative to `worker/`.

# ---------------------------------------------------------------------------
# Build stage — compile TypeScript to dist/ with the full dev dependency set
# ---------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage — official Playwright image ships Node + Chromium + all OS deps
# (runs as pwuser, uid 1000). The Navigator already launches with
# --no-sandbox, so Chromium works unprivileged.
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.50.1-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=1000:1000 package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=1000:1000 --from=build /app/dist ./dist

ENV PLAYWRIGHT_HEADLESS=true
EXPOSE 3001

CMD ["node", "dist/index.js"]