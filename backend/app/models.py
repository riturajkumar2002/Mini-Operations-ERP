import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    CheckConstraint,
    UniqueConstraint,
    Text
)
from sqlalchemy.orm import relationship
from .database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    OPERATIONS = "OPERATIONS"
    SALES = "SALES"


class WorkOrderStatusEnum(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class TransferStatusEnum(str, enum.Enum):
    REQUESTED = "REQUESTED"
    DISPATCHED = "DISPATCHED"
    RECEIVED = "RECEIVED"


class CustomerOrderStatusEnum(str, enum.Enum):
    RESERVED = "RESERVED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class TransactionTypeEnum(str, enum.Enum):
    INITIAL = "INITIAL"
    TRANSFER_DISPATCH = "TRANSFER_DISPATCH"
    TRANSFER_RECEIPT = "TRANSFER_RECEIPT"
    RESERVATION = "RESERVATION"
    RELEASE_RESERVATION = "RELEASE_RESERVATION"
    ADJUSTMENT = "ADJUSTMENT"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(RoleEnum), nullable=False, default=RoleEnum.OPERATIONS)
    assigned_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assigned_location = relationship("Location", foreign_keys=[assigned_location_id])
    assigned_work_orders = relationship("WorkOrder", back_populates="assigned_user")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    inventory_items = relationship("Inventory", back_populates="location")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    unit = Column(String(20), default="units", nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    inventory_records = relationship("Inventory", back_populates="item")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, default="DEFAULT")
    physical_quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    damaged_quantity = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    item = relationship("Item", back_populates="inventory_records")
    location = relationship("Location", back_populates="inventory_items")

    __table_args__ = (
        CheckConstraint("physical_quantity >= 0", name="check_inventory_physical_non_negative"),
        CheckConstraint("reserved_quantity >= 0", name="check_inventory_reserved_non_negative"),
        CheckConstraint("damaged_quantity >= 0", name="check_inventory_damaged_non_negative"),
        CheckConstraint("reserved_quantity <= physical_quantity", name="check_inventory_reserved_le_physical"),
        UniqueConstraint("item_id", "location_id", "batch_number", name="uq_inventory_item_location_batch"),
    )

    @property
    def available_quantity(self) -> int:
        return max(0, self.physical_quantity - self.reserved_quantity - self.damaged_quantity)


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_code = Column(String(50), unique=True, index=True, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    required_quantity = Column(Integer, nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SQLEnum(WorkOrderStatusEnum), nullable=False, default=WorkOrderStatusEnum.ASSIGNED)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    location = relationship("Location")
    item = relationship("Item")
    assigned_user = relationship("User", back_populates="assigned_work_orders")

    __table_args__ = (
        CheckConstraint("required_quantity > 0", name="check_work_order_required_qty_positive"),
    )


class InternalTransfer(Base):
    __tablename__ = "internal_transfers"

    id = Column(Integer, primary_key=True, index=True)
    transfer_code = Column(String(50), unique=True, index=True, nullable=False)
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, default="DEFAULT")
    quantity = Column(Integer, nullable=False)
    status = Column(SQLEnum(TransferStatusEnum), nullable=False, default=TransferStatusEnum.REQUESTED)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    dispatched_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    item = relationship("Item")
    created_by_user = relationship("User")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_transfer_qty_positive"),
        CheckConstraint("source_location_id != destination_location_id", name="check_transfer_diff_locations"),
    )


class CustomerOrder(Base):
    __tablename__ = "customer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(255), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, default="DEFAULT")
    quantity = Column(Integer, nullable=False)
    status = Column(SQLEnum(CustomerOrderStatusEnum), nullable=False, default=CustomerOrderStatusEnum.RESERVED)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    location = relationship("Location")
    item = relationship("Item")
    created_by_user = relationship("User")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_customer_order_qty_positive"),
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(SQLEnum(TransactionTypeEnum), nullable=False)
    reference_code = Column(String(100), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    batch_number = Column(String(100), nullable=False, default="DEFAULT")
    physical_delta = Column(Integer, nullable=False, default=0)
    reserved_delta = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    item = relationship("Item")
    location = relationship("Location")
