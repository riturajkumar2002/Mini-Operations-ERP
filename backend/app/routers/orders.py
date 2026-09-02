from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import update
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import (
    CustomerOrder,
    CustomerOrderStatusEnum,
    Inventory,
    Location,
    Item,
    User,
    RoleEnum,
    InventoryTransaction,
    TransactionTypeEnum
)
from ..schemas import CustomerOrderCreate, CustomerOrderOut
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/orders", tags=["Customer Orders & Stock Reservation"])


def serialize_order(order: CustomerOrder) -> dict:
    return {
        "id": order.id,
        "order_code": order.order_code,
        "customer_name": order.customer_name,
        "location_id": order.location_id,
        "location_name": order.location.name,
        "item_id": order.item_id,
        "item_name": order.item.name,
        "item_sku": order.item.sku,
        "batch_number": order.batch_number,
        "quantity": order.quantity,
        "status": order.status,
        "created_at": order.created_at,
        "created_by_user_id": order.created_by_user_id
    }


@router.get("", response_model=List[CustomerOrderOut])
def list_customer_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(CustomerOrder).order_by(CustomerOrder.created_at.desc()).all()
    return [serialize_order(o) for o in orders]


@router.post("", response_model=CustomerOrderOut, status_code=status.HTTP_201_CREATED)
def create_customer_order(
    order_in: CustomerOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.SALES))
):
    """
    Sales User or Admin creates an order and reserves inventory stock.
    Guarantees concurrency safety: Two users cannot reserve more stock than exists.
    Uses row-level locking + atomic conditional UPDATE.
    """
    location = db.query(Location).filter(Location.id == order_in.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    item = db.query(Item).filter(Item.id == order_in.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Atomic reservation transaction
    with db.begin_nested():
        # 1. Lock candidate inventory row
        inv = db.query(Inventory).filter(
            Inventory.item_id == order_in.item_id,
            Inventory.location_id == order_in.location_id,
            Inventory.batch_number == order_in.batch_number
        ).with_for_update().first()

        if not inv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No inventory record found for item at this location/batch"
            )

        # 2. Atomic conditional update to prevent race conditions & overbooking
        stmt = (
            update(Inventory)
            .where(
                Inventory.id == inv.id,
                (Inventory.physical_quantity - Inventory.reserved_quantity - Inventory.damaged_quantity) >= order_in.quantity
            )
            .values(reserved_quantity=Inventory.reserved_quantity + order_in.quantity)
        )
        result = db.execute(stmt)

        if result.rowcount == 0:
            current_avail = inv.available_quantity
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reserve more than available inventory. Available: {current_avail}, Requested: {order_in.quantity}"
            )

        code_prefix = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}"
        count = db.query(CustomerOrder).filter(CustomerOrder.order_code.like(f"{code_prefix}%")).count()
        code = f"{code_prefix}-{count + 1:04d}"

        customer_order = CustomerOrder(
            order_code=code,
            customer_name=order_in.customer_name,
            location_id=order_in.location_id,
            item_id=order_in.item_id,
            batch_number=order_in.batch_number,
            quantity=order_in.quantity,
            status=CustomerOrderStatusEnum.RESERVED,
            created_by_user_id=current_user.id
        )
        db.add(customer_order)
        db.flush()

        # Audit transaction
        tx = InventoryTransaction(
            transaction_type=TransactionTypeEnum.RESERVATION,
            reference_code=customer_order.order_code,
            item_id=inv.item_id,
            location_id=inv.location_id,
            batch_number=inv.batch_number,
            physical_delta=0,
            reserved_delta=order_in.quantity,
            notes=f"Stock reserved for customer {order_in.customer_name} (Order {customer_order.order_code})"
        )
        db.add(tx)

    db.commit()
    db.refresh(customer_order)
    return serialize_order(customer_order)


@router.post("/{order_id}/cancel", response_model=CustomerOrderOut)
def cancel_customer_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.SALES))
):
    """
    Cancel an order and correctly release its reserved inventory.
    (Live Verification Change 3 capability)
    """
    with db.begin_nested():
        order = db.query(CustomerOrder).filter(
            CustomerOrder.id == order_id
        ).with_for_update().first()

        if not order:
            raise HTTPException(status_code=404, detail="Customer Order not found")

        if order.status != CustomerOrderStatusEnum.RESERVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only RESERVED orders can be cancelled. Current status is '{order.status.value}'"
            )

        inv = db.query(Inventory).filter(
            Inventory.item_id == order.item_id,
            Inventory.location_id == order.location_id,
            Inventory.batch_number == order.batch_number
        ).with_for_update().first()

        if inv:
            inv.reserved_quantity = max(0, inv.reserved_quantity - order.quantity)

        order.status = CustomerOrderStatusEnum.CANCELLED

        # Audit release
        tx = InventoryTransaction(
            transaction_type=TransactionTypeEnum.RELEASE_RESERVATION,
            reference_code=order.order_code,
            item_id=order.item_id,
            location_id=order.location_id,
            batch_number=order.batch_number,
            physical_delta=0,
            reserved_delta=-order.quantity,
            notes=f"Released reserved inventory from cancelled order {order.order_code}"
        )
        db.add(tx)

    db.commit()
    db.refresh(order)
    return serialize_order(order)
