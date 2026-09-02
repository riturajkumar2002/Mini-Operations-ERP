import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import User, RoleEnum, Location, Item, Inventory
from app.auth import get_password_hash, create_access_token

# Use isolated SQLite in-memory database with StaticPool for thread-safe test isolation
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Seed test users and foundational data
    admin_user = User(
        email="test_admin@erp.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Admin",
        role=RoleEnum.ADMIN,
        is_active=True
    )
    ops_user = User(
        email="test_ops@erp.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Ops",
        role=RoleEnum.OPERATIONS,
        is_active=True
    )
    sales_user = User(
        email="test_sales@erp.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Sales",
        role=RoleEnum.SALES,
        is_active=True
    )
    session.add_all([admin_user, ops_user, sales_user])
    session.commit()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers(db):
    user = db.query(User).filter(User.email == "test_admin@erp.com").first()
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def ops_headers(db):
    user = db.query(User).filter(User.email == "test_ops@erp.com").first()
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sales_headers(db):
    user = db.query(User).filter(User.email == "test_sales@erp.com").first()
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}
