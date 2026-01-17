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
    # For Supabase with Render, use direct connection with SSL
    logger.info("🔗 Configuring PostgreSQL connection for Render + Supabase")
    connect_args = {
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000",  # 30 second query timeout
    }
    pool_pre_ping = True
    pool_recycle = 300  # Recycle every 5 minutes

# Create engine with optimized settings for Render
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,  # Reduced for Render free tier
    max_overflow=10,  # Reduced overflow
    pool_pre_ping=pool_pre_ping,
    pool_recycle=pool_recycle,
    echo=settings.DEBUG,
    connect_args=connect_args,
    pool_timeout=30,  # Wait up to 30s for connection from pool
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