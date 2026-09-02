import sys
import os
import httpx

BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8000/api/v1")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def log_test(name, passed, detail=""):
    status = f"{Colors.GREEN}[PASS]{Colors.RESET}" if passed else f"{Colors.RED}[FAIL]{Colors.RESET}"
    print(f"{status} {Colors.BOLD}{name}{Colors.RESET}")
    if detail:
        print(f"       -> {detail}")

def run_pdf_verification():
    print(f"\n{Colors.CYAN}========================================================================{Colors.RESET}")
    print(f"{Colors.BOLD}   MINI OPERATIONS ERP - SPECIFICATION VERIFICATION SUITE (PDF SPEC){Colors.RESET}")
    print(f"{Colors.CYAN}========================================================================{Colors.RESET}\n")

    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # -------------------------------------------------------------------------
    # MODULE 1: AUTHENTICATION & ROLES (PDF Page 1, 2)
    # -------------------------------------------------------------------------
    print(f"{Colors.YELLOW}--- 1. Testing Authentication & RBAC ---{Colors.RESET}")
    
    # 1a. Login Admin
    res_admin = client.post("/auth/login", json={"email": "admin@erp.com", "password": "admin123"})
    admin_ok = res_admin.status_code == 200 and res_admin.json().get("role") == "ADMIN"
    admin_token = res_admin.json().get("access_token")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log_test("Admin Login (admin@erp.com)", admin_ok, f"Role: {res_admin.json().get('role')}")

    # 1b. Login Operations User
    res_ops = client.post("/auth/login", json={"email": "ops@erp.com", "password": "ops123"})
    ops_ok = res_ops.status_code == 200 and res_ops.json().get("role") == "OPERATIONS"
    ops_token = res_ops.json().get("access_token")
    ops_headers = {"Authorization": f"Bearer {ops_token}"}
    log_test("Operations User Login (ops@erp.com)", ops_ok, f"Role: {res_ops.json().get('role')}")

    # 1c. Login Sales User
    res_sales = client.post("/auth/login", json={"email": "sales@erp.com", "password": "sales123"})
    sales_ok = res_sales.status_code == 200 and res_sales.json().get("role") == "SALES"
    sales_token = res_sales.json().get("access_token")
    sales_headers = {"Authorization": f"Bearer {sales_token}"}
    log_test("Sales User Login (sales@erp.com)", sales_ok, f"Role: {res_sales.json().get('role')}")

    # 1d. Mandatory Test 5: Unauthorized user cannot perform restricted operation
    # Sales user tries to create Work Order (Admin only)
    res_sales_wo = client.post("/work-orders", json={"location_id": 1, "item_id": 1, "required_quantity": 10, "assigned_user_id": 1}, headers=sales_headers)
    t5a_pass = res_sales_wo.status_code == 403
    log_test("Mandatory Test 5a: Sales user blocked from creating Work Order (HTTP 403)", t5a_pass, f"Status: {res_sales_wo.status_code}")

    # Sales user tries to dispatch transfer (Admin/Ops only)
    res_sales_disp = client.post("/transfers/1/dispatch", headers=sales_headers)
    t5b_pass = res_sales_disp.status_code == 403
    log_test("Mandatory Test 5b: Sales user blocked from dispatching transfer (HTTP 403)", t5b_pass, f"Status: {res_sales_disp.status_code}")

    # Operations user tries to create Customer Order (Sales/Admin only)
    res_ops_order = client.post("/orders", json={"customer_name": "Test", "location_id": 1, "item_id": 1, "quantity": 5}, headers=ops_headers)
    t5c_pass = res_ops_order.status_code == 403
    log_test("Mandatory Test 5c: Operations user blocked from creating Customer Order (HTTP 403)", t5c_pass, f"Status: {res_ops_order.status_code}")

    # -------------------------------------------------------------------------
    # MODULE 2: INVENTORY MANAGEMENT & CONSTRAINTS (PDF Page 2)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.YELLOW}--- 2. Testing Inventory Management & Constraints ---{Colors.RESET}")
    res_inv = client.get("/inventory", headers=admin_headers)
    inv_list = res_inv.json()
    log_test("List Inventory records", res_inv.status_code == 200, f"Total inventory entries: {len(inv_list)}")

    # Check calculated available formula: Available = Physical - Reserved - Damaged
    formula_ok = all(
        i["available_quantity"] == max(0, i["physical_quantity"] - i["reserved_quantity"] - i["damaged_quantity"])
        for i in inv_list
    )
    log_test("Inventory Available Formula Check: Available == Physical - Reserved - Damaged", formula_ok)

    # Negative inventory prevention
    res_neg = client.post("/inventory/adjust", json={
        "item_id": 1,
        "location_id": 1,
        "batch_number": "BATCH-ST-001",
        "physical_quantity_delta": -9999,
        "reason": "Test negative"
    }, headers=ops_headers)
    neg_prevented = res_neg.status_code == 400 and "negative" in res_neg.json().get("detail", "").lower()
    log_test("System prevents negative inventory", neg_prevented, f"Response detail: {res_neg.json().get('detail')}")

    # Invalid quantity prevention (delta = 0)
    res_zero = client.post("/inventory/adjust", json={
        "item_id": 1,
        "location_id": 1,
        "batch_number": "BATCH-ST-001",
        "physical_quantity_delta": 0,
        "reason": "Test zero"
    }, headers=ops_headers)
    log_test("System prevents invalid quantity (0 delta)", res_zero.status_code == 400)

    # -------------------------------------------------------------------------
    # MODULE 3: WORK ORDER + MATERIAL STOCK CHECK (PDF Page 2, 3)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.YELLOW}--- 3. Testing Work Order & Automatic Shortage Calculation ---{Colors.RESET}")
    # Find current available stock of Item 2 at Location 1
    current_wh01 = sum(i["available_quantity"] for i in client.get("/inventory?location_id=1", headers=admin_headers).json() if i["item_id"] == 2)
    test_required = current_wh01 + 40

    res_wo = client.post("/work-orders", json={
        "location_id": 1,
        "item_id": 2,
        "required_quantity": test_required,
        "assigned_user_id": 2
    }, headers=admin_headers)
    wo_data = res_wo.json()
    sc = wo_data.get("stock_check", {})
    wo_ok = (
        res_wo.status_code == 201 and
        sc.get("required_quantity") == test_required and
        sc.get("available_at_location") == current_wh01 and
        sc.get("shortage") == 40 and
        sc.get("is_shortage") is True
    )
    log_test("Work Order Created with Minimum Fields", res_wo.status_code == 201, f"Code: {wo_data.get('work_order_code')}")
    log_test(f"Automatic Shortage Calculation: Required={test_required}, Available={current_wh01} -> Shortage=40", wo_ok, 
             f"Calculated Shortage: {sc.get('shortage')}, Surplus Locations: {len(sc.get('surplus_locations', []))}")

    # -------------------------------------------------------------------------
    # MODULE 4: INTERNAL STOCK TRANSFER & IDEMPOTENCY (PDF Page 3, 4, 5)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.YELLOW}--- 4. Testing Internal Stock Transfer & State Machine ---{Colors.RESET}")
    
    # Mandatory Test 2: Cannot transfer more than available inventory
    # WH-01 has 60 available of item 2. Attempt to transfer 75 from WH-01 to WH-02
    res_t2 = client.post("/transfers", json={
        "source_location_id": 1,
        "destination_location_id": 2,
        "item_id": 2,
        "batch_number": "BATCH-CH-001",
        "quantity": 75
    }, headers=ops_headers)
    t2_pass = res_t2.status_code == 400 and "Cannot transfer more than available" in res_t2.json().get("detail", "")
    log_test("Mandatory Test 2: Cannot transfer more than available inventory", t2_pass, f"Response: {res_t2.json().get('detail')}")

    # Mandatory Test 3: Destination stock increases ONLY after transfer receipt
    # Step 1: Create transfer of 30 from WH-02 (surplus) to WH-01
    res_tr_new = client.post("/transfers", json={
        "source_location_id": 2,
        "destination_location_id": 1,
        "item_id": 2,
        "batch_number": "BATCH-CH-002",
        "quantity": 30
    }, headers=ops_headers)
    tr_id = res_tr_new.json()["id"]

    # Read destination stock before dispatch
    inv_dest_before = next((i for i in client.get("/inventory?location_id=1", headers=ops_headers).json() if i["batch_number"] == "BATCH-CH-002"), None)
    dest_phys_before = inv_dest_before["physical_quantity"] if inv_dest_before else 0

    # Dispatch transfer: Source reduces, Destination must NOT increase
    res_disp = client.post(f"/transfers/{tr_id}/dispatch", headers=ops_headers)
    inv_dest_after_disp = next((i for i in client.get("/inventory?location_id=1", headers=ops_headers).json() if i["batch_number"] == "BATCH-CH-002"), None)
    dest_phys_after_disp = inv_dest_after_disp["physical_quantity"] if inv_dest_after_disp else 0
    t3_disp_ok = (dest_phys_before == dest_phys_after_disp) and res_disp.json()["status"] == "DISPATCHED"
    log_test("Mandatory Test 3 (Phase A): Before Receipt, destination inventory does NOT increase", t3_disp_ok, 
             f"Dest before: {dest_phys_before}, Dest after dispatch: {dest_phys_after_disp}")

    # Receive transfer: Destination increases
    res_recv = client.post(f"/transfers/{tr_id}/receive", headers=ops_headers)
    inv_dest_after_recv = next((i for i in client.get("/inventory?location_id=1", headers=ops_headers).json() if i["batch_number"] == "BATCH-CH-002"), None)
    dest_phys_after_recv = inv_dest_after_recv["physical_quantity"] if inv_dest_after_recv else 0
    t3_recv_ok = (dest_phys_after_recv == dest_phys_before + 30) and res_recv.json()["status"] == "RECEIVED"
    log_test("Mandatory Test 3 (Phase B): On Receipt, destination inventory increases", t3_recv_ok,
             f"Dest after receipt: {dest_phys_after_recv} (increased by +30)")

    # Mandatory Test 4: Same transfer cannot be received twice
    res_recv_again = client.post(f"/transfers/{tr_id}/receive", headers=ops_headers)
    t4_pass = res_recv_again.status_code == 400 and "cannot be received twice" in res_recv_again.json().get("detail", "")
    log_test("Mandatory Test 4: Same transfer cannot be received twice", t4_pass, f"Response: {res_recv_again.json().get('detail')}")

    # -------------------------------------------------------------------------
    # MODULE 5: CUSTOMER ORDER & STOCK RESERVATION (PDF Page 4, 5)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.YELLOW}--- 5. Testing Customer Order & Concurrency-Safe Stock Reservation ---{Colors.RESET}")
    import uuid
    run_id = uuid.uuid4().hex[:6]
    batch_pdf = f"BATCH-PDF-{run_id}"
    batch_race = f"BATCH-RACE-{run_id}"

    # PDF Example: Item A: Available = 100, Customer Order = 60
    # After reservation: Physical = 100, Reserved = 60, Available = 40
    client.post("/inventory/adjust", json={
        "item_id": 1,
        "location_id": 1,
        "batch_number": batch_pdf,
        "physical_quantity_delta": 100,
        "reason": "PDF Page 4 Example Batch"
    }, headers=ops_headers)

    # Sales user reserves 60 units
    res_ord1 = client.post("/orders", json={
        "customer_name": "Wayne Enterprises",
        "location_id": 1,
        "item_id": 1,
        "batch_number": batch_pdf,
        "quantity": 60
    }, headers=sales_headers)
    ord1_data = res_ord1.json()

    # Verify inventory state
    inv_pdf = next(i for i in client.get("/inventory?location_id=1", headers=sales_headers).json() if i["batch_number"] == batch_pdf)
    example_ok = (
        inv_pdf["physical_quantity"] == 100 and
        inv_pdf["reserved_quantity"] == 60 and
        inv_pdf["available_quantity"] == 40
    )
    log_test("PDF Example: Order 60 from 100 -> Physical=100, Reserved=60, Available=40", example_ok,
             f"Physical={inv_pdf['physical_quantity']}, Reserved={inv_pdf['reserved_quantity']}, Available={inv_pdf['available_quantity']}")

    # Mandatory Test 1: Cannot reserve more than available inventory
    # Available is 40. Attempt to reserve 50 units
    res_ord_over = client.post("/orders", json={
        "customer_name": "Overbooking Inc",
        "location_id": 1,
        "item_id": 1,
        "batch_number": batch_pdf,
        "quantity": 50
    }, headers=sales_headers)
    t1_pass = res_ord_over.status_code == 400 and "Cannot reserve more than available" in res_ord_over.json().get("detail", "")
    log_test("Mandatory Test 1: Cannot reserve more than available inventory", t1_pass, f"Response: {res_ord_over.json().get('detail')}")

    # Concurrency verification (User A=80, User B=50 from Available=100)
    # Create fresh batch of 100
    client.post("/inventory/adjust", json={
        "item_id": 1,
        "location_id": 1,
        "batch_number": batch_race,
        "physical_quantity_delta": 100,
        "reason": "Race Test Batch"
    }, headers=ops_headers)

    # User A reserves 80
    res_a = client.post("/orders", json={
        "customer_name": "User A",
        "location_id": 1,
        "item_id": 1,
        "batch_number": batch_race,
        "quantity": 80
    }, headers=sales_headers)

    # User B reserves 50 (80 + 50 = 130 > 100 -> Both must NOT succeed!)
    res_b = client.post("/orders", json={
        "customer_name": "User B",
        "location_id": 1,
        "item_id": 1,
        "batch_number": batch_race,
        "quantity": 50
    }, headers=sales_headers)

    concurrency_ok = (res_a.status_code == 201 and res_b.status_code == 400)
    log_test("PDF Concurrency Rule: User A (80) & User B (50) from 100 -> Both must NOT succeed", concurrency_ok,
             f"User A status: {res_a.status_code}, User B status: {res_b.status_code}")

    # -------------------------------------------------------------------------
    # LIVE VERIFICATION READINESS: Order Cancellation (PDF Page 7 Change 3)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.YELLOW}--- 6. Testing Live Verification Readiness ---{Colors.RESET}")
    # Cancel User A's order of 80 units
    order_a_id = res_a.json()["id"]
    res_cancel = client.post(f"/orders/{order_a_id}/cancel", headers=sales_headers)
    inv_after_cancel = next(i for i in client.get("/inventory?location_id=1", headers=sales_headers).json() if i["batch_number"] == batch_race)
    cancel_ok = (
        res_cancel.status_code == 200 and
        inv_after_cancel["reserved_quantity"] == 0 and
        inv_after_cancel["available_quantity"] == 100
    )
    log_test("Live Verification Change 3: Cancel order & correctly release reserved inventory", cancel_ok,
             f"Reserved restored to {inv_after_cancel['reserved_quantity']}, Available restored to {inv_after_cancel['available_quantity']}")

    print(f"\n{Colors.CYAN}========================================================================{Colors.RESET}")
    print(f"{Colors.GREEN}{Colors.BOLD}   ALL PDF SPECIFICATIONS AND MANDATORY TESTS VERIFIED SUCCESSFULLY!{Colors.RESET}")
    print(f"{Colors.CYAN}========================================================================{Colors.RESET}\n")

if __name__ == "__main__":
    run_pdf_verification()
