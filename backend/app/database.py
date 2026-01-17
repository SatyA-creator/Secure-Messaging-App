from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Prepare connection arguments based on database type
connect_args = {}
pool_pre_ping = True
pool_recycle = 3600

if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
elif "postgresql" in settings.DATABASE_URL or "postgres" in settings.DATABASE_URL:
    # Check if using PgBouncer (Supabase Session Pooler)
    is_pgbouncer = "pgbouncer=true" in settings.DATABASE_URL or "pooler.supabase.com" in settings.DATABASE_URL
    
    if is_pgbouncer:
        # PgBouncer/Supabase Pooler specific settings
        logger.info("🔄 Detected PgBouncer/Supabase Pooler - using optimized settings")
        connect_args = {
            "connect_timeout": 60,  # Increased timeout for Render
            "application_name": "messaging-app-render",
            "sslmode": "require",  # Force SSL for Supabase
        }
        # Disable pre_ping with PgBouncer (it doesn't work well)
        pool_pre_ping = False
        pool_recycle = 300  # Recycle connections more frequently (5 minutes)
    else:
        # Direct PostgreSQL connection settings
        logger.info("🔗 Using direct PostgreSQL connection")
        connect_args = {
            "connect_timeout": 30,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        }

# Create engine with optimized settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=pool_pre_ping,
    pool_recycle=pool_recycle,
    echo=settings.DEBUG,
    connect_args=connect_args
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# Create tables
def init_db():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")