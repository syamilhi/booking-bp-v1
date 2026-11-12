# Infrastructure & Deployment Specification

## 1. Overview & Cloud Topography

This document specifies the deployment topology, runtime architecture, network security, container configuration, and local development environment for the multi-tenant booking backend.

The production infrastructure leverages:
- **Cloudflare**: Global Anycast Edge (DNS, SSL/TLS Termination, WAF, DDoS mitigation, rate limiting).
- **Google Cloud Platform (GCP)**: Serverless compute, managed database, object storage, and secrets.
- **Upstash**: Serverless managed Redis providing standard Redis protocol over TLS for BullMQ queues.

```mermaid
flowchart TD
    subgraph Edge["Cloudflare Edge Network"]
        DNS["Cloudflare DNS (Proxied)"]
        WAF["Cloudflare WAF & Bot Management"]
        RateLimit["Edge Rate Limiter"]
        CDN["Edge Cache (Static/Public Assets)"]
    end

    subgraph GCP_Project["GCP Project (Production)"]
        subgraph CloudRunCluster["Cloud Run Compute"]
            API_Run["Cloud Run: 'api-service'<br/>Min: 1, Max: 10<br/>CPU: 1 vCPU, RAM: 1GB<br/>Port: 8080<br/>Auto-scaling on Request Load"]
            Worker_Run["Cloud Run: 'worker-service'<br/>Instances: 1 (CPU Always Allocated)<br/>RAM: 512MB<br/>Processes Background Queues"]
        end

        subgraph GCP_Storage["Data & Storage Layer"]
            CloudSQL[("Cloud SQL PostgreSQL 16<br/>High Availability (Regional)<br/>Private IP + PITR Backups")]
            GCS_Private[("GCS Bucket: Private Uploads<br/>V4 Signed URL Access Only")]
            GCS_Public[("GCS Bucket: Public Media<br/>CDN Proxy Caching")]
        end

        subgraph GCP_Security["Security & Config"]
            SecretManager["Secret Manager<br/>(JWT, DB Credentials, API Keys)"]
            IAM["IAM Service Accounts<br/>Least Privilege Roles"]
        end
    end

    subgraph External_Services["External Cloud Dependencies"]
        UpstashRedis[("Upstash Redis (Serverless)<br/>TLS / Port 6379<br/>Queue State & Idempotency")]
        EmailGateway["SMTP / Resend Provider"]
    end

    %% Network links
    DNS --> WAF
    WAF --> RateLimit
    RateLimit -->|"Origin Pull (CF-Secret Header)"| API_Run
    RateLimit --> CDN
    CDN -.->|"Cache Miss"| GCS_Public

    API_Run -->|"Prisma Pooling (Direct / Proxy)"| CloudSQL
    Worker_Run -->|"Prisma Client"| CloudSQL

    API_Run -->|"BullMQ Producer"| UpstashRedis
    Worker_Run -->|"BullMQ Consumer"| UpstashRedis

    API_Run -->|"Generate Signed PUT/GET"| GCS_Private
    Worker_Run -->|"Send Mail"| EmailGateway

    SecretManager -.->|"Injected at Container Boot"| API_Run
    SecretManager -.->|"Injected at Container Boot"| Worker_Run
```

---

## 2. Cloudflare Edge Architecture

### 2.1 SSL/TLS & Origin Protection
1. **Encryption Mode**: **Full (Strict)**. Cloudflare validates the certificate presented by Cloud Run custom domain mappings.
2. **Authenticated Origin Pulls & Shared Secret**:
   - To ensure requests cannot bypass Cloudflare and hit the Cloud Run service directly, an edge transform rule injects a secret header:
     `X-Origin-Verification: <random-64-char-hex-secret>`
   - The Express application includes an origin-guard middleware verifying this header on every non-local request:
     ```javascript
     // In common/middleware/origin.middleware.js
     export function requireCloudflareOrigin(req, res, next) {
       if (process.env.NODE_ENV !== 'production') return next();
       const secret = req.headers['x-origin-verification'];
       if (!secret || secret !== process.env.CLOUDFLARE_ORIGIN_SECRET) {
         return res.status(403).json({ error: 'Direct origin access forbidden.' });
       }
       next();
     }
     ```

### 2.2 WAF & Rate Limiting Rules
1. **API Rate Limiting**:
   - Rate limit by IP: Max 120 requests per minute across `/api/v1/*`.
   - Sensitive endpoints rate limiting:
     - `POST /api/v1/auth/login`: 5 requests per minute per IP.
     - `POST /api/v1/auth/register`: 3 requests per minute per IP.
     - `POST /api/v1/auth/forgot-password`: 2 requests per minute per IP.
2. **DDoS & Bot Mitigation**:
   - Cloudflare Managed Challenge on suspicious threat scores (> 40).
   - Block traffic with known malicious user-agents or Tor exit nodes when accessing administrative endpoints (`/api/v1/tenants/*`).

---

## 3. Google Cloud Platform (GCP) Configuration

### 3.1 Cloud Run Service 1: API Service (`booking-api`)
- **Container Port**: Configurable via `$PORT` environment variable (defaults to `8080`).
- **Autoscaling Policy**:
  - `min-instances`: 1 (prevents cold-starts in production).
  - `max-instances`: 10 (configurable baseline for burst capacity).
  - Target Concurrency: 80 concurrent requests per container.
- **Resource Limits**:
  - Memory: 1 GiB.
  - CPU: 1 vCPU.
- **Health Checks**:
  - Liveness Probe: `GET /healthz` (checks Express loop responsiveness).
  - Readiness Probe: `GET /readyz` (checks PostgreSQL and Upstash Redis connectivity).
