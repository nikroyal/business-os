# BusinessOS

BusinessOS is an AI-powered personal finance, business, and investing operating system built on Cloudflare Pages, Cloudflare Workers, Firebase, and Gemini.

This repository is organized as an npm monorepo workspace containing the frontend client application and the serverless backend Cloudflare Worker.

---

## Repository Structure

```
business-os/
├── apps/
│   ├── web/                        # Frontend UI (Vite + React + TS)
│   │   ├── src/
│   │   │   ├── components/         # Shared layouts, Sidebar, protected page guards
│   │   │   ├── context/            # AuthContext managing user sessions
│   │   │   ├── pages/              # Login/Register, Dashboard, Settings
│   │   │   ├── services/           # Firebase Auth / Firestore database connector
│   │   │   └── index.css           # Premium dark-mode glassmorphic styling system
│   │   └── package.json
│   └── backend/                    # Backend Edge endpoints (Cloudflare Workers + Hono)
│       ├── src/
│       │   └── index.ts            # Hono application router with health check & cors
│       ├── wrangler.jsonc          # Cloudflare Worker configuration
│       └── package.json
├── docs/                           # Project architecture, blueprints and vision
├── package.json                    # Workspace root configurations
└── README.md
```

---

## Phase 1 Implementation Details

The Phase 1 release implements the application core:
*   **Monorepo setup:** Npm workspaces managing `apps/web` and `apps/backend`.
*   **Vite + React + TS frontend:** Fast build tooling with TypeScript support.
*   **Cloudflare Worker backend scaffold:** Hono routing framework deployed on the edge.
*   **Authentication & Firestore adapter:** Integrates Firebase Auth and Firestore with a smart mock fallback system. If Firebase config variables are absent, the application launches in a fully functional local **Demo Mode**, utilizing `localStorage` to save settings, profiles, and sessions.
*   **Protected Routing:** Automatically guards dashboard paths, routing unauthenticated visitors back to login.
*   **Dashboard view:** Displays active sessions and user status metrics.
*   **Settings page:** Custom panels allowing users to adjust:
    *   Risk profile (`Conservative`, `Moderate`, `Aggressive`).
    *   Investment interests (multiple category selections).
    *   Timezone.
    *   Briefing preferences (daily, weekly, urgent alerts).

---

## Local Development Instructions

### Prerequisites
*   Node.js (v18 or higher recommended)
*   npm (v9 or higher)

### Setup & Installation

1.  **Clone the Repository** and navigate to the project directory:
    ```bash
    git clone <repository-url>
    cd business-os
    ```

2.  **Install dependencies** at the workspace root:
    ```bash
    npm install
    ```

3.  *(Optional)* **Configure Firebase Credentials**
    To connect to a live Firebase instance instead of using the local Demo Mode, create a `.env` file inside `apps/web/`:
    ```bash
    # apps/web/.env
    VITE_FIREBASE_API_KEY="your-api-key"
    VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
    VITE_FIREBASE_PROJECT_ID="your-project-id"
    VITE_FIREBASE_APP_ID="your-app-id"
    ```

### Running Locally

You can launch both frontend and backend concurrently or run them individually:

*   **Run Frontend Dashboard:**
    ```bash
    npm run dev:web
    ```
    The application will run locally at [http://localhost:5173](http://localhost:5173).

*   **Run Backend Worker API:**
    ```bash
    npm run dev:backend
    ```
    The Wrangler development server will spin up on [http://localhost:8787](http://localhost:8787).

*   **Build Applications:**
    ```bash
    npm run build:web
    npm run build:backend
    ```