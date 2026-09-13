# Caring Contacts — Sovereign Australian Container Deployment Runbook

> **OPERATIONAL SAFETY NOTICE (HAZARD H-36 / #NCAWAF)**
>
> This runbook specifies the operator procedures for deploying the sovereign Caring Contacts application container to Australian cloud infrastructure in Sydney (`ap-southeast-2` / `australiaeast`).
>
> **Hazard H-36 Mandate:** Real patient Protected Health Information (PHI) in suicide aftercare (patient names, preferred names, Australian mobile numbers, hospital UMRNs, care plans, and contact dispatch records) must never transit or reside in foreign jurisdictions. Because Railway has no Australian region, real-patient deployments are strictly prohibited on Railway and must use this sovereign container blueprint.
>
> **Detailed Specification:** [`docs/deployment/caring-contacts-sovereign-australia.md`](../../docs/deployment/caring-contacts-sovereign-australia.md)

---

## 1. Overview of Artifacts

| File                                            | Purpose                                                                                                             |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `deploy/australia/Dockerfile.australia`         | Multi-stage production container for Next.js 16 on Node 24 with security hardening and non-root `nextjs` execution. |
| `deploy/australia/docker-compose.australia.yml` | Local and staging orchestration specifying isolated networking and deep `/api/health/ready` probing.                |
| `deploy/australia/env.australia.example`        | Template for sovereign environment variables with explicit database separation and zero-egress controls.            |
| `deploy/australia/README.md`                    | This deployment and operational verification runbook.                                                               |

---

## 2. Prerequisites

1. **Docker Engine & Buildx:** Docker 24+ with `buildx` enabled.
2. **Cloud CLI Tools:**
   - For AWS: `aws-cli` v2 installed and configured with credentials for region `ap-southeast-2` (Sydney).
   - For Azure: `az` CLI installed and logged into an Australian subscription (`australiaeast`).
3. **Dedicated Sydney Supabase Project:**
   - A dedicated Supabase instance provisioned in AWS Sydney (`ap-southeast-2`).
   - **CRITICAL:** Do NOT reuse the PsychSift knowledge-base project (`sjrfecxgysukkwxsowpy`). The application executes `assertNotClinicalKbProject()` during startup and will crash intentionally if that project ref is supplied.
4. **Secrets Management:** Access to AWS Secrets Manager (Sydney) or Azure Key Vault (`australiaeast`).

---

## 3. Local Build & Smoke Verification

Before deploying to cloud container runtimes, verify the container builds cleanly and satisfies healthchecks locally.

### 3.1 Step 1: Prepare Environment File

```bash
cp deploy/australia/env.australia.example deploy/australia/env.australia
```

Edit `deploy/australia/env.australia` with the credentials for the test Sydney database.

### 3.2 Step 2: Build the Container Image

Execute the build from the repository root:

```bash
docker build \
  --file deploy/australia/Dockerfile.australia \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<sydney-project-ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
  --build-arg ALLOW_LOW_RAM_BUILD=1 \
  --tag caring-contacts-app-australia:latest \
  .
```

### 3.3 Step 3: Run via Docker Compose

```bash
docker compose -f deploy/australia/docker-compose.australia.yml up -d
```

### 3.4 Step 4: Verify Health & Readiness

Inspect container logs and probe the deep health check:

```bash
# Check container logs
docker compose -f deploy/australia/docker-compose.australia.yml logs -f caring-contacts-app

# Probe deep readiness endpoint (evaluates database connectivity)
curl -sI http://127.0.0.1:3000/api/health/ready
```

Expected response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

---

## 4. Option A: AWS ECS Fargate Deployment (`ap-southeast-2`)

### 4.1 Step 1: Create Amazon ECR Repository in Sydney

```bash
aws ecr create-repository \
  --repository-name caring-contacts-app \
  --region ap-southeast-2 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=KMS
```

### 4.2 Step 2: Push Image to ECR

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.ap-southeast-2.amazonaws.com"

aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin "${REGISTRY}"

docker tag caring-contacts-app-australia:latest "${REGISTRY}/caring-contacts-app:latest"
docker push "${REGISTRY}/caring-contacts-app:latest"
```

### 4.3 Step 3: Store Production Secrets in AWS Secrets Manager (Sydney)

Store the sensitive connection strings and keys in Secrets Manager encrypted with an `ap-southeast-2` KMS Key:

```bash
aws secretsmanager create-secret \
  --name "caring-contacts/production" \
  --region ap-southeast-2 \
  --secret-string '{
    "CARING_CONTACTS_DATABASE_URL": "postgresql://postgres:[PASSWORD]@db.<sydney-project-ref>.supabase.co:5432/postgres?sslmode=require",
    "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_sydney_prod",
    "SENTRY_DSN": "https://<key>@sentry-relay.ap-southeast-2.internal/1"
  }'
```

### 4.4 Step 4: Register ECS Task Definition

Create `task-definition.json` ensuring:

- `requiresCompatibilities: ["FARGATE"]`
- `cpu: "2048"`, `memory: "4096"`
- `networkMode: "awsvpc"`
- Non-root user: `nextjs`
- Secrets mapped from `caring-contacts/production` ARN.
- Environment variables:
  - `CARING_CONTACTS_REGION=ap-southeast-2`
  - `ZERO_DATA_EGRESS_AUSTRALIA=true`
  - `SENTRY_PII_SCRUBBING=true`
  - `NEXT_PUBLIC_CARING_CONTACTS_TRAINING_MODE=false`
  - `CARING_CONTACTS_DEMO_ENABLED=false` (or `true` for staging)

Register the task definition:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region ap-southeast-2
```

### 4.5 Step 5: Network Egress Lockdown

In your VPC configuration:

1. **Private Subnets:** ECS tasks run in private subnets with no public IPs.
2. **Security Group Egress:**
   - Allow Outbound TCP 443 (HTTPS) to Sydney Supabase IP range / AWS Endpoints.
   - Allow Outbound TCP 5432 (Postgres) to Sydney Supabase IP range.
   - **Deny all other outbound traffic.**
3. **AWS Network Firewall:** Stateful rule drops any outbound traffic to US IP ranges or unauthorized domains (including `api.openai.com`).

### 4.6 Step 6: Create or Update ECS Service

```bash
aws ecs update-service \
  --cluster caring-contacts-sydney \
  --service caring-contacts-service \
  --task-definition caring-contacts-app \
  --force-new-deployment \
  --region ap-southeast-2
```

---

## 5. Option B: Azure Container Apps Deployment (`australiaeast`)

### 5.1 Step 1: Create Azure Container Registry & Push

```bash
az acr create \
  --resource-group rg-caringcontacts-sydney \
  --name acrcaringcontactssyd \
  --sku Premium \
  --location australiaeast

az acr login --name acrcaringcontactssyd

docker tag caring-contacts-app-australia:latest acrcaringcontactssyd.azurecr.io/caring-contacts-app:latest
docker push acrcaringcontactssyd.azurecr.io/caring-contacts-app:latest
```

### 5.2 Step 2: Store Secrets in Azure Key Vault (`australiaeast`)

```bash
az keyvault secret set \
  --vault-name kv-caringcontacts-syd \
  --name CaringContactsDatabaseUrl \
  --value "postgresql://postgres:[PASSWORD]@db.<sydney-project-ref>.supabase.co:5432/postgres?sslmode=require"
```

### 5.3 Step 3: Deploy Azure Container App

Deploy inside a custom VNet with egress lockdown:

```bash
az containerapp create \
  --name ca-caringcontacts \
  --resource-group rg-caringcontacts-sydney \
  --environment cae-caringcontacts-sydney \
  --image acrcaringcontactssyd.azurecr.io/caring-contacts-app:latest \
  --target-port 3000 \
  --ingress external \
  --cpu 2.0 --memory 4.0Gi \
  --min-replicas 2 --max-replicas 10 \
  --env-vars \
    CARING_CONTACTS_REGION=ap-southeast-2 \
    ZERO_DATA_EGRESS_AUSTRALIA=true \
    SENTRY_PII_SCRUBBING=true \
    NEXT_PUBLIC_CARING_CONTACTS_TRAINING_MODE=false \
    CARING_CONTACTS_DEMO_ENABLED=false \
    CARING_CONTACTS_DATABASE_URL=keyvaultref:https://kv-caringcontacts-syd.vault.azure.net/secrets/CaringContactsDatabaseUrl
```

---

## 6. Post-Deployment Verification Checklist

Execute these checks immediately following deployment to confirm sovereign integrity:

1. **Readiness Probe:**

   ```bash
   curl -f https://<caring-contacts-domain>/api/health/ready
   ```

   Must return HTTP 200 within 500 ms.

2. **Database Separation Assertion:**
   Review container initialization logs in CloudWatch / Azure Log Analytics:
   - Confirm absence of `CaringContactsProjectSeparationError`.
   - Confirm active database mode is `postgres` (connected to Sydney host).

3. **Zero Data Egress Verification:**
   From an attached debugging task or container session:

   ```bash
   # Test outbound ping to foreign AI endpoints (MUST FAIL)
   nc -zvw3 api.openai.com 443
   ```

   Must report `Connection timed out` or `Network is unreachable`.

4. **Telemetry PII Scrubbing Verification:**
   - Trigger a handled warning event.
   - Inspect Sentry event dashboard:
     - Verify patient mobile numbers are scrubbed (`[REDACTED_PHONE]`).
     - Verify no request body containing recipient names or clinical notes is captured.

---

## 7. Incident Response & Emergency Procedures

1. **Suspected Cross-Border Leakage / Egress Breach:**
   - If an unauthorized egress attempt is logged, immediately isolate the container cluster:
     ```bash
     aws ecs update-service --cluster caring-contacts-sydney --service caring-contacts-service --desired-count 0 --region ap-southeast-2
     ```
   - Notify the Clinical Safety Officer (H-00) and Data Privacy Officer within 2 hours under the Mandatory Notifiable Data Breaches (NDB) scheme of the Privacy Act 1988.

2. **Service Emergency Stop:**
   - If a clinical incident or message misdelivery occurs, invoke the three-role service stop workflow defined in `src/lib/caring-contacts/service-state.ts` (Controls H-C21 and H-C22).