- **Graceful Termination**:
  - Cloud Run emits `SIGTERM` and grants a 10–15 second window before sending `SIGKILL`.
  - The application intercepts `SIGTERM`, ceases accepting new HTTP requests, closes active database pools, and terminates cleanly.

### 3.2 Cloud Run Service 2: Worker Service (`booking-worker`)
- **Execution Mode**: Cloud Run service with **"CPU always allocated"** enabled.
- **Scaling Policy**:
  - `min-instances`: 1.
  - `max-instances`: 2 (scaled based on queue depth).
- **Inbound Ports**: None exposed to public internet. Internal admin endpoints or health probes only.
- **Role**:
  - Consumes BullMQ jobs from Upstash Redis (`email-queue`, `notification-queue`, `audit-queue`).
  - Executes scheduled cron tasks (e.g. daily session cleanup, expired token deletion).

### 3.3 Cloud SQL for PostgreSQL 16
- **Architecture**:
  - Production: High Availability (Regional failover), SSD storage with auto-increase.
  - Point-in-Time Recovery (PITR) enabled with 7-day transaction log retention.
  - Automated daily backups at 02:00 UTC.
- **Connection Management & Pooling**:
  - Because serverless Cloud Run instances scale dynamically, direct database connections can quickly saturate PostgreSQL's `max_connections`.
  - The system utilizes **Prisma connection pool sizing**:
    `DATABASE_URL="postgresql://user:pass@host:5432/booking_db?schema=public&connection_limit=10&pool_timeout=20"`
  - For high-density deployments, Cloud SQL Auth Proxy or PgBouncer is deployed between Cloud Run and Cloud SQL.

### 3.4 Google Cloud Storage (GCS)
Two dedicated buckets are established:
1. **`${GCP_PROJECT_ID}-media-private`**:
   - Access: Purely private (Uniform Bucket-Level Access).
   - Storage Class: Standard.
   - Purpose: User uploads, invoices, contracts, identity documents.
   - Access Pattern: Clients upload and download strictly via **GCS V4 Signed URLs** generated by the API with 15-minute expirations.
2. **`${GCP_PROJECT_ID}-media-public`**:
   - Access: Publicly readable (allUsers:objectViewer) or proxied via Cloudflare CDN.
   - Purpose: Public avatars, brand logos, system thumbnails.
   - Cache-Control: `public, max-age=31536000, immutable`.

### 3.5 Secret Manager & IAM
- **Secrets Architecture**:
  - All sensitive credentials (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `UPSTASH_REDIS_URL`, `SMTP_PASS`) are stored in Google Cloud Secret Manager.
  - Cloud Run mounts these secrets directly into environment variables at runtime, ensuring zero secret leakage into Git or container images.
- **Service Accounts**:
  - `sa-booking-api@${PROJECT}.iam.gserviceaccount.com`:
    - Roles: `Cloud SQL Client`, `Secret Manager Secret Accessor`, `Storage Object Creator`, `Storage Object Viewer`.
  - `sa-booking-worker@${PROJECT}.iam.gserviceaccount.com`:
    - Roles: `Cloud SQL Client`, `Secret Manager Secret Accessor`.

---

## 4. Upstash Redis Architecture

### 4.1 Serverless Topology
Upstash provides a fully managed Redis-compatible data store with TLS encryption natively supported without requiring VPC peering or VPC Connectors from Cloud Run.

### 4.2 BullMQ Integration Settings
BullMQ requires specific Redis configuration options when running on managed serverless instances:
```javascript
// In common/redis.js
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redisConnection = new Redis(env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  tls: env.UPSTASH_REDIS_URL.startsWith('rediss://') ? {} : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
});
```

---

## 5. Local Development Environment (`docker-compose.yml`)

The local development orchestration allows developers to build, test, and run the entire platform completely offline without live cloud credentials.

### 5.1 Local Services
1. **`postgres`**: PostgreSQL 16 Alpine container with pre-configured healthcheck.
2. **`fake-gcs-server`**: Emulates the Google Cloud Storage JSON API and signed URLs locally on port 4443. Pre-creates test buckets.
3. **`mailpit`**: Catch-all SMTP development server. Catches all outgoing emails on port 1025 and renders them in a web UI at `http://localhost:8025`.
4. **`redis-local`**: Standard Redis 7 Alpine container for offline development when Upstash is not connected.

### 5.2 Docker Compose Specification

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: booking_bp_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: booking_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d booking_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  fake-gcs:
    image: fsouza/fake-gcs-server:latest
    container_name: booking_bp_gcs
    restart: unless-stopped
    ports:
      - "4443:4443"
    command: -scheme http -public-host localhost:4443
    volumes:
      - gcsdata:/data

  mailpit:
    image: axllent/mailpit:latest
    container_name: booking_bp_mailpit
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP port
      - "8025:8025" # Web UI
    environment:
      MP_MAX_MESSAGES: 500

  redis-local:
    image: redis:7-alpine
    container_name: booking_bp_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  gcsdata:
  redisdata:
```

---

## 6. Production Multi-Stage Dockerfile

The `Dockerfile` employs a multi-stage build to minimize image size, eliminate development dependencies, and run as an unprivileged user:

```dockerfile
# -------------------------------------------------------------
# Stage 1: Dependencies & Prisma Generation
# -------------------------------------------------------------
FROM node:22-alpine AS dependencies
WORKDIR /app

# Install build dependencies if native addons needed
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
# Remove development packages
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

# Copy dependencies and prisma client
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/src ./src

EXPOSE 8080

# Default entrypoint runs the API. Worker is launched by overriding CMD:
# docker run <image> node src/worker.js
CMD ["node", "src/server.js"]
```

