from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
import uuid
from ..database import get_db
from ..models import WorkOrder, WorkOrderStatusEnum, Inventory, Item, Location, User, RoleEnum
from ..schemas import (
    WorkOrderCreate,
    WorkOrderOut,
    WorkOrderStatusUpdate,
    WorkOrderStockCheckOut,
    SurplusLocationOption
)
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/work-orders", tags=["Work Orders & Stock Check"])


def calculate_stock_check(wo: WorkOrder, db: Session) -> WorkOrderStockCheckOut:
    # Calculate available stock at the work order's location
    inv_records = db.query(Inventory).filter(
        Inventory.item_id == wo.item_id,
        Inventory.location_id == wo.location_id
    ).all()
    available_at_loc = sum(inv.available_quantity for inv in inv_records)
    shortage = max(0, wo.required_quantity - available_at_loc)

    # Find other locations with surplus available inventory
    other_inv_records = db.query(Inventory).filter(
        Inventory.item_id == wo.item_id,
        Inventory.location_id != wo.location_id
    ).all()

    loc_totals = {}
    for inv in other_inv_records:
        avail = inv.available_quantity
        if avail > 0:
            if inv.location_id not in loc_totals:
                loc_totals[inv.location_id] = {
                    "location_id": inv.location_id,
                    "location_name": inv.location.name,
                    "location_code": inv.location.code,
                    "available_quantity": 0
                }
            loc_totals[inv.location_id]["available_quantity"] += avail

    surplus_list = [
        SurplusLocationOption(**data) for data in loc_totals.values() if data["available_quantity"] > 0
    ]

    return WorkOrderStockCheckOut(
        work_order_id=wo.id,
        work_order_code=wo.work_order_code,
        item_id=wo.item_id,
        item_name=wo.item.name,
        location_id=wo.location_id,
        location_name=wo.location.name,
        required_quantity=wo.required_quantity,
        available_at_location=available_at_loc,
        shortage=shortage,
        is_shortage=shortage > 0,
        surplus_locations=surplus_list
    )


def serialize_work_order(wo: WorkOrder, db: Session) -> dict:
    stock_check = calculate_stock_check(wo, db)
    return {
        "id": wo.id,
        "work_order_code": wo.work_order_code,
        "location_id": wo.location_id,
        "location_name": wo.location.name,
        "item_id": wo.item_id,
        "item_name": wo.item.name,
        "item_sku": wo.item.sku,
        "required_quantity": wo.required_quantity,
        "assigned_user_id": wo.assigned_user_id,
        "assigned_user_name": wo.assigned_user.full_name if wo.assigned_user else "Unassigned",
        "status": wo.status,
        "created_at": wo.created_at,
        "updated_at": wo.updated_at,
        "stock_check": stock_check
    }


@router.get("", response_model=List[WorkOrderOut])
def list_work_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    work_orders = db.query(WorkOrder).order_by(WorkOrder.created_at.desc()).all()
    return [serialize_work_order(wo, db) for wo in work_orders]


@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    wo_in: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN))
):
    """Admin can create a Work Order."""
    location = db.query(Location).filter(Location.id == wo_in.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    item = db.query(Item).filter(Item.id == wo_in.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    assigned_user = db.query(User).filter(User.id == wo_in.assigned_user_id).first()
    if not assigned_user:
        raise HTTPException(status_code=404, detail="Assigned user not found")

    code_prefix = f"WO-{datetime.utcnow().strftime('%Y%m%d')}"
    count = db.query(WorkOrder).filter(WorkOrder.work_order_code.like(f"{code_prefix}%")).count()
    code = f"{code_prefix}-{count + 1:04d}"

    work_order = WorkOrder(
        work_order_code=code,
        location_id=wo_in.location_id,
        item_id=wo_in.item_id,
        required_quantity=wo_in.required_quantity,
        assigned_user_id=wo_in.assigned_user_id,
        status=WorkOrderStatusEnum.ASSIGNED
    )
    db.add(work_order)
    db.commit()
    db.refresh(work_order)

    return serialize_work_order(work_order, db)


@router.get("/{work_order_id}/stock-check", response_model=WorkOrderStockCheckOut)
def get_work_order_stock_check(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work Order not found")
    return calculate_stock_check(wo, db)


@router.patch("/{work_order_id}/status", response_model=WorkOrderOut)
def update_work_order_status(
    work_order_id: int,
    status_update: WorkOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work Order not found")

    wo.status = status_update.status
    db.commit()
    db.refresh(wo)
    return serialize_work_order(wo, db)
