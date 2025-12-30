#!/usr/bin/env python3
"""
Convert encrypted_content and encrypted_session_key from BYTEA to TEXT
"""

from app.database import engine
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def convert_to_text():
    """Convert BYTEA columns to TEXT for compatibility"""
    
    fixes = [
        # Convert encrypted_content from BYTEA to TEXT
        """
        DO $$ 
        BEGIN 
            ALTER TABLE messages ALTER COLUMN encrypted_content TYPE TEXT;
            RAISE NOTICE 'Converted encrypted_content to TEXT';
        EXCEPTION 
            WHEN others THEN 
                RAISE NOTICE 'Could not convert encrypted_content: %', SQLERRM;
        END $$;
        """,
        
        # Convert encrypted_session_key from BYTEA to TEXT
        """
        DO $$ 
        BEGIN 
            ALTER TABLE messages ALTER COLUMN encrypted_session_key TYPE TEXT;
            RAISE NOTICE 'Converted encrypted_session_key to TEXT';
        EXCEPTION 
            WHEN others THEN 
                RAISE NOTICE 'Could not convert encrypted_session_key: %', SQLERRM;
        END $$;
        """,
    ]
    
    with engine.connect() as conn:
        logger.info("🔧 Converting BYTEA columns to TEXT...")
        
        for i, fix_sql in enumerate(fixes, 1):
            try:
                logger.info(f"Applying conversion {i}/{len(fixes)}...")
                conn.execute(text(fix_sql))
                conn.commit()
                logger.info(f"✅ Conversion {i} applied successfully")
            except Exception as e:
                logger.error(f"❌ Error applying conversion {i}: {e}")
                conn.rollback()
                raise
        
        # Verify the schema
        logger.info("📋 Verifying schema...")
        result = conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name IN ('encrypted_content', 'encrypted_session_key')
            ORDER BY ordinal_position
        """))
        
        logger.info("Current column types:")
        for row in result:
            logger.info(f"  - {row[0]}: {row[1]}")
        
        logger.info("✅ Conversion complete!")

if __name__ == "__main__":
    try:
        convert_to_text()
    except Exception as e:
        logger.error(f"❌ Conversion failed: {e}")
        exit(1)
