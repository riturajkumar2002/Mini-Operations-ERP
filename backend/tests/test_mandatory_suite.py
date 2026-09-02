import pytest
from app.models import Location, Item, Inventory, InternalTransfer, TransferStatusEnum, CustomerOrder


def create_test_base(db):
    loc_a = Location(code="LOC-A", name="Warehouse Alpha")
    loc_b = Location(code="LOC-B", name="Warehouse Beta")
    item = Item(sku="SKU-TEST-01", name="Test Widget", category="Widgets", unit="pcs")
    db.add_all([loc_a, loc_b, item])
    db.commit()
    db.refresh(loc_a)
    db.refresh(loc_b)
    db.refresh(item)
    return loc_a, loc_b, item


# ==============================================================================
# MANDATORY TEST 1: Cannot reserve more than available inventory
# ==============================================================================
def test_cannot_reserve_more_than_available_inventory(client, sales_headers, db):
    loc_a, _, item = create_test_base(db)

    # Initial inventory: Physical = 100, Reserved = 0 => Available = 100
    inv = Inventory(
        item_id=item.id,
        location_id=loc_a.id,
        batch_number="BATCH-001",
        physical_quantity=100,
        reserved_quantity=0
    )
    db.add(inv)
    db.commit()

    # Step 1: Attempt to reserve 120 (more than available 100) -> Must fail
    res_fail = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "Acme Corp",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 120
        },
        headers=sales_headers
    )
    assert res_fail.status_code == 400
    assert "Cannot reserve more than available inventory" in res_fail.json()["detail"]

    # Step 2: Valid reservation of 60 -> Available becomes 40
    res_ok = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "Beta LLC",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 60
        },
        headers=sales_headers
    )
    assert res_ok.status_code == 201

    db.refresh(inv)
    assert inv.physical_quantity == 100
    assert inv.reserved_quantity == 60
    assert inv.available_quantity == 40

    # Step 3: Attempt second reservation of 50 (available is only 40) -> Must fail
    res_fail2 = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "Gamma Inc",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 50
        },
        headers=sales_headers
    )
    assert res_fail2.status_code == 400
    assert "Cannot reserve more than available inventory" in res_fail2.json()["detail"]


# ==============================================================================
# MANDATORY TEST 2: Cannot transfer more than available inventory
# ==============================================================================
def test_cannot_transfer_more_than_available_inventory(client, ops_headers, db):
    loc_a, loc_b, item = create_test_base(db)

    # Source inventory: Physical = 50, Reserved = 10 => Available = 40
    inv = Inventory(
        item_id=item.id,
        location_id=loc_a.id,
        batch_number="BATCH-001",
        physical_quantity=50,
        reserved_quantity=10
    )
    db.add(inv)
    db.commit()

    # Attempt to transfer 45 (available is only 40) -> Must fail
    res = client.post(
        "/api/v1/transfers",
        json={
            "source_location_id": loc_a.id,
            "destination_location_id": loc_b.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 45
        },
        headers=ops_headers
    )
    assert res.status_code == 400
    assert "Cannot transfer more than available inventory" in res.json()["detail"]


# ==============================================================================
# MANDATORY TEST 3: Destination stock increases only after transfer receipt
# ==============================================================================
def test_destination_stock_increases_only_after_transfer_receipt(client, ops_headers, db):
    loc_a, loc_b, item = create_test_base(db)

    # Source has 100, Destination has 0
    inv_source = Inventory(
        item_id=item.id,
        location_id=loc_a.id,
        batch_number="BATCH-001",
        physical_quantity=100,
        reserved_quantity=0
    )
    db.add(inv_source)
    db.commit()

    # 1. Create transfer for 35 units
    res_create = client.post(
        "/api/v1/transfers",
        json={
            "source_location_id": loc_a.id,
            "destination_location_id": loc_b.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 35
        },
        headers=ops_headers
    )
    assert res_create.status_code == 201
    transfer_id = res_create.json()["id"]

    # 2. Dispatch transfer: On Dispatch -> Source reduces, Destination must NOT increase
    res_dispatch = client.post(f"/api/v1/transfers/{transfer_id}/dispatch", headers=ops_headers)
    assert res_dispatch.status_code == 200
    assert res_dispatch.json()["status"] == "DISPATCHED"

    db.refresh(inv_source)
    assert inv_source.physical_quantity == 65  # Source reduced (100 - 35 = 65)

    inv_dest = db.query(Inventory).filter(
        Inventory.item_id == item.id,
        Inventory.location_id == loc_b.id,
        Inventory.batch_number == "BATCH-001"
    ).first()
    # Before receipt, destination stock must NOT exist or be 0
    assert inv_dest is None or inv_dest.physical_quantity == 0

    # 3. Receive transfer: On Receipt -> Destination inventory increases
    res_receive = client.post(f"/api/v1/transfers/{transfer_id}/receive", headers=ops_headers)
    assert res_receive.status_code == 200
    assert res_receive.json()["status"] == "RECEIVED"

    inv_dest = db.query(Inventory).filter(
        Inventory.item_id == item.id,
        Inventory.location_id == loc_b.id,
        Inventory.batch_number == "BATCH-001"
    ).first()
    assert inv_dest is not None
    assert inv_dest.physical_quantity == 35  # Destination increased exactly by transfer quantity!


