import os
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta

# Use the staging database URL
DATABASE_URL = "postgresql://neondb_owner:npg_xilR5DOvCjf6@ep-orange-surf-ahq9lioj.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Check total messages
    result = conn.execute(text("SELECT COUNT(*) FROM messages"))
    total = result.scalar()
    print(f"\n📊 Total messages in database: {total}")
    
    # Check recent messages (last hour)
    result = conn.execute(text("""
        SELECT id, sender_id, recipient_id, encrypted_content, created_at 
        FROM messages 
        WHERE created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC 
        LIMIT 10
    """))
    recent = result.fetchall()
    
    print(f"\n📥 Messages from last hour: {len(recent)}")
    for msg in recent:
        print(f"  - {msg.created_at}: {msg.sender_id} → {msg.recipient_id}")
        print(f"    Content: {msg.encrypted_content[:50]}...")
    
    # Check if tables exist
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """))
    tables = result.fetchall()
    
    print(f"\n📋 Database tables:")
    for table in tables:
        print(f"  - {table.table_name}")
