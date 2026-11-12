# REST API Specification & Endpoint Catalog

## 1. API Conventions & Standards

### 1.1 Base Routing & Headers
- **Base URI**: All endpoints are prefixed under `/api/v1/`.
- **Health Checks**: Root-level `/healthz` (liveness) and `/readyz` (readiness).
- **Transport**: HTTPS strictly enforced. Plain HTTP automatically redirected or rejected at the Cloudflare edge.
- **Request Headers**:
  - `Content-Type`: `application/json` (required for non-GET requests).
  - `Authorization`: `Bearer <accessToken>` (required for authenticated routes).
  - `X-Tenant-Slug`: Optional tenant slug identifier for multi-tenant routing.
  - `Idempotency-Key`: Optional UUID on state-changing endpoints to guarantee once-only execution.

### 1.2 Standard Response Envelopes

#### Success Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

#### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request parameters.",
    "details": [
      {
        "path": "email",
        "message": "Must be a valid email format."
      }
    ]
  }
}
```

---

## 2. Health & Operational Endpoints

### `GET /healthz`
- **Description**: Liveness probe verifying the Node.js event loop is operational.
- **Auth**: Public.
- **Response**: `200 OK`
  ```json
  { "status": "ok", "timestamp": "2026-11-12T06:15:00.000Z" }
  ```

### `GET /readyz`
- **Description**: Readiness probe verifying connectivity to PostgreSQL and Upstash Redis.
- **Auth**: Public.
- **Response**: `200 OK`
  ```json
  {
    "status": "ready",
    "database": "connected",
    "redis": "connected",
    "timestamp": "2026-11-12T06:15:00.000Z"
  }
  ```

---

## 3. Tenancy Module Endpoints (`/api/v1/tenants`)

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/tenants` | Public / `SUPER_ADMIN` | Provisions a new tenant and initializes admin roles. |
| `GET` | `/api/v1/tenants/current` | `tenants:read` | Retrieves metadata and configuration for the current tenant. |
| `PATCH`| `/api/v1/tenants/current` | `tenants:update` | Updates tenant settings, branding, and contact info. |
| `GET` | `/api/v1/tenants` | `SUPER_ADMIN` | Lists all tenants across the platform (super-admin only). |

---

## 4. Auth & Identity Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **Description**: Registers a new user within the resolved tenant.
- **Auth**: Public.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```
- **Response**: `201 Created` returning user summary and enqueuing verification email.

### `POST /api/v1/auth/login`
- **Description**: Authenticates user credentials and issues access/refresh tokens.
- **Auth**: Public.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "user": {
        "id": "e7b0a8f8-...",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "roles": ["TENANT_MEMBER"],
        "permissions": ["bookings:read", "files:upload"]
      }
    }
  }
  ```
  *Sets HTTP-Only, Secure Cookie `refreshToken` (max-age 7 days).*

### `POST /api/v1/auth/refresh`
- **Description**: Rotates the refresh token and issues a new access token.
- **Auth**: Valid `refreshToken` cookie.
- **Response**: `200 OK` with refreshed access token and newly rotated refresh token cookie.

### `POST /api/v1/auth/logout`
- **Description**: Revokes the current session in PostgreSQL and clears auth cookies.
- **Auth**: Authenticated.
- **Response**: `200 OK`.

### `POST /api/v1/auth/verify-email`
- **Description**: Confirms email address using cryptographic token sent via email.
- **Body**: `{ "token": "a4f8c2..." }`
- **Response**: `200 OK`.

### `POST /api/v1/auth/forgot-password`
- **Description**: Requests password reset link.
- **Body**: `{ "email": "user@example.com" }`
- **Response**: `200 OK` (generic success message to prevent user enumeration).

### `POST /api/v1/auth/reset-password`
- **Description**: Resets password using token and revokes all active user sessions.
- **Body**: `{ "token": "b7e21...", "newPassword": "NewPassword123!" }`
- **Response**: `200 OK`.

### `GET /api/v1/auth/me`
- **Description**: Fetches current user profile, active tenant info, roles, and permissions.
- **Auth**: Authenticated.
- **Response**: `200 OK`.

---

## 5. Users Management Endpoints (`/api/v1/users`)

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | `users:read` | Paged query of users within the tenant. Supports `?status=`, `?search=`. |
| `POST` | `/api/v1/users` | `users:create` | Creates a user or sends an invitation to join the tenant. |
| `GET` | `/api/v1/users/:id` | `users:read` | Retrieves detailed user profile and assigned roles. |
| `PATCH`| `/api/v1/users/:id` | `users:update` | Updates user details, status, or contact information. |
| `DELETE`| `/api/v1/users/:id` | `users:delete` | Soft-deletes or deactivates user account. |
| `POST` | `/api/v1/users/:id/roles` | `roles:assign` | Assigns or replaces user roles. Body: `{ "roleIds": ["..."] }`. |

---

## 6. Roles & Permissions Endpoints (`/api/v1/roles`)

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/roles` | `roles:read` | Lists all roles available to the tenant (system roles + tenant custom roles). |
| `POST` | `/api/v1/roles` | `roles:create` | Creates a tenant-custom role with specified permission IDs. |
| `GET` | `/api/v1/roles/:id` | `roles:read` | Fetches a single role with attached permissions. |
| `PUT` | `/api/v1/roles/:id` | `roles:update` | Updates custom role name, description, or attached permissions. |
| `DELETE`| `/api/v1/roles/:id` | `roles:delete` | Deletes a custom role (system roles cannot be deleted). |
| `GET` | `/api/v1/permissions` | `roles:read` | Returns the complete catalog of system permissions (`resource:action`). |

---

## 7. Notifications Endpoints (`/api/v1/notifications`)

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Authenticated | Paged list of in-app notifications for the authenticated user. |
| `GET` | `/api/v1/notifications/unread-count`| Authenticated | Returns `{ "unreadCount": 5 }`. |
| `PATCH`| `/api/v1/notifications/:id/read` | Authenticated | Marks a specific notification as `READ`. |
| `POST` | `/api/v1/notifications/mark-all-read` | Authenticated | Bulk marks all notifications for user as `READ`. |

---

## 8. Media & Storage Endpoints (`/api/v1/files`)

### `POST /api/v1/files/upload-url`
- **Permission**: `files:upload`
- **Body**:
  ```json
  {
    "originalName": "contract.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 2048500,
    "isPublic": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "fileId": "6c45f448-...",
      "uploadUrl": "https://storage.googleapis.com/...signed-v4-params...",
      "expiresAt": "2026-11-12T06:30:00.000Z"
    }
  }
  ```

### `POST /api/v1/files/:id/confirm`
- **Permission**: `files:upload`
- **Description**: Verifies that the client finished uploading the binary to GCS and marks file `UPLOADED`.
- **Response**: `200 OK`.

### `GET /api/v1/files/:id/download-url`
- **Permission**: `files:read`
- **Description**: Generates a temporary signed download URL for private files.
- **Response**: `200 OK` returning `{ "downloadUrl": "...", "expiresIn": 900 }`.

### `DELETE /api/v1/files/:id`
- **Permission**: `files:delete`
- **Description**: Marks file as deleted in DB and schedules GCS object removal.

---

## 9. Audit & Activity Endpoints (`/api/v1/audit`)

### `GET /api/v1/audit/logs`
- **Permission**: `audit:read`
- **Query Params**: `?page=1&limit=50&entity=User&action=user.created&startDate=...&endDate=...`
- **Response**: `200 OK` containing compliance audit records with JSON diffs.

### `GET /api/v1/audit/activities`
- **Permission**: Authenticated
- **Query Params**: `?page=1&limit=20`
- **Response**: `200 OK` containing human-readable activity timeline.

