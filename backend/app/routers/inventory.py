from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from ..models import Inventory, Item, Location, User, RoleEnum, InventoryTransaction, TransactionTypeEnum
from ..schemas import InventoryOut, InventoryAdjustRequest, InventoryTransactionOut
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])


def serialize_inventory(inv: Inventory) -> dict:
    return {
        "id": inv.id,
        "item_id": inv.item_id,
        "item_name": inv.item.name,
        "item_sku": inv.item.sku,
        "category": inv.item.category,
        "location_id": inv.location_id,
        "location_name": inv.location.name,
        "location_code": inv.location.code,
        "batch_number": inv.batch_number,
        "physical_quantity": inv.physical_quantity,
        "reserved_quantity": inv.reserved_quantity,
        "damaged_quantity": inv.damaged_quantity,
        "available_quantity": inv.available_quantity,
        "updated_at": inv.updated_at
    }


@router.get("", response_model=List[InventoryOut])
def list_inventory(
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    category: Optional[str] = Query(None, description="Filter by item category"),
    search: Optional[str] = Query(None, description="Search item name or SKU"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Inventory).join(Item).join(Location)

    if location_id:
        query = query.filter(Inventory.location_id == location_id)
    if category:
        query = query.filter(Item.category == category)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(Item.name.ilike(search_fmt) | Item.sku.ilike(search_fmt) | Inventory.batch_number.ilike(search_fmt))

    records = query.order_by(Item.name, Inventory.batch_number).all()
    return [serialize_inventory(r) for r in records]


@router.post("/adjust", response_model=InventoryOut)
def adjust_inventory(
    req: InventoryAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    """
    Adjust inventory stock.
    Prevents negative inventory, invalid quantities, and ensures physical >= reserved.
    """
    if req.physical_quantity_delta == 0:
        raise HTTPException(status_code=400, detail="Adjustment quantity cannot be zero")

    item = db.query(Item).filter(Item.id == req.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    location = db.query(Location).filter(Location.id == req.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Transactional update
    with db.begin_nested():
        inv = db.query(Inventory).filter(
            Inventory.item_id == req.item_id,
            Inventory.location_id == req.location_id,
            Inventory.batch_number == req.batch_number
        ).with_for_update().first()

        if not inv:
            if req.physical_quantity_delta < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deduct inventory from non-existent batch/location record"
                )
            inv = Inventory(
                item_id=req.item_id,
                location_id=req.location_id,
                batch_number=req.batch_number,
                physical_quantity=req.physical_quantity_delta,
                reserved_quantity=0,
                damaged_quantity=0
            )
            db.add(inv)
            db.flush()
        else:
            new_physical = inv.physical_quantity + req.physical_quantity_delta
            if new_physical < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Adjustment would result in negative inventory (Current: {inv.physical_quantity}, Delta: {req.physical_quantity_delta})"
                )
            if new_physical < (inv.reserved_quantity + inv.damaged_quantity):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot reduce physical stock below reserved/damaged stock (New Physical: {new_physical}, Reserved: {inv.reserved_quantity})"
                )
            inv.physical_quantity = new_physical

        # Record audit transaction
        tx = InventoryTransaction(
            transaction_type=TransactionTypeEnum.ADJUSTMENT,
            reference_code=f"ADJ-{current_user.id}-{inv.id}",
            item_id=inv.item_id,
            location_id=inv.location_id,
            batch_number=inv.batch_number,
            physical_delta=req.physical_quantity_delta,
            reserved_delta=0,
            notes=f"User {current_user.full_name}: {req.reason}"
        )
        db.add(tx)

    db.commit()
    db.refresh(inv)
    return serialize_inventory(inv)


@router.get("/transactions", response_model=List[InventoryTransactionOut])
def list_transactions(
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(InventoryTransaction).order_by(InventoryTransaction.created_at.desc()).limit(limit).all()
