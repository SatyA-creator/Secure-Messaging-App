from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from app.config import settings
import logging
import time

logger = logging.getLogger(__name__)

# Prepare connection arguments based on database type
connect_args = {}
pool_pre_ping = True
pool_recycle = 3600

if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
elif "postgresql" in settings.DATABASE_URL or "postgres" in settings.DATABASE_URL:
    # Check if using pgbouncer (Supabase Transaction Pooler) or Neon pooled connection
    is_pgbouncer = "pgbouncer=true" in settings.DATABASE_URL or "6543" in settings.DATABASE_URL
    is_neon_pooled = "-pooler" in settings.DATABASE_URL
    
    if is_pgbouncer or is_neon_pooled:
        # PgBouncer/Transaction Pooler or Neon pooled connection settings
        pooler_type = "Neon pooled connection" if is_neon_pooled else "Supabase Transaction Pooler (pgbouncer)"
        logger.info(f"🔄 Using {pooler_type}")
        connect_args = {
            "connect_timeout": 15,
            "application_name": "messaging-app",
        }
        # CRITICAL: Disable pool_pre_ping with poolers
        pool_pre_ping = False
        pool_recycle = 300  # 5 minutes
    else:
        # Direct PostgreSQL connection (port 5432)
        logger.info("🔗 Using direct PostgreSQL connection - port 5432")
        connect_args = {
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000",
        }
        pool_pre_ping = True
        pool_recycle = 300

# Get pool settings from environment or use defaults
pool_size = settings.DATABASE_POOL_SIZE if settings.DATABASE_POOL_SIZE > 0 else 1
max_overflow = settings.DATABASE_MAX_OVERFLOW if settings.DATABASE_MAX_OVERFLOW >= 0 else 0

logger.info(f"📊 Database pool settings: size={pool_size}, overflow={max_overflow}")

# Create engine with optimized settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=pool_size,
    max_overflow=max_overflow,
    pool_pre_ping=pool_pre_ping,
    pool_recycle=pool_recycle,
    echo=settings.DEBUG,
    connect_args=connect_args,
    pool_timeout=30,
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

# Create tables with retry logic
def init_db():
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting to initialize database (attempt {attempt + 1}/{max_retries})...")
            Base.metadata.create_all(bind=engine)
            logger.info("✅ Database tables initialized successfully")
            return
        except Exception as e:
            logger.error(f"❌ Database initialization failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("❌ All database initialization attempts failed")
                raise