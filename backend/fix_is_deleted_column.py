"""
Convert is_deleted column from INTEGER to BOOLEAN
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_is_deleted_column():
    """Convert is_deleted from INTEGER to BOOLEAN"""
    
    # Get database connection string
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return
    
    # Handle both postgres:// and postgresql:// schemes
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    print(f"🔗 Connecting to database...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        print("✅ Connected to database")
        
        # Check current column type
        cursor.execute("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = 'is_deleted'
        """)
        
        result = cursor.fetchone()
        if result:
            current_type = result[0]
            print(f"📊 Current is_deleted type: {current_type}")
            
            if current_type == 'integer':
                print("🔄 Converting is_deleted from INTEGER to BOOLEAN...")
                
                # Step 1: Drop the default constraint first
                cursor.execute("""
                    ALTER TABLE messages 
                    ALTER COLUMN is_deleted DROP DEFAULT
                """)
                print("  ✅ Dropped default constraint")
                
                # Step 2: Convert the column type
                cursor.execute("""
                    ALTER TABLE messages 
                    ALTER COLUMN is_deleted 
                    TYPE BOOLEAN 
                    USING CASE WHEN is_deleted = 0 THEN FALSE ELSE TRUE END
                """)
                print("  ✅ Converted column to BOOLEAN")
                
                # Step 3: Set new default value
                cursor.execute("""
                    ALTER TABLE messages 
                    ALTER COLUMN is_deleted SET DEFAULT FALSE
                """)
                print("  ✅ Set new default to FALSE")
                
                conn.commit()
                print("✅ Successfully converted is_deleted to BOOLEAN")
            else:
                print(f"✅ is_deleted is already {current_type}")
        else:
            print("❌ is_deleted column not found")
        
        # Verify the change
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name IN ('is_read', 'is_deleted')
            ORDER BY column_name
        """)
        
        print("\n📋 Final column types:")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} (nullable: {row[2]})")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
        raise

if __name__ == "__main__":
    fix_is_deleted_column()
