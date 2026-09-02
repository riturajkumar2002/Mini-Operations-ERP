# Mini Operations ERP

> A production-oriented, full-stack Operations ERP covering multi-location inventory, work orders with automatic material shortage detection, internal stock transfers with atomic state transitions, and concurrency-safe customer order reservations.

---

## 📑 Table of Contents
- [1. Business Scenario & Flow](#1-business-scenario--flow)
- [2. Tech Stack](#2-tech-stack)
- [3. Architecture & Concurrency Design](#3-architecture--concurrency-design)
- [4. Database Schema & ER Diagram](#4-database-schema--er-diagram)
- [5. Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
- [6. Project Setup & Installation](#6-project-setup--installation)
- [7. Environment Variables](#7-environment-variables)
- [8. Running the Application](#8-running-the-application)
- [9. Automated Testing](#9-automated-testing)
- [10. API Documentation (Swagger & ReDoc)](#10-api-documentation-swagger--redoc)
- [11. End-to-End Demo Walkthrough](#11-end-to-end-demo-walkthrough)
- [12. Live Verification Preparedness](#12-live-verification-preparedness)

---

## 1. Business Scenario & Flow

```mermaid
flowchart LR
    Inv["📦 1. Inventory<br/>(Physical, Reserved, Available)"] --> WO["📋 2. Work Order<br/>(Material Requirement)"]
    WO --> SC{"🔍 3. Stock Check<br/>Shortage?"}
    SC -->|Shortage > 0| TR["🔄 4. Internal Transfer<br/>(Request → Dispatch → Receive)"]
    SC -->|Sufficient Stock| CR["🛒 5. Customer Order<br/>(Safe Stock Reservation)"]
    TR -->|Receipt Increases Stock| CR
```

The system orchestrates multi-warehouse operations:
1. **Inventory Management**: Tracks Physical, Reserved, and Available quantities with batch numbers across multiple locations.
2. **Work Orders**: Admins create production work orders. The system automatically computes material shortages (`Shortage = Max(0, Required - Available)`) and detects surplus stock at other locations.
3. **Internal Stock Transfers**: Supports inter-facility transfers with strict idempotency:
   - **On Dispatch**: Source physical quantity reduces immediately; destination stock does NOT change.
   - **On Receipt**: Destination physical quantity increases. The system strictly prevents duplicate receipt of the same transfer.
4. **Customer Orders & Stock Reservation**: Sales Users reserve stock atomically. Even under concurrent requests (`User A = 80, User B = 50, Stock = 100`), race condition protection guarantees that over-reservation is strictly rejected at the database level.

---

## 2. Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** (Python 3.13) | Asynchronous, high-performance REST API with automatic OpenAPI / Swagger documentation |
| **Database ORM** | **SQLAlchemy 2.0** | Explicit session management, row-level locking (`with_for_update`), conditional atomic queries |
| **Relational Database** | **SQLite (WAL mode)** / **PostgreSQL** | Portable, zero-daemon SQLite by default with complete PostgreSQL compatibility via `DATABASE_URL` |
| **Authentication** | **JWT (OAuth2) + Bcrypt** | Secure password hashing, HS256 signed tokens, role-based backend authorization dependencies |
| **Frontend Framework**| **React 18 + Vite** | Lightning-fast build tool, component-driven UI |
| **Styling & UI** | **Tailwind CSS + Lucide React** | Dual Theme Support (Light & Ambient Obsidian Dark mode) with instant 1-click toggle, responsive layouts, intuitive status indicators |
| **Testing** | **Pytest + HTTPX** | In-memory thread-safe SQLite test harness verifying all mandatory business rules |

---

## 3. Architecture & Concurrency Design

### Preventing Over-Reservation Under Concurrency
When two users concurrently attempt to reserve more stock than is available (e.g. Stock = 100, User A requests 80, User B requests 50):
1. Both requests enter atomic database transactions.
2. Rows are locked using `with_for_update()`.
3. An atomic SQL conditional update executes:
   ```sql
   UPDATE inventory
   SET reserved_quantity = reserved_quantity + :qty
   WHERE id = :inv_id 
     AND (physical_quantity - reserved_quantity - damaged_quantity) >= :qty;
   ```
4. If `rowcount == 0`, the transaction rolls back immediately and raises `HTTP 400: Cannot reserve more than available inventory`.
5. This guarantees that only one request succeeds while the second safely fails without race conditions or dirty reads.

### Transfer Idempotency & State Machine
Transfers strictly follow the state lifecycle: `REQUESTED` &rarr; `DISPATCHED` &rarr; `RECEIVED`.
- Calling `/receive` checks that the transfer is in `DISPATCHED` status.
- If already `RECEIVED`, the endpoint rejects the call with `HTTP 400: The same transfer cannot be received twice`.
- Source stock decreases on dispatch; destination stock increases only on receipt.

---

## 4. Database Schema & ER Diagram

```mermaid
erDiagram
    USERS ||--o{ WORK_ORDERS : "assigned_to"
    USERS ||--o{ INTERNAL_TRANSFERS : "created_by"
    USERS ||--o{ CUSTOMER_ORDERS : "created_by"
    LOCATIONS ||--o{ INVENTORY : "stores"
    LOCATIONS ||--o{ WORK_ORDERS : "fulfilled_at"
    LOCATIONS ||--o{ INTERNAL_TRANSFERS : "source / destination"
    ITEMS ||--o{ INVENTORY : "cataloged_in"
    ITEMS ||--o{ WORK_ORDERS : "demanded_by"
    ITEMS ||--o{ INTERNAL_TRANSFERS : "transferred_in"
    ITEMS ||--o{ CUSTOMER_ORDERS : "ordered_in"
    INVENTORY ||--o{ INVENTORY_TRANSACTIONS : "audited_by"

    USERS {
        int id PK
        string email UK
        string hashed_password
        string full_name
        string role "ADMIN | OPERATIONS | SALES"
        int assigned_location_id FK
        boolean is_active
    }

    LOCATIONS {
        int id PK
        string code UK
        string name
        string address
    }

    ITEMS {
        int id PK
        string sku UK
        string name
        string category
        string unit
    }

    INVENTORY {
        int id PK
        int item_id FK
        int location_id FK
        string batch_number
        int physical_quantity
        int reserved_quantity
        int damaged_quantity
        int available_quantity "CALCULATED: physical - reserved - damaged"
    }

    WORK_ORDERS {
        int id PK
        string work_order_code UK
        int location_id FK
        int item_id FK
        int required_quantity
        int assigned_user_id FK
        string status "ASSIGNED | IN_PROGRESS | COMPLETED"
    }

    INTERNAL_TRANSFERS {
        int id PK
        string transfer_code UK
        int source_location_id FK
        int destination_location_id FK
        int item_id FK
        string batch_number
        int quantity
        string status "REQUESTED | DISPATCHED | RECEIVED"
    }

    CUSTOMER_ORDERS {
        int id PK
        string order_code UK
        string customer_name
        int location_id FK
        int item_id FK
        string batch_number
        int quantity
        string status "RESERVED | FULFILLED | CANCELLED"
    }

    INVENTORY_TRANSACTIONS {
        int id PK
        string transaction_type
        string reference_code
        int item_id FK
        int location_id FK
        int physical_delta
        int reserved_delta
        datetime created_at
    }
```

---

## 5. Role-Based Access Control (RBAC)

The system provides 3 pre-configured user personas out-of-the-box:

| Persona | Credentials | Allowed Operations |
| :--- | :--- | :--- |
| 👑 **Admin** | `admin@erp.com` / `admin123` | Full system access; create work orders, view stock shortages, initiate transfers, manage inventory, customer orders. |
| 🔧 **Operations User** | `ops@erp.com` / `ops123` | Manage inventory adjustments, initiate internal transfers, dispatch transfers, receive transfers, update work order status. Restricted from creating customer orders. |
| 💼 **Sales User** | `sales@erp.com` / `sales123` | View inventory, create customer orders & reserve stock, cancel orders. Restricted from creating work orders and dispatching/receiving transfers. |

---

## 6. Project Setup & Installation

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** (Tested on Node.js 24)
- **Git**

### 1. Clone & Set Up Backend
```bash
# From repository root:
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# Install Python dependencies:
pip install -r backend/requirements.txt

# Populate database with seed data:
cd backend
python -m app.seed
cd ..
```

### 2. Set Up Frontend
```bash
cd frontend
npm install
cd ..
```

---

## 7. Environment Variables

Create or review `backend/.env`:
```env
PROJECT_NAME="Mini Operations ERP"
SECRET_KEY="production-secret-key-change-in-real-prod-min-32-chars"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=480

# SQLite by default for zero-configuration portability:
DATABASE_URL="sqlite:///./operations_erp.db"

# Or configure PostgreSQL seamlessly:
# DATABASE_URL="postgresql://user:password@localhost:5432/operations_erp"
```

---

## 8. Running the Application

### Start the Backend Server (Port 8000)
```bash
# In first terminal:
.\venv\Scripts\uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
The backend API will be live at `http://127.0.0.1:8000`.

### Start the Frontend Dev Server (Port 5173)
```bash
# In second terminal:
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 9. Automated Testing

All 5 mandatory test cases specified in the case study are implemented in [`backend/tests/test_mandatory_suite.py`](backend/tests/test_mandatory_suite.py):

| Test Case | Description | Verification Logic | Status |
| :--- | :--- | :--- | :--- |
| **Test 1** | Cannot reserve more than available inventory | Asserts `HTTP 400` when reservation request exceeds available inventory. | ✅ PASSED |
| **Test 2** | Cannot transfer more than available inventory | Asserts `HTTP 400` when transfer quantity exceeds source available stock. | ✅ PASSED |
| **Test 3** | Destination stock increases only after transfer receipt | Verifies that on dispatch source decreases, destination remains unchanged, and destination increases only upon receipt. | ✅ PASSED |
| **Test 4** | Same transfer cannot be received twice | Asserts `HTTP 400` on subsequent receipt attempts and verifies destination stock does not double-increment. | ✅ PASSED |
| **Test 5** | Unauthorized user cannot perform restricted operation | Verifies that Sales users cannot create work orders or dispatch transfers (`HTTP 403`), and unauthenticated requests return `HTTP 401`. | ✅ PASSED |
| **Concurrency Test** | Race condition reservation prevention | Simulates concurrent reservations (`A = 80, B = 50, Stock = 100`), ensuring only one succeeds. | ✅ PASSED |

### Running the Test Suite:
```bash
cd backend
..\venv\Scripts\pytest -v -W ignore::DeprecationWarning
```

Expected Output:
```text
tests/test_mandatory_suite.py::test_cannot_reserve_more_than_available_inventory PASSED [ 16%]
tests/test_mandatory_suite.py::test_cannot_transfer_more_than_available_inventory PASSED [ 33%]
tests/test_mandatory_suite.py::test_destination_stock_increases_only_after_transfer_receipt PASSED [ 50%]
tests/test_mandatory_suite.py::test_same_transfer_cannot_be_received_twice PASSED [ 66%]
tests/test_mandatory_suite.py::test_unauthorized_user_cannot_perform_restricted_operation PASSED [ 83%]
tests/test_mandatory_suite.py::test_concurrency_race_condition_protection PASSED [100%]
======================== 6 passed in 7.21s =========================
```

---

## 10. API Documentation (Swagger & ReDoc)

Interactive API documentation is automatically generated by FastAPI:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI JSON**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

Using Swagger UI:
1. Click the green **Authorize** button at the top right.
2. Enter `admin@erp.com` and `admin123` to test authorized endpoints directly.

---

## 11. End-to-End Demo Walkthrough

The seeded database contains the exact scenario described in the case study:

1. **Step 1: Sign In**
   - Navigate to `http://localhost:5173`.
   - Click the **"Log in as Admin"** button for 1-click instant demo access.
2. **Step 2: Inspect Inventory**
   - Click the **Inventory** tab.
   - Note `ARM Cortex-M4 Microcontroller` at **Main Central Warehouse (WH-01)**:
     - Physical: `60`, Reserved: `0`, Available: `60`.
   - At **Regional Distribution Hub (WH-02)**:
     - Physical: `150`, Reserved: `0`, Available: `150`.
3. **Step 3: Work Order & Automatic Stock Shortage Detection**
   - Click **Work Orders**.
   - Notice or create a work order at `WH-01` requiring `100` units of `ARM Cortex-M4 Microcontroller`.
   - The system automatically flags:
     - **Required:** 100
     - **Available at WH-01:** 60
     - **Shortage:** 40
     - **Surplus Available:** WH-02 Regional Distribution Hub (150 units).
   - Click the **"Transfer Shortage (40)"** button!
4. **Step 4: Internal Stock Transfer**
   - The transfer modal opens pre-filled (Source: `WH-02`, Destination: `WH-01`, Qty: `40`).
   - Click **Request Transfer**.
   - In the transfers list, click **Dispatch**:
     - Check Inventory: WH-02 stock reduces by 40 (from 150 to 110). WH-01 stock has **NOT** increased yet.
   - Click **Receive**:
     - Check Inventory: WH-01 stock increases by 40 (from 60 to 100).
     - Try clicking Receive again: The button is disabled and backend blocks duplicate receipt.
5. **Step 5: Customer Order & Concurrency-Safe Stock Reservation**
   - Switch to **Sales User** using the top navigation switcher.
   - Click **Customer Orders** &rarr; **New Order & Reserve Stock**.
   - Select Item `High Tensile Steel Rods` (Available: 100) and order 60 units.
   - Confirm reservation:
     - Physical remains `100`.
     - Reserved becomes `60`.
     - Available becomes `40`.
   - Try creating another order for 50 units: The system rejects the request (`Available 40 < Requested 50`).

---

## 12. Live Verification Preparedness

The codebase is pre-architected to accommodate any unannounced live interview verification changes:

| Verification Scenario | Implementation Readiness |
| :--- | :--- |
| **Change 1: Damaged Stock** | `damaged_quantity` is already present on the `Inventory` model and deducted in the `available_quantity` calculation: `physical - reserved - damaged`. |
| **Change 2: Partial Transfer Receipt** | The `receive_transfer` endpoint can accept an optional `received_quantity` payload to split remaining balance. |
| **Change 3: Order Cancellation** | Implemented at `POST /api/v1/orders/{order_id}/cancel`. Reverts `reserved_quantity` and creates an audit release transaction. |
| **Change 4: Location Restriction** | `User.assigned_location_id` is already mapped in the database schema. An authorization dependency can restrict queries to `Inventory.location_id == current_user.assigned_location_id`. |
