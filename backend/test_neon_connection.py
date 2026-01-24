"""
Test Neon database connection
Run this to verify your Neon database connection works
"""
import os
from sqlalchemy import create_engine, text

# Your Neon connection string
DATABASE_URL = "postgresql://neondb_owner:npg_0iCDxtBZeAc4@ep-fragrant-bush-ahwck0la.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

print("🔍 Testing Neon database connection...")
print(f"📍 Database URL: {DATABASE_URL[:50]}...")

try:
    # Create engine
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=True
    )
    
    # Test connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version();"))
        version = result.fetchone()[0]
        print(f"\n✅ CONNECTION SUCCESSFUL!")
        print(f"📊 PostgreSQL Version: {version[:50]}...")
        
        # Test table creation
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS test_table (
                id SERIAL PRIMARY KEY,
                message TEXT
            );
        """))
        conn.commit()
        print(f"✅ Table creation test passed")
        
        # Clean up test table
        conn.execute(text("DROP TABLE IF EXISTS test_table;"))
        conn.commit()
        print(f"✅ All tests passed!\n")
        
except Exception as e:
    print(f"\n❌ CONNECTION FAILED!")
    print(f"Error: {e}\n")
    print("📋 Checklist:")
    print("  1. Did you replace the DATABASE_URL above with your actual Neon URL?")
    print("  2. Does the URL include ?sslmode=require at the end?")
    print("  3. Is your Neon database active? (Check Neon console)")
    print("  4. Did you copy the ENTIRE connection string including password?")
