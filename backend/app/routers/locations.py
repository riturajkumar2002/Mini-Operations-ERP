from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Location, Item, User, RoleEnum
from ..schemas import LocationOut, LocationCreate, ItemOut, ItemCreate
from ..auth import get_current_user, require_roles

router = APIRouter(tags=["Locations & Items"])


@router.get("/locations", response_model=List[LocationOut])
def get_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Location).order_by(Location.code).all()


@router.post("/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    loc_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN))
):
    existing = db.query(Location).filter(Location.code == loc_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Location with code '{loc_in.code}' already exists")
    location = Location(**loc_in.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/items", response_model=List[ItemOut])
def get_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Item).order_by(Item.sku).all()


@router.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    item_in: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.OPERATIONS))
):
    existing = db.query(Item).filter(Item.sku == item_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Item with SKU '{item_in.sku}' already exists")
    item = Item(**item_in.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
