import logging
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import (
    User,
    RoleEnum,
    Location,
    Item,
    Inventory,
    WorkOrder,
    WorkOrderStatusEnum,
    InternalTransfer,
    TransferStatusEnum,
    CustomerOrder,
    CustomerOrderStatusEnum,
    InventoryTransaction,
    TransactionTypeEnum
)
from .auth import get_password_hash

logger = logging.getLogger(__name__)


def seed_database(db: Session = None):
    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True

    try:
        # 1. Seed Locations
        loc_main = db.query(Location).filter(Location.code == "WH-01").first()
        if not loc_main:
            loc_main = Location(code="WH-01", name="Main Central Warehouse", address="Plot 42, Industrial Zone A")
            loc_reg = Location(code="WH-02", name="Regional Distribution Hub", address="Building 7, Logistics Park")
            loc_plant = Location(code="PL-01", name="North Assembly Plant", address="Sector 9, Tech City")
            db.add_all([loc_main, loc_reg, loc_plant])
            db.commit()
            db.refresh(loc_main)
            db.refresh(loc_reg)
            db.refresh(loc_plant)
        else:
            loc_reg = db.query(Location).filter(Location.code == "WH-02").first()
            loc_plant = db.query(Location).filter(Location.code == "PL-01").first()

        # 2. Seed Users
        admin_user = db.query(User).filter(User.email == "admin@erp.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@erp.com",
                hashed_password=get_password_hash("admin123"),
                full_name="System Administrator",
                role=RoleEnum.ADMIN,
                assigned_location_id=loc_main.id,
                is_active=True
            )
            ops_user = User(
                email="ops@erp.com",
                hashed_password=get_password_hash("ops123"),
                full_name="Operations Manager",
                role=RoleEnum.OPERATIONS,
                assigned_location_id=loc_main.id,
                is_active=True
            )
            sales_user = User(
                email="sales@erp.com",
                hashed_password=get_password_hash("sales123"),
                full_name="Senior Sales Executive",
                role=RoleEnum.SALES,
                assigned_location_id=loc_main.id,
                is_active=True
            )
            db.add_all([admin_user, ops_user, sales_user])
            db.commit()
            db.refresh(admin_user)
            db.refresh(ops_user)
            db.refresh(sales_user)
        else:
            ops_user = db.query(User).filter(User.email == "ops@erp.com").first()
            sales_user = db.query(User).filter(User.email == "sales@erp.com").first()

        # 3. Seed Items
        item_steel = db.query(Item).filter(Item.sku == "SKU-STEEL-10").first()
        if not item_steel:
            item_steel = Item(
                sku="SKU-STEEL-10",
                name="Reinforced Steel Rods 10mm",
                category="Raw Materials",
                unit="kg",
                description="High tensile structural reinforcement steel rods"
            )
            item_chip = Item(
                sku="SKU-CHIP-M4",
                name="ARM Cortex-M4 Microcontroller",
                category="Electronics",
                unit="units",
                description="32-bit embedded industrial microcontrollers"
            )
            item_motor = Item(
                sku="SKU-MTR-24V",
                name="Industrial Brushless DC Motor 24V",
                category="Hardware",
                unit="units",
                description="High torque 24V precision brushless motor"
            )
            item_bear = Item(
                sku="SKU-BRG-6204",
                name="Deep Groove Ball Bearings 6204",
                category="Hardware",
                unit="units",
                description="Low noise industrial chrome steel ball bearings"
            )
            db.add_all([item_steel, item_chip, item_motor, item_bear])
            db.commit()
            db.refresh(item_steel)
            db.refresh(item_chip)
            db.refresh(item_motor)
            db.refresh(item_bear)
        else:
            item_chip = db.query(Item).filter(Item.sku == "SKU-CHIP-M4").first()
            item_motor = db.query(Item).filter(Item.sku == "SKU-MTR-24V").first()
            item_bear = db.query(Item).filter(Item.sku == "SKU-BRG-6204").first()

        # 4. Seed Initial Inventory
        if db.query(Inventory).count() == 0:
            # WH-01: Main Warehouse
            inv1 = Inventory(
                item_id=item_steel.id,
                location_id=loc_main.id,
                batch_number="BATCH-ST-001",
                physical_quantity=100,
                reserved_quantity=0,
                damaged_quantity=0
            )
            # WH-01: Microcontroller has 60 available (matches PDF scenario!)
            inv2 = Inventory(
                item_id=item_chip.id,
                location_id=loc_main.id,
                batch_number="BATCH-CH-001",
                physical_quantity=60,
                reserved_quantity=0,
                damaged_quantity=0
            )
            # WH-02: Regional Hub has 150 available of Microcontroller (can supply shortage)
            inv3 = Inventory(
                item_id=item_chip.id,
                location_id=loc_reg.id,
                batch_number="BATCH-CH-002",
                physical_quantity=150,
                reserved_quantity=0,
                damaged_quantity=0
            )
            # WH-02: DC Motors
            inv4 = Inventory(
                item_id=item_motor.id,
                location_id=loc_reg.id,
                batch_number="BATCH-MT-001",
                physical_quantity=200,
                reserved_quantity=0,
                damaged_quantity=0
            )
            # PL-01: Bearings
            inv5 = Inventory(
                item_id=item_bear.id,
                location_id=loc_plant.id,
                batch_number="BATCH-BG-001",
                physical_quantity=80,
                reserved_quantity=0,
                damaged_quantity=0
            )
            db.add_all([inv1, inv2, inv3, inv4, inv5])
            db.commit()

            # Record initial audit transactions
            for inv in [inv1, inv2, inv3, inv4, inv5]:
                tx = InventoryTransaction(
                    transaction_type=TransactionTypeEnum.INITIAL,
                    reference_code="SYSTEM_INIT",
                    item_id=inv.item_id,
                    location_id=inv.location_id,
                    batch_number=inv.batch_number,
                    physical_delta=inv.physical_quantity,
                    reserved_delta=0,
                    notes=f"Initial seed stock: {inv.physical_quantity} units"
                )
                db.add(tx)
            db.commit()

        print("[OK] Database seeded successfully.")
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_database()
