"""
Check what's in the Neon database
"""
from sqlalchemy import create_engine, text, inspect

DATABASE_URL = "postgresql://neondb_owner:npg_0iCDxtBZeAc4@ep-fragrant-bush-ahwck0la.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

print("🔍 Checking Neon database...")

engine = create_engine(DATABASE_URL, echo=False)

with engine.connect() as conn:
    # Check what tables exist
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n📊 Found {len(tables)} tables:")
    for table in tables:
        print(f"  - {table}")
    
    # Check user count
    if 'users' in tables:
        result = conn.execute(text("SELECT COUNT(*) FROM users;"))
        user_count = result.scalar()
        print(f"\n👥 Users in database: {user_count}")
        
        if user_count > 0:
            result = conn.execute(text("SELECT id, email, username FROM users LIMIT 5;"))
            print("\n📋 Sample users:")
            for row in result:
                print(f"  - {row.email} (username: {row.username})")
    else:
        print("\n⚠️  'users' table doesn't exist yet - run the backend to create tables")
    
    # Check messages count
    if 'messages' in tables:
        result = conn.execute(text("SELECT COUNT(*) FROM messages;"))
        msg_count = result.scalar()
        print(f"\n💬 Messages in database: {msg_count}")

print("\n✅ Database check complete!")
