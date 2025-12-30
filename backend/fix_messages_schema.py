#!/usr/bin/env python3
"""
Fix messages table schema to match the Message model
Adds encrypted_session_key column and removes content column
"""

from app.database import engine
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_messages_schema():
    """Apply schema fixes to messages table"""
    
    fixes = [
        # Add encrypted_session_key column if it doesn't exist
        """
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='encrypted_session_key'
            ) THEN
                ALTER TABLE messages ADD COLUMN encrypted_session_key BYTEA;
                RAISE NOTICE 'Added encrypted_session_key column';
            ELSE
                RAISE NOTICE 'encrypted_session_key column already exists';
            END IF;
        END $$;
        """,
        
        # Update existing rows to have a default encrypted_session_key
        """
        UPDATE messages 
        SET encrypted_session_key = E'\\\\x64656661756c742d6b6579'::bytea 
        WHERE encrypted_session_key IS NULL;
        """,
        
        # Make encrypted_session_key NOT NULL
        """
        DO $$ 
        BEGIN 
            ALTER TABLE messages ALTER COLUMN encrypted_session_key SET NOT NULL;
        EXCEPTION 
            WHEN others THEN 
                RAISE NOTICE 'Could not set encrypted_session_key to NOT NULL: %', SQLERRM;
        END $$;
        """,
        
        # Add is_deleted column if it doesn't exist
        """
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='is_deleted'
            ) THEN
                ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;
                RAISE NOTICE 'Added is_deleted column';
            ELSE
                RAISE NOTICE 'is_deleted column already exists';
            END IF;
        END $$;
        """,
        
        # Drop old 'content' column if it exists
        """
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='messages' AND column_name='content'
            ) THEN
                ALTER TABLE messages DROP COLUMN content;
                RAISE NOTICE 'Dropped content column';
            ELSE
                RAISE NOTICE 'content column does not exist';
            END IF;
        END $$;
        """
    ]
    
    with engine.connect() as conn:
        logger.info("🔧 Starting messages table schema fix...")
        
        for i, fix_sql in enumerate(fixes, 1):
            try:
                logger.info(f"Applying fix {i}/{len(fixes)}...")
                conn.execute(text(fix_sql))
                conn.commit()
                logger.info(f"✅ Fix {i} applied successfully")
            except Exception as e:
                logger.error(f"❌ Error applying fix {i}: {e}")
                conn.rollback()
                raise
        
        # Verify the schema
        logger.info("📋 Verifying schema...")
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            ORDER BY ordinal_position
        """))
        
        logger.info("Current messages table schema:")
        for row in result:
            logger.info(f"  - {row[0]}: {row[1]} (nullable: {row[2]})")
        
        logger.info("✅ Schema fix complete!")

if __name__ == "__main__":
    try:
        fix_messages_schema()
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        exit(1)
