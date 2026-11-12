# Deferred Infrastructure Blueprint: Terraform & CI/CD

> [!NOTE]
> **Status: DEFERRED (App-Only Initialization Mode)**
> Per architectural decision, project development starts in **App-Only** mode to prioritize rapid local feature delivery, modular testing, and containerization.
> 
> The Terraform Infrastructure-as-Code (IaC) and GitHub Actions CI/CD specifications documented below serve as an engineering blueprint ready for turnkey provisioning when preparing for live cloud staging and production environments.

---

## 1. Cloud Infrastructure Architecture with Terraform

When provisioning GCP and Cloudflare resources, Terraform maintains remote state in a dedicated GCS bucket with state locking.

### 1.1 Directory Layout
```
infra/terraform/
├── environments/
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── modules/
    ├── cloud_run/        # Cloud Run API & Worker services
    ├── cloud_sql/        # Cloud SQL PostgreSQL 16 HA instance
    ├── storage/          # GCS private and public media buckets
    ├── secrets/          # Google Secret Manager secrets
    └── cloudflare/       # DNS, WAF rules, SSL Full Strict
```

### 1.2 Core Terraform Configurations

#### Cloudflare Module (`modules/cloudflare/main.tf`)
```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "zone_id" { type = string }
variable "domain" { type = string }
variable "origin_ip" { type = string }
variable "origin_secret" { type = string }

# SSL Full (Strict) Enforcement
resource "cloudflare_zone_settings_override" "settings" {
  zone_id = var.zone_id
  settings {
    ssl                      = "strict"
    min_tls_version          = "1.2"
    always_use_https         = "on"
    browser_check            = "on"
    security_level           = "medium"
  }
}

# Proxy DNS record pointing to Cloud Run custom domain
resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = "api"
  content = var.origin_ip
  type    = "CNAME"
  proxied = true
}

# Rate Limiting Ruleset
resource "cloudflare_ruleset" "rate_limiting" {
  zone_id     = var.zone_id
  name        = "API Rate Limiting"
  description = "Protect API auth and write endpoints from brute-force"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action = "block"
    action_parameters {
      response {
        status_code  = 429
        content_type = "application/json"
        content      = "{\"error\": \"Rate limit exceeded. Please wait a minute.\"}"
      }
    }
    ratelimit {
      characteristics     = ["cf.unique_visitor_id"]
      period              = 60
      requests_per_period = 100
    }
    expression  = "(http.request.uri.path matches \"^/api/v1/auth/.*\")"
    description = "Limit auth requests to 100/minute per visitor"
    enabled     = true
  }
}
```

#### Cloud SQL PostgreSQL Module (`modules/cloud_sql/main.tf`)
```hcl
resource "google_sql_database_instance" "postgres" {
  name             = "booking-db-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = var.environment == "prod" ? "db-custom-2-7680" : "db-f1-micro"
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = 20
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      transaction_log_retention_days = 7
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }

  deletion_protection = var.environment == "prod" ? true : false
}

resource "google_sql_database" "database" {
  name     = "booking_${var.environment}"
  instance = google_sql_database_instance.postgres.name
}
```

#### Cloud Run Compute Module (`modules/cloud_run/main.tf`)
```hcl
# API Service
resource "google_cloud_run_v2_service" "api" {
  name     = "booking-api-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0
      max_instance_count = 10
    }

    containers {
      image = var.container_image
      args  = ["node", "src/server.js"]

      resources {
        limits = {
          cpu    = "1000m"
          memory = "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "DATABASE_URL"
            version = "latest"
          }
        }
      }

      env {
        name = "UPSTASH_REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = "UPSTASH_REDIS_URL"
            version = "latest"
          }
        }
      }
    }
  }
}

# Worker Service (BullMQ Processor)
resource "google_cloud_run_v2_service" "worker" {
  name     = "booking-worker-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }

    containers {
      image = var.container_image
      args  = ["node", "src/worker.js"]

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        cpu_idle = false # CPU always allocated to continuously process queues
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name = "UPSTASH_REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = "UPSTASH_REDIS_URL"
            version = "latest"
          }
        }
      }
    }
  }
}
```

---

## 2. CI/CD Pipeline Blueprint (GitHub Actions)

The deployment pipeline is fully automated and passwordless, utilizing **Google Cloud Workload Identity Federation (WIF)** to eliminate long-lived service account keys.

### 2.1 Continuous Integration (`.github/workflows/ci.yml`)
Runs on every Pull Request and push to `main`:
```yaml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: booking_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Validate Prisma Schema
        run: npx prisma validate

      - name: Run Prisma Migrations on Test DB
        env:
          DATABASE_URL: postgresql://postgres:testpassword@localhost:5432/booking_test?schema=public
        run: npx prisma migrate deploy

      - name: Run Linter
        run: npm run lint

      - name: Execute Vitest Suites
        env:
          DATABASE_URL: postgresql://postgres:testpassword@localhost:5432/booking_test?schema=public
          UPSTASH_REDIS_URL: redis://localhost:6379
          JWT_SECRET: super-secret-test-jwt-key-minimum-32-characters
          JWT_REFRESH_SECRET: super-secret-test-refresh-jwt-key-32-chars
        run: npm test -- --coverage
```

### 2.2 Continuous Deployment (`.github/workflows/deploy.yml`)
Executes migrations via a Cloud Run Job before safely updating the API and Worker containers:
```yaml
name: Continuous Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # Required for Workload Identity Federation

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_WIF_SERVICE_ACCOUNT }}

      - name: Setup Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Authorize Docker with Artifact Registry
        run: gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

      - name: Build and Push Docker Image
        env:
          IMAGE_TAG: asia-southeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/booking/api:${{ github.sha }}
        run: |
          docker build -t $IMAGE_TAG .
          docker push $IMAGE_TAG

      - name: Execute Prisma Migration via Cloud Run Job
        env:
          IMAGE_TAG: asia-southeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/booking/api:${{ github.sha }}
        run: |
          gcloud run jobs execute prisma-migrate \
            --image=$IMAGE_TAG \
            --args="npx,prisma,migrate,deploy" \
            --wait

      - name: Deploy API Service to Cloud Run
        env:
          IMAGE_TAG: asia-southeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/booking/api:${{ github.sha }}
        run: |
          gcloud run deploy booking-api \
            --image=$IMAGE_TAG \
            --region=asia-southeast1 \
            --platform=managed

      - name: Deploy Worker Service to Cloud Run
        env:
          IMAGE_TAG: asia-southeast1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/booking/api:${{ github.sha }}
        run: |
          gcloud run deploy booking-worker \
            --image=$IMAGE_TAG \
            --region=asia-southeast1 \
            --platform=managed
```