# ==============================================================================
# MANDATORY TEST 4: Same transfer cannot be received twice
# ==============================================================================
def test_same_transfer_cannot_be_received_twice(client, ops_headers, db):
    loc_a, loc_b, item = create_test_base(db)

    inv_source = Inventory(
        item_id=item.id,
        location_id=loc_a.id,
        batch_number="BATCH-001",
        physical_quantity=50,
        reserved_quantity=0
    )
    db.add(inv_source)
    db.commit()

    # Create and dispatch
    res_create = client.post(
        "/api/v1/transfers",
        json={
            "source_location_id": loc_a.id,
            "destination_location_id": loc_b.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 20
        },
        headers=ops_headers
    )
    transfer_id = res_create.json()["id"]
    client.post(f"/api/v1/transfers/{transfer_id}/dispatch", headers=ops_headers)

    # First receipt: must succeed
    res_recv1 = client.post(f"/api/v1/transfers/{transfer_id}/receive", headers=ops_headers)
    assert res_recv1.status_code == 200

    inv_dest = db.query(Inventory).filter(
        Inventory.item_id == item.id,
        Inventory.location_id == loc_b.id
    ).first()
    assert inv_dest.physical_quantity == 20

    # Second receipt attempt: must fail with 400
    res_recv2 = client.post(f"/api/v1/transfers/{transfer_id}/receive", headers=ops_headers)
    assert res_recv2.status_code == 400
    assert "cannot be received twice" in res_recv2.json()["detail"]

    # Destination stock must NOT have increased twice
    db.refresh(inv_dest)
    assert inv_dest.physical_quantity == 20


# ==============================================================================
# MANDATORY TEST 5: Unauthorized user cannot perform restricted operation
# ==============================================================================
def test_unauthorized_user_cannot_perform_restricted_operation(client, admin_headers, ops_headers, sales_headers, db):
    loc_a, loc_b, item = create_test_base(db)

    # 5a. Sales user attempts to create a Work Order (Admin only) -> 403 Forbidden
    res_wo = client.post(
        "/api/v1/work-orders",
        json={
            "location_id": loc_a.id,
            "item_id": item.id,
            "required_quantity": 10,
            "assigned_user_id": 1
        },
        headers=sales_headers
    )
    assert res_wo.status_code == 403
    assert "Operation not permitted for role 'SALES'" in res_wo.json()["detail"]

    # 5b. Sales user attempts to dispatch an internal transfer -> 403 Forbidden
    res_tr = client.post(
        "/api/v1/transfers/1/dispatch",
        headers=sales_headers
    )
    assert res_tr.status_code == 403

    # 5c. Operations user attempts to create a Customer Order (Sales/Admin only) -> 403 Forbidden
    res_ord = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "Illegal Order",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-001",
            "quantity": 5
        },
        headers=ops_headers
    )
    assert res_ord.status_code == 403
    assert "Operation not permitted for role 'OPERATIONS'" in res_ord.json()["detail"]

    # 5d. Unauthenticated request -> 401 Unauthorized
    res_unauth = client.get("/api/v1/inventory")
    assert res_unauth.status_code == 401


# ==============================================================================
# ADDITIONAL CONCURRENCY TEST: Two users reserving from limited stock
# ==============================================================================
def test_concurrency_race_condition_protection(client, sales_headers, db):
    loc_a, _, item = create_test_base(db)

    # Stock: Physical = 100, Reserved = 0, Available = 100
    inv = Inventory(
        item_id=item.id,
        location_id=loc_a.id,
        batch_number="BATCH-CONCUR",
        physical_quantity=100,
        reserved_quantity=0
    )
    db.add(inv)
    db.commit()

    # User A requests 80
    res_a = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "User A",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-CONCUR",
            "quantity": 80
        },
        headers=sales_headers
    )
    assert res_a.status_code == 201

    # User B requests 50 (Total requested = 130 > 100 Available)
    # User B must fail
    res_b = client.post(
        "/api/v1/orders",
        json={
            "customer_name": "User B",
            "location_id": loc_a.id,
            "item_id": item.id,
            "batch_number": "BATCH-CONCUR",
            "quantity": 50
        },
        headers=sales_headers
    )
    assert res_b.status_code == 400
    assert "Cannot reserve more than available inventory" in res_b.json()["detail"]

    db.refresh(inv)
    assert inv.reserved_quantity == 80
    assert inv.available_quantity == 20
