"""
Fix media_attachments table to allow nullable message_id
This allows uploading media before the message is created
"""
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_0iCDxtBZeAc4@ep-fragrant-bush-ahwck0la.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

print("🔧 Updating media_attachments table...")

engine = create_engine(DATABASE_URL, echo=True)

with engine.connect() as conn:
    try:
        # Make message_id nullable
        print("\n📝 Making message_id column nullable...")
        conn.execute(text(
            "ALTER TABLE media_attachments ALTER COLUMN message_id DROP NOT NULL;"
        ))
        conn.commit()
        
        print("\n✅ Migration completed successfully!")
        print("   Media can now be uploaded before message creation.")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        raise
