from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from .models import RoleEnum, WorkOrderStatusEnum, TransferStatusEnum, CustomerOrderStatusEnum, TransactionTypeEnum


# ---------------- Auth & User Schemas ----------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum
    user_id: int
    full_name: str
    email: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[RoleEnum] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: RoleEnum
    assigned_location_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Location Schemas ----------------
class LocationBase(BaseModel):
    code: str
    name: str
    address: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationOut(LocationBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Item Schemas ----------------
class ItemBase(BaseModel):
    sku: str
    name: str
    category: str
    unit: str = "units"
    description: Optional[str] = None


class ItemCreate(ItemBase):
    pass


class ItemOut(ItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Inventory Schemas ----------------
class InventoryAdjustRequest(BaseModel):
    item_id: int
    location_id: int
    batch_number: str = "DEFAULT"
    physical_quantity_delta: int = Field(..., description="Quantity to add (positive) or deduct (negative)")
    reason: Optional[str] = "Manual inventory adjustment"


class InventoryOut(BaseModel):
    id: int
    item_id: int
    item_name: str
    item_sku: str
    category: str
    location_id: int
    location_name: str
    location_code: str
    batch_number: str
    physical_quantity: int
    reserved_quantity: int
    damaged_quantity: int
    available_quantity: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Work Order Schemas ----------------
class WorkOrderCreate(BaseModel):
    location_id: int
    item_id: int
    required_quantity: int = Field(..., gt=0, description="Required material quantity must be positive")
    assigned_user_id: int


class WorkOrderStatusUpdate(BaseModel):
    status: WorkOrderStatusEnum


class SurplusLocationOption(BaseModel):
    location_id: int
    location_name: str
    location_code: str
    available_quantity: int


class WorkOrderStockCheckOut(BaseModel):
    work_order_id: int
    work_order_code: str
    item_id: int
    item_name: str
    location_id: int
    location_name: str
    required_quantity: int
    available_at_location: int
    shortage: int
    is_shortage: bool
    surplus_locations: List[SurplusLocationOption] = []


class WorkOrderOut(BaseModel):
    id: int
    work_order_code: str
    location_id: int
    location_name: str
    item_id: int
    item_name: str
    item_sku: str
    required_quantity: int
    assigned_user_id: int
    assigned_user_name: str
    status: WorkOrderStatusEnum
    created_at: datetime
    updated_at: datetime
    stock_check: Optional[WorkOrderStockCheckOut] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------- Internal Transfer Schemas ----------------
class InternalTransferCreate(BaseModel):
    source_location_id: int
    destination_location_id: int
    item_id: int
    batch_number: str = "DEFAULT"
    quantity: int = Field(..., gt=0, description="Transfer quantity must be positive")


class InternalTransferOut(BaseModel):
    id: int
    transfer_code: str
    source_location_id: int
    source_location_name: str
    destination_location_id: int
    destination_location_name: str
    item_id: int
    item_name: str
    item_sku: str
    batch_number: str
    quantity: int
    status: TransferStatusEnum
    created_at: datetime
    dispatched_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------- Customer Order Schemas ----------------
class CustomerOrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1)
    location_id: int
    item_id: int
    batch_number: str = "DEFAULT"
    quantity: int = Field(..., gt=0, description="Order quantity must be positive")


class CustomerOrderOut(BaseModel):
    id: int
    order_code: str
    customer_name: str
    location_id: int
    location_name: str
    item_id: int
    item_name: str
    item_sku: str
    batch_number: str
    quantity: int
    status: CustomerOrderStatusEnum
    created_at: datetime
    created_by_user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------- Audit Transaction Schemas ----------------
class InventoryTransactionOut(BaseModel):
    id: int
    transaction_type: TransactionTypeEnum
    reference_code: str
    item_id: int
    location_id: int
    batch_number: str
    physical_delta: int
    reserved_delta: int
    created_at: datetime
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
