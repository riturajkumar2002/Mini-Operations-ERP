# Complete Deployment Implementation Plan (No Docker)

This guide provides a step-by-step deployment blueprint for **Mini Operations ERP**:
- **Frontend**: **Vercel** (React 18 + Vite)
- **Backend**: **Render** (FastAPI Native Python Web Service — **Zero Docker**)
- **Database**: **Render Free PostgreSQL** or **Neon Serverless PostgreSQL**

---

## 1. High-Level Architecture

```mermaid
flowchart LR
    Browser["User Browser"] -->|HTTPS| Vercel["Frontend (Vercel)<br/>React 18 + Vite"]
    Vercel -->|REST API / HTTPS| Render["Backend (Render)<br/>FastAPI (Native Python)"]
    Render -->|SQL Connection Pooling| Postgres[("Managed PostgreSQL<br/>Render / Neon Database")]
```

---

## Phase 1: Deploy Database (Managed PostgreSQL)

Since cloud serverless platforms restart periodically, SQLite on local disk is not recommended for production. A free managed PostgreSQL database ensures all inventory and transactions persist permanently.

### Option A: Render Managed PostgreSQL (Recommended & Easiest)
1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** &rarr; Select **PostgreSQL**.
3. Fill in the details:
   - **Name**: `erp-database`
   - **Database**: `operations_erp`
   - **User**: `erp_user`
   - **Region**: Choose closest to you (e.g., *Singapore / Frankfurt / Oregon*)
   - **Plan**: **Free**
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (or **External Database URL**).
   *(Format: `postgres://erp_user:password@hostname/operations_erp`)*

---

## Phase 2: Deploy Backend on Render (No Docker)

Render supports native Python environments without any Dockerfile.

### Step 1: Create Web Service
1. In [Render Dashboard](https://dashboard.render.com/), click **New +** &rarr; Select **Web Service**.
2. Select **Build and deploy from a Git repository** &rarr; Connect your GitHub repository:
   `https://github.com/riturajkumar2002/Mini-Operations-ERP`
3. Configure the settings:
   - **Name**: `mini-operations-erp-backend`
   - **Region**: Choose the same region as your database.
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or root `.`)
   - **Runtime**: **Python 3**
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT
     ```
   - **Plan Type**: **Free**

### Step 2: Set Environment Variables
Scroll down to the **Environment Variables** section and add:
| Key | Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | *Paste your PostgreSQL URL from Phase 1* | Render automatically handles the connection. |
| `SECRET_KEY` | *Generate any random 32+ character string* | Used for JWT encryption. |
| `PROJECT_NAME` | `Mini Operations ERP` | Display title in API docs. |
| `PYTHON_VERSION` | `3.11.0` | Ensures clean package resolution. |

### Step 3: Deploy & Verify
1. Click **Create Web Service**.
2. Render will install packages from `backend/requirements.txt` and launch FastAPI.
3. On startup, the ERP will automatically:
   - Create all relational tables via SQLAlchemy.
   - Seed default locations (`WH-01`, `WH-02`, `PL-01`), catalog items, default inventory, and demo users (`admin@erp.com`, `ops@erp.com`, `sales@erp.com`).
4. Once live, Render will assign your backend a public URL:
   `https://mini-operations-erp-backend.onrender.com`
5. Test it in your browser:
   - Health Check: `https://mini-operations-erp-backend.onrender.com/api/v1/health` &rarr; returns `{"status":"healthy"}`
   - Interactive Docs: `https://mini-operations-erp-backend.onrender.com/docs`

---

## Phase 3: Deploy Frontend on Vercel

### Step 1: Import Project to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** &rarr; Select **Project**.
3. Choose your repository: `Mini-Operations-ERP`.

### Step 2: Configure Project Settings
In the configuration screen:
1. **Framework Preset**: Select **Vite**.
2. **Root Directory**: Click **Edit** &rarr; Select `frontend` &rarr; Click **Continue**.
3. **Build & Output Settings**:
   - Build Command: `npm run build` (default)
   - Output Directory: `dist` (default)
   - Install Command: `npm install` (default)

### Step 3: Set Environment Variables
In the **Environment Variables** section, add:
| Variable Name | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://mini-operations-erp-backend.onrender.com/api/v1` |

*(Replace with your actual backend Render URL from Phase 2, including `/api/v1` at the end).*

### Step 4: Deploy
1. Click **Deploy**.
2. Vercel will compile the frontend and deploy it onto its global Edge CDN in under 45 seconds.
3. Vercel will give you a public URL (e.g., `https://mini-operations-erp.vercel.app`).

---

## Phase 4: Verification & Live Smoke Test

Once both are deployed, run this quick 5-step smoke test on your live Vercel URL:

1. **Authentication**:
   - Open your Vercel URL in a browser.
   - Click the 1-Click **Admin** button &rarr; verify successful dashboard login.
2. **Theme Switch**:
   - Click the ☀️ / 🌙 button &rarr; verify light and dark mode toggle seamlessly.
3. **Inventory Ledger**:
   - Check stock levels across `WH-01`, `WH-02`, and `PL-01`.
   - Click `+ Stock Adjustment` and apply a `+10` replenishment &rarr; verify stock and audit trail update.
4. **Work Orders & Shortage Transfer**:
   - Navigate to **Work Orders** &rarr; observe automatic shortage check.
   - Click `Transfer Shortage` &rarr; verify it bridges to Internal Transfers with prefilled data.
5. **Customer Orders**:
   - Switch role to **Sales** &rarr; place an order with reservation &rarr; verify available stock decreases atomically.

---

## Continuous Deployment (CI/CD)

Whenever you make future code changes:
```bash
git add .
git commit -m "your update message"
git push origin main
```
- **Render** automatically detects backend changes and redeploys.
- **Vercel** automatically detects frontend changes and redeploys in seconds.
