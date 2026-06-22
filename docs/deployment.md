# BusinessOS Deployment & Configuration Guide

This guide details the steps required to deploy the **BusinessOS** monorepo to the Cloudflare platform: **Cloudflare Pages** for the React frontend client and **Cloudflare Workers** for the Hono backend API.

---

## 1. Environment Variables Configuration

To run successfully in production, configure the following environment variables.

### A. Frontend Client (`apps/web`)
These variables must be configured in your Cloudflare Pages dashboard. In a local environment, they are loaded from `apps/web/.env`.

| Variable Key | Purpose | Example Value |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase API Connection Key | `"AIzaSyA..."` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | `"business-os.firebaseapp.com"` |
| `VITE_FIREBASE_PROJECT_ID` | Firestore Project ID reference | `"business-os"` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | `"1:12345:web:abcd"` |
| `VITE_API_URL` | Endpoint of the deployed Hono Worker API | `"https://backend.business-os.workers.dev"` |

### B. Backend API Worker (`apps/backend`)
These variables are set in wrangler or defined in the Cloudflare Workers dashboard.
*   **Plain text variables** are configured in the `[vars]` block of `wrangler.jsonc` (or wrangler dashboard).
*   **Secrets** are set via `wrangler secret put <KEY>` or in the Cloudflare Workers settings dashboard.

| Key | Type | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | Plain Variable | Runtime context | `"production"` |
| `FIREBASE_PROJECT_ID` | Plain Variable | Firestore target project | `"business-os"` |
| `GEMINI_API_KEY` | Secret | Access key for Google Gemini LLM | *(Secret)* |
| `FINNHUB_API_KEY` | Secret | Quote and market data API access | *(Secret)* |
| `RESEND_API_KEY` | Secret | Email delivery service API key | *(Secret)* |
| `CRON_SECRET` | Secret | Authorization token to run cron endpoints via HTTPS | *(Secret)* |

---

## 2. Cloudflare Pages Deployment (Frontend)

Cloudflare Pages connects directly to your GitHub repository and triggers automatic builds on pushes to the default branch.

### Step-by-Step Settings Configuration

1.  **Log in** to your Cloudflare Dashboard and select **Workers & Pages**.
2.  Click **Create Application** -> **Pages** tab -> **Connect to Git**.
3.  Authorize Cloudflare to access your GitHub account, select the `business-os` repository, and click **Begin Setup**.
4.  Configure the **Build settings** exactly as follows:
    *   **Framework preset:** `None` (do *not* select Vite; we are running a workspace workspace build)
    *   **Build command:** `npm run build:web`
    *   **Build output directory:** `apps/web/dist`
    *   **Root directory:** `/` (leave as the default root of the repository)
5.  Expand the **Environment variables (advanced)** section and add the frontend variables:
    *   `VITE_FIREBASE_API_KEY`
    *   `VITE_FIREBASE_AUTH_DOMAIN`
    *   `VITE_FIREBASE_PROJECT_ID`
    *   `VITE_FIREBASE_APP_ID`
    *   `VITE_API_URL` (Make sure to update this with your deployed Workers URL after deploying the backend)
6.  Add `NODE_VERSION` with value `20` to guarantee the build environment uses the latest stable runtime.
7.  Click **Save and Deploy**. Cloudflare will download the monorepo workspace dependencies, run the compiler, and deploy your frontend.

---

## 3. Cloudflare Workers Deployment (Backend)

The Hono Worker backend is deployed using Cloudflare Wrangler from your local terminal or via a GitHub Action.

### Option A: Local Terminal Deployment

1.  Navigate to your workspace root directory:
    ```bash
    cd business-os
    ```
2.  Authenticate wrangler with your Cloudflare account:
    ```bash
    npx wrangler login
    ```
3.  Deploy the backend Worker application:
    ```bash
    npm run deploy:backend
    ```
    This command compiles your TypeScript files and deploys them to the Cloudflare network. Note the generated domain (e.g. `https://backend.your-username.workers.dev`).
4.  Configure backend secrets:
    Run the following commands to add production tokens:
    ```bash
    npx wrangler secret put GEMINI_API_KEY --package backend
    npx wrangler secret put FINNHUB_API_KEY --package backend
    npx wrangler secret put RESEND_API_KEY --package backend
    npx wrangler secret put CRON_SECRET --package backend
    ```

### Option B: CI/CD Deployment via GitHub Actions
Add a GitHub Action workflow file `.github/workflows/deploy.yml` to automate deployments:
```yaml
name: Deploy Worker API
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm install
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy --package backend
```

---

## 4. Verification Check

To confirm compatibility before running a live deploy:
1.  Verify the frontend builds successfully for Cloudflare Pages locally:
    ```bash
    npm run build:web
    ```
    Confirm that `apps/web/dist/index.html` is generated successfully.
2.  Check the Hono routing compilation:
    Make sure `apps/backend/src/index.ts` is fully typed and `npx wrangler types` doesn't report workspace binding errors.
