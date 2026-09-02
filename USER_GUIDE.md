# Mini Operations ERP — Complete User & Operations Guide

Welcome to the **Mini Operations ERP**! This guide walks you through every feature, workflow, and developer command in the system.

---

## 1. Quick Access & Demo Credentials

### System URLs:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative ReDoc Docs**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **GitHub Repository**: [https://github.com/riturajkumar2002/Mini-Operations-ERP](https://github.com/riturajkumar2002/Mini-Operations-ERP)

### Pre-configured Users & Roles:
You can log in manually or use the **1-Click Demo Buttons** on the Login screen and top navigation bar:

| Persona | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@erp.com` | `admin123` | Full access: create work orders, adjust stock, manage transfers, view audit logs |
| **Operations** | `ops@erp.com` | `ops123` | Warehouse logistics: stock transfers (dispatch/receive), inventory adjustments, work order status |
| **Sales** | `sales@erp.com` | `sales123` | Commercial orders: create customer orders, reserve inventory, cancel orders & release stock |

---

## 2. Global UI Features

### A. Theme Switcher (Light & Dark Mode)
- Located on the top-right of the **Login Page** and in the **Navbar** (Sun ☀️ / Moon 🌙 button).
- **Light Theme**: Clean, high-contrast daytime enterprise interface with crisp white frosted cards and slate borders.
- **Dark Theme**: Ambient Obsidian canvas (`#070b14`) with electric cyan and indigo glows.
- Your theme selection is automatically saved in `localStorage` across browser refreshes.

### B. Quick Role Switcher
- In the top navigation bar, click on **ADMIN**, **OPERATIONS**, or **SALES** pills to instantly switch user identity without re-entering credentials.

---

## 3. Core Modules & Step-by-Step Workflows

### Module 1: Multi-Location Inventory Ledger
> **Path**: Navbar &rarr; `Inventory`

#### Features:
1. **Multi-Facility Stock Matrix**:
   - View stock across **Main Central Warehouse (`WH-01`)**, **Regional Distribution Hub (`WH-02`)**, and **North Assembly Plant (`PL-01`)**.
   - Displays **Physical Stock**, **Reserved Stock** (held for customer orders), and **Available Stock** (`Available = Physical - Reserved - Damaged`).
2. **Search & Filter**:
   - Filter by specific facility or item category (*Electronics, Hardware, Mechanical*).
   - Real-time search bar matching SKU, Item Name, or Batch Number.
3. **Stock Adjustment (Admin & Operations)**:
   - Click the **`+ Stock Adjustment`** button.
   - Select the item, location, batch number, and enter quantity delta (e.g., `+50` to replenish or `-10` to write off).
   - Enter a reason (e.g., *"Routine stock replenishment"* or *"Physical cycle count audit"*).
   - The system validates that negative adjustments never drop physical stock below reserved quantities.
4. **Audit Trail**:
   - Click **`Audit Trail`** to view an immutable ledger of every inventory movement (adjustments, reservations, transfers, cancellations) with timestamp and reference codes.

---

### Module 2: Production Work Orders & Shortage Detection
> **Path**: Navbar &rarr; `Work Orders`

#### Features:
1. **Automatic Shortage Calculation**:
   - When a Work Order is created at a facility (e.g., `PL-01`), the ERP automatically compares required quantity against available quantity at that facility:
     $$\text{Shortage} = \max(0, \text{Required} - \text{Available})$$
   - If stock is sufficient: Displays a green **"Sufficient Material Available"** banner.
   - If stock is insufficient: Displays a prominent red **"Material Shortage Detected (-X units)"** panel.
2. **Surplus Facility Detection**:
   - The system automatically scans other warehouses (e.g., `WH-02`) that have surplus stock of the missing item.
3. **1-Click Shortage Transfer Bridge**:
   - In the shortage banner, click **`Transfer Shortage (X)`**.
   - The ERP automatically routes you to the **Internal Transfers** screen with the Source Facility, Destination Facility, Item, and exact shortage quantity **pre-filled**!
4. **Work Order Status Lifecycle**:
   - Track progress from `ASSIGNED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`.

---

### Module 3: Internal Stock Transfer Pipeline
> **Path**: Navbar &rarr; `Internal Transfers`

#### 3-State Logistics Pipeline:
$$\text{REQUESTED} \xrightarrow{\text{Dispatch}} \text{DISPATCHED (In Transit)} \xrightarrow{\text{Receive}} \text{RECEIVED}$$

#### How to Initiate a Transfer:
1. Click **`New Stock Transfer`**.
2. Select **Source Facility** (where goods currently are) and **Destination Facility** (where goods are going).
3. Select the **Item to Transfer**.
4. **Smart Batch Selector**: The dropdown automatically displays batches that actually exist at that source facility (with available count).
5. Enter the **Quantity** (live preview confirms available units).
6. Click **`Request Transfer`** &rarr; status becomes `REQUESTED`.

#### Moving Stock Through the Pipeline:
- **Dispatch**: Click **`Dispatch`** &rarr; Source physical inventory is deducted immediately, and goods enter in-transit isolation (`DISPATCHED`).
- **Receive**: Click **`Receive`** &rarr; Destination inventory is credited immediately, and status updates to `RECEIVED`.
- **Idempotency Protection**: The button disappears once received. Any duplicate receive attempt is rejected with `HTTP 400 Bad Request`.

---

### Module 4: Customer Orders & Atomic Stock Reservation
> **Path**: Navbar &rarr; `Customer Orders`

#### Features:
1. **Preventing Inventory Overbooking**:
   - When placing a customer order, available stock is verified:
     $$\text{Available} = \text{Physical} - \text{Reserved} - \text{Damaged}$$
   - If a customer requests 60 units and only 50 are available, the order is safely rejected.
2. **Placing an Order**:
   - Click **`New Order & Reserve Stock`**.
   - Enter Customer Name, Facility, Item, Batch, and Order Quantity.
   - The live indicator checks current batch availability in real-time.
   - Click **`Place Order & Reserve`**.
   - Physical stock remains intact, but **Reserved Stock increases**, instantly reducing Available Stock for other orders.
3. **Order Cancellation & Automatic Stock Release**:
   - Click **`Cancel & Release`** on any active order.
   - The order status switches to `CANCELLED`, and the reserved quantity is instantly returned to available inventory.

---

## 4. Developer Commands & Verification

### How to Run the App Locally:

```powershell
# 1. Start Backend API (FastAPI + Uvicorn)
.\venv\Scripts\uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000

# 2. Start Frontend (React + Vite)
cd frontend
npm run dev
```

### How to Run the Automated Test Suites:

```powershell
# Run the 5 Mandatory Unit Tests + Concurrency Race Test
.\venv\Scripts\pytest backend/tests/test_mandatory_suite.py -v

# Run the Full End-to-End PDF Specification Verification (19 automated assertions)
.\venv\Scripts\python backend/tests/verify_pdf_scenarios.py
```

### Verifying Git History:
```powershell
git log --oneline
```
Shows all 14 sequential, modular milestones pushed to GitHub.
