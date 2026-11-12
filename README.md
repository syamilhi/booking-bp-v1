# Multi-Tenant Booking Backend Boilerplate

An enterprise-ready, modular backend boilerplate built for booking, reservation, and scheduling applications. Designed to run on **Google Cloud Platform (Cloud Run & Cloud SQL)** with **Cloudflare Edge**, **PostgreSQL (Prisma ORM)**, and **Upstash Redis (BullMQ)**.

---

## 1. Architectural Highlights

- **Multi-Tenant from Day One**: Shared database, shared schema with automated Prisma Client extension isolation and compound tenant indexing.
- **Argon2id & Rotating JWT Sessions**: Hardware-grade password hashing, short-lived access tokens, and rotating refresh tokens with session family theft detection.
- **Granular RBAC (`resource:action`)**: Decoupled permissions matrix supporting system-wide roles (Super Admin) and tenant-customizable roles.
- **Direct-to-Storage Media Pipeline**: High-performance V4 Signed PUT/GET URL streaming to Google Cloud Storage (GCS) preventing API memory exhaustion.
- **Asynchronous Queues & Emails**: BullMQ workers powered by Upstash serverless Redis, processing notification and email queues with exponential backoff.
- **Two-Tier Audit Tracking**: Immutable append-only compliance audit logs with state diffs plus customer-facing activity timelines.
- **Double-Booking Prevention Ready**: Architectural foundation for PostgreSQL `tstzrange` exclusion constraints (`btree_gist`) to eliminate scheduling race conditions.
- **Cloud Run Ready**: Containerized via multi-stage Dockerfile, handling `$PORT`, stateless autoscaling, and graceful `SIGTERM` termination.

---

## 2. Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Runtime** | Node.js 22 LTS (ESM) | High-performance asynchronous execution |
| **Framework** | Express 5.x | Modular routing and middleware pipeline |
| **Database** | PostgreSQL 16 + Prisma ORM | Relational integrity, JSONB, and exclusion constraints |
| **Caching & Queues**| Upstash Redis + BullMQ | Serverless TLS queue state and rate limiting |
| **Object Storage** | Google Cloud Storage (GCS) | V4 Signed URL direct binary uploads/downloads |
| **Edge & Security** | Cloudflare | Anycast DNS, SSL Full (Strict), WAF, and DDoS mitigation |
| **Email Transport** | Nodemailer | SMTP transport (Mailpit locally, Resend/SendGrid in prod) |
| **Validation** | Zod | Runtime type safety on request bodies, params, and env |
| **Logging** | Pino | Structured JSON logs formatted for GCP Cloud Logging |
| **Testing** | Vitest + Supertest | Unit, integration, and tenant isolation test suites |

---

## 3. Documentation Index

The complete architectural specifications, database schemas, and implementation blueprints are located in the `docs/` directory:

| Document | Purpose |
| :--- | :--- |
| **[00-OVERVIEW.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/00-OVERVIEW.md)** | Executive summary, technology matrix, and high-level system diagrams. |
| **[01-INFRASTRUCTURE-AND-DEPLOYMENT.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/01-INFRASTRUCTURE-AND-DEPLOYMENT.md)** | Cloud Run, Cloudflare WAF, Upstash Redis, Docker, and local Docker Compose orchestration. |
| **[02-DATABASE-AND-PRISMA-SCHEMA.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/02-DATABASE-AND-PRISMA-SCHEMA.md)** | Full Prisma schema, multi-tenant extension, and booking exclusion constraints. |
| **[03-CORE-MODULES-ARCHITECTURE.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/03-CORE-MODULES-ARCHITECTURE.md)** | Detailed breakdown of Tenancy, Auth, RBAC, Notifications, Files, and Audit modules. |
| **[04-API-SPECIFICATION.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/04-API-SPECIFICATION.md)** | Comprehensive REST API catalog, endpoints, request/response bodies, and status codes. |
| **[05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md)** | Terraform IaC and GitHub Actions CI/CD specifications (flagged for post-app adoption). |
| **[06-STEP-BY-STEP-IMPLEMENTATION-ROADMAP.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/06-STEP-BY-STEP-IMPLEMENTATION-ROADMAP.md)** | 10-phase development and test execution sequence. |

---

## 4. Local Development Quickstart

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ & npm

### 1. Launch Local Infrastructure
```bash
docker compose up -d
```
Starts:
- **PostgreSQL 16** on `localhost:5432`
- **fake-gcs-server** on `localhost:4443`
- **Mailpit** (SMTP on `localhost:1025`, Web UI on `http://localhost:8025`)
- **Redis (Local)** on `localhost:6379`

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run the API and Worker
```bash
# Terminal 1: Run API Service
npm run dev

# Terminal 2: Run Background Worker Service
npm run dev:worker
```

---

## 5. Scope & Deferred Infrastructure Note

> [!NOTE]
> Per project guidelines, development begins in **App-Only** mode to prioritize rapid local implementation, schema design, and modular testing. Terraform infrastructure-as-code and GitHub Actions CI/CD pipelines are fully designed and documented in **[05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md)** for seamless activation when transitioning to staging and production cloud deployments.

