from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import (
    InternalTransfer,
    TransferStatusEnum,
    Inventory,
    Location,
    Item,
    User,
    RoleEnum,
    InventoryTransaction,
    TransactionTypeEnum
)
from ..schemas import InternalTransferCreate, InternalTransferOut
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/transfers", tags=["Internal Stock Transfers"])


def serialize_transfer(tr: InternalTransfer) -> dict:
    return {
        "id": tr.id,
        "transfer_code": tr.transfer_code,
        "source_location_id": tr.source_location_id,
        "source_location_name": tr.source_location.name,
        "destination_location_id": tr.destination_location_id,
        "destination_location_name": tr.destination_location.name,
        "item_id": tr.item_id,
        "item_name": tr.item.name,
        "item_sku": tr.item.sku,
        "batch_number": tr.batch_number,
        "quantity": tr.quantity,
        "status": tr.status,
        "created_at": tr.created_at,
        "dispatched_at": tr.dispatched_at,
        "received_at": tr.received_at,
        "created_by_user_id": tr.created_by_user_id
    }


@router.get("", response_model=List[InternalTransferOut])
def list_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfers = db.query(InternalTransfer).order_by(InternalTransfer.created_at.desc()).all()
    return [serialize_transfer(t) for t in transfers]


@router.post("", response_model=InternalTransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(
    tr_in: InternalTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    if tr_in.source_location_id == tr_in.destination_location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination locations cannot be the same"
        )

    source_loc = db.query(Location).filter(Location.id == tr_in.source_location_id).first()
    if not source_loc:
        raise HTTPException(status_code=404, detail="Source location not found")

    dest_loc = db.query(Location).filter(Location.id == tr_in.destination_location_id).first()
    if not dest_loc:
        raise HTTPException(status_code=404, detail="Destination location not found")

    item = db.query(Item).filter(Item.id == tr_in.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Verify source has sufficient available inventory (Test 2 requirement)
    source_inv = db.query(Inventory).filter(
        Inventory.item_id == tr_in.item_id,
        Inventory.location_id == tr_in.source_location_id,
        Inventory.batch_number == tr_in.batch_number
    ).first()

    available_qty = source_inv.available_quantity if source_inv else 0
    if available_qty < tr_in.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transfer more than available inventory. Available at source: {available_qty}, Requested: {tr_in.quantity}"
        )

    code_prefix = f"TR-{datetime.utcnow().strftime('%Y%m%d')}"
    count = db.query(InternalTransfer).filter(InternalTransfer.transfer_code.like(f"{code_prefix}%")).count()
    code = f"{code_prefix}-{count + 1:04d}"

    transfer = InternalTransfer(
        transfer_code=code,
        source_location_id=tr_in.source_location_id,
        destination_location_id=tr_in.destination_location_id,
        item_id=tr_in.item_id,
        batch_number=tr_in.batch_number,
        quantity=tr_in.quantity,
        status=TransferStatusEnum.REQUESTED,
        created_by_user_id=current_user.id
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    return serialize_transfer(transfer)


@router.post("/{transfer_id}/dispatch", response_model=InternalTransferOut)
def dispatch_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    """
    On Dispatch:
    - Source inventory reduces.
    - Before Receipt: Destination inventory must NOT increase.
    """
    with db.begin_nested():
        transfer = db.query(InternalTransfer).filter(
            InternalTransfer.id == transfer_id
        ).with_for_update().first()

        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")

        if transfer.status != TransferStatusEnum.REQUESTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transfer cannot be dispatched because current status is '{transfer.status.value}'"
            )

        source_inv = db.query(Inventory).filter(
            Inventory.item_id == transfer.item_id,
            Inventory.location_id == transfer.source_location_id,
            Inventory.batch_number == transfer.batch_number
        ).with_for_update().first()

        if not source_inv or source_inv.available_quantity < transfer.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory at source location for dispatch. Available: {source_inv.available_quantity if source_inv else 0}"
            )

        # Reduce source physical inventory
        source_inv.physical_quantity -= transfer.quantity
        transfer.status = TransferStatusEnum.DISPATCHED
        transfer.dispatched_at = datetime.utcnow()

        # Audit log
        tx = InventoryTransaction(
            transaction_type=TransactionTypeEnum.TRANSFER_DISPATCH,
            reference_code=transfer.transfer_code,
            item_id=transfer.item_id,
            location_id=transfer.source_location_id,
            batch_number=transfer.batch_number,
            physical_delta=-transfer.quantity,
            reserved_delta=0,
            notes=f"Dispatched transfer {transfer.transfer_code} to {transfer.destination_location.name}"
        )
        db.add(tx)

    db.commit()
    db.refresh(transfer)
    return serialize_transfer(transfer)


@router.post("/{transfer_id}/receive", response_model=InternalTransferOut)
def receive_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    """
    On Receipt:
    - Destination inventory increases.
    - System must prevent the same transfer from being received twice.
    """
    with db.begin_nested():
        transfer = db.query(InternalTransfer).filter(
            InternalTransfer.id == transfer_id
        ).with_for_update().first()

        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")

        # Crucial check: Cannot receive twice, and cannot receive un-dispatched transfer
        if transfer.status == TransferStatusEnum.RECEIVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer has already been received. The same transfer cannot be received twice."
            )

        if transfer.status != TransferStatusEnum.DISPATCHED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transfer cannot be received because it is currently '{transfer.status.value}', not DISPATCHED."
            )

        # Destination inventory increases
        dest_inv = db.query(Inventory).filter(
            Inventory.item_id == transfer.item_id,
            Inventory.location_id == transfer.destination_location_id,
            Inventory.batch_number == transfer.batch_number
        ).with_for_update().first()

        if not dest_inv:
            dest_inv = Inventory(
                item_id=transfer.item_id,
                location_id=transfer.destination_location_id,
                batch_number=transfer.batch_number,
                physical_quantity=transfer.quantity,
                reserved_quantity=0,
                damaged_quantity=0
            )
            db.add(dest_inv)
            db.flush()
        else:
            dest_inv.physical_quantity += transfer.quantity

        transfer.status = TransferStatusEnum.RECEIVED
        transfer.received_at = datetime.utcnow()

        # Audit log
        tx = InventoryTransaction(
            transaction_type=TransactionTypeEnum.TRANSFER_RECEIPT,
            reference_code=transfer.transfer_code,
            item_id=transfer.item_id,
            location_id=transfer.destination_location_id,
            batch_number=transfer.batch_number,
            physical_delta=transfer.quantity,
            reserved_delta=0,
            notes=f"Received transfer {transfer.transfer_code} from {transfer.source_location.name}"
        )
        db.add(tx)

    db.commit()
    db.refresh(transfer)
    return serialize_transfer(transfer)
