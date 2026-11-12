# -------------------------------------------------------------
# Stage 1: Dependencies & Prisma Client Generation
# -------------------------------------------------------------
FROM node:22-alpine AS dependencies
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# -------------------------------------------------------------
# Stage 2: Production Prune
# -------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm prune --production

# -------------------------------------------------------------
# Stage 3: Runner (Production Image)
# -------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Security: Run as unprivileged node user
USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/src ./src

EXPOSE 8080

# Default entrypoint runs API. Overridden for Worker: "node src/worker.js"
CMD ["node", "src/server.js"]

