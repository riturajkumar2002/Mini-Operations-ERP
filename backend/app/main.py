from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, SessionLocal
from .seed import seed_database
from .routers import auth, locations, inventory, work_orders, transfers, orders


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and seed demo data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    # Shutdown: Clean up resources if necessary


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
# Mini Operations ERP REST API

A production-oriented Operations ERP backend supporting:
- **Authentication & Role-Based Authorization** (`Admin`, `Operations User`, `Sales User`)
- **Inventory Management** (Physical, Reserved, Available stock, transactional adjustments)
- **Work Orders & Material Stock Check** (Automatic shortage calculations & surplus location detection)
- **Internal Stock Transfers** (State-machine: Requested → Dispatched → Received with idempotency & double-receipt protection)
- **Customer Orders & Stock Reservation** (ACID database transactions & race-condition safe reservations)
""",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production-ready for localhost dev and preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(locations.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(work_orders.router, prefix=settings.API_V1_STR)
app.include_router(transfers.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "redoc": "/redoc",
        "api_v1": settings.API_V1_STR
    }


@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": "operations-erp-backend"}
