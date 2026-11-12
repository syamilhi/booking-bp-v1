# Explain It To Me: What Do We Have Here?

A plain-English, no-jargon guide to what is in this codebase, what it does, and how the pieces fit together.

---

## 1. What Is This Project?

This is a **ready-to-go backend boilerplate** designed for booking, scheduling, and reservation apps (think Calendly, Airbnb, or Mindbody).

It is built as a **SaaS engine from Day One**: multiple different companies or organizations (tenants) can use this single backend, and their data is automatically kept separate so Company A can never see Company B's records.

---

## 2. The 30-Second Architecture

```
[ Your Frontend / Mobile App ]
             │
             ▼
      [ Cloudflare Edge ] (Handles DNS, SSL, and blocks bad bots)
             │
             ▼
   [ Node.js API (Express 5) ] ─── Port 8080
             │
   ┌─────────┼───────────────┬─────────────────┐
   │         │               │                 │
   ▼         ▼               ▼                 ▼
[PostgreSQL] [Upstash Redis] [Google Storage] [Mail Server]
(Prisma ORM) (Queue jobs)    (Direct uploads) (Sends emails)
```

We package everything into **one single Docker image** that can run as either:
- **The API** (`node src/server.js`): Answers HTTP requests from users.
- **The Worker** (`node src/worker.js`): Sits in the background processing tasks (like sending emails) so the API never lags.

---

## 3. Scope: The 6 Core Modules We Built

| Module | What It Does In Plain English | Key Files |
| :--- | :--- | :--- |
| **1. Tenancy** | Knows which company is calling the API (via subdomain, header, or login token) and makes sure they only see their own organization. | [tenant.middleware.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/common/middleware/tenant.middleware.js)<br>[tenants.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/tenants/tenants.service.js) |
| **2. Auth & Users** | Register, Login, Logout, Forgot Password, and Email Verification.<br>• Passwords hashed with **Argon2**.<br>• Issues a 15-minute access token and a rotating 7-day refresh cookie. If a stolen token is reused, all sessions for that user are revoked instantly. | [auth.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/auth/auth.service.js)<br>[users.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/users/users.service.js) |
| **3. Roles & Permissions** | Decides who is allowed to do what using simple labels: `users:read`, `files:upload`, `audit:read`.<br>• Comes with `SUPER_ADMIN`, `TENANT_ADMIN`, and `TENANT_MEMBER` roles ready to use. | [rbac.middleware.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/common/middleware/rbac.middleware.js)<br>[roles.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/roles/roles.service.js) |
| **4. Files & Storage** | Direct-to-cloud upload. When a user uploads an avatar or PDF, the server gives the browser a temporary 15-minute pass to upload directly to Google Cloud Storage. The Node server never touches the heavy file bytes. | [storage.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/files/storage.service.js)<br>[files.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/files/files.service.js) |
| **5. Notifications & Emails** | Dual notification system:<br>• **In-App**: Unread badges and notification lists in the database.<br>• **Emails**: The API drops email jobs into a Redis queue (**BullMQ**), and our background worker sends them via SMTP. | [email.worker.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/notifications/email.worker.js)<br>[notifications.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/notifications/notifications.service.js) |
| **6. Audit & Activity** | Tracks who changed what.<br>• **Compliance Audit**: Silently saves a JSON before/after diff whenever someone creates, edits, or deletes data.<br>• **Activity Feed**: Human-readable timeline for dashboards (e.g. *"Jane updated her profile"*). | [audit.middleware.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/common/middleware/audit.middleware.js)<br>[audit.service.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/modules/audit/audit.service.js) |

---

## 4. Where Does the Data Live?

In PostgreSQL, managed by **Prisma ORM** ([schema.prisma](file:///home/sam/Code/main/backend-bp/booking-bp/prisma/schema.prisma)):
- `tenants`: Companies / organizations using the app.
- `users`: User accounts belonging to a tenant.
- `sessions` & `tokens`: Login sessions, email verify tokens, password reset tokens.
- `roles` & `permissions`: Permission catalog and user role assignments.
- `files` & `uploads`: Metadata and status of uploaded files.
- `notifications` & `email_logs`: In-app alerts and email delivery records.
- `audit_logs` & `activities`: System audit trail and user timeline.

> **The Magic Guard:** In [database.js](file:///home/sam/Code/main/backend-bp/booking-bp/src/common/database.js), we set up a rule that automatically attaches `WHERE tenantId = '...'` to every single query so developers can't accidentally leak data between companies.

---

## 5. What Is *Not* Implemented Yet?

To keep this boilerplate clean and flexible:
1. **The Booking Domain Specifics**:
   Things like `Resource` (e.g. doctor, meeting room, tennis court) and `Booking` (the actual time slot reservation) are left for you to customize for your exact business. The schema and architecture are pre-configured to support PostgreSQL `tstzrange` exclusion constraints so double-bookings are physically impossible.
2. **Cloud Terraform & CI/CD**:
   We wrote full blueprint guides in [05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md](file:///home/sam/Code/main/backend-bp/booking-bp/docs/05-DEFERRED-INFRASTRUCTURE-BLUEPRINT.md), but deferred setting up live GCP cloud pipelines until you're ready to deploy.
3. **Frontend / React UI**:
   This is purely the backend API. A React/Next.js frontend can connect to these endpoints.

---

## 6. How to Run It Right Now

You only need 2 commands:

```bash
# 1. Start local Postgres, Redis, fake storage, and fake mailbox
docker compose up -d

# 2. Start the Express API
npm run dev
```

### Handy Scripts
- `npm test`: Runs all 24 automated tests (currently 100% passing).
- `npm run test:ui`: Opens a visual web dashboard in your browser to inspect tests.
- `npm run dev:worker`: Runs the background email worker process.
- `npm run db:seed`: Seeds the database with default roles and an admin user.

