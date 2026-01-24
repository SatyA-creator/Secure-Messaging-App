"""
Update admin user role in Neon database
"""
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_0iCDxtBZeAc4@ep-fragrant-bush-ahwck0la.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

print("🔧 Updating admin user role...")

engine = create_engine(DATABASE_URL, echo=False)

with engine.connect() as conn:
    # Check current role
    result = conn.execute(text(
        "SELECT email, username, role FROM users WHERE email = 'admin@quantchat.com';"
    ))
    user = result.fetchone()
    
    if user:
        print(f"\n📋 Current user info:")
        print(f"  Email: {user.email}")
        print(f"  Username: {user.username}")
        print(f"  Current role: {user.role}")
        
        # Update role to admin
        conn.execute(text(
            "UPDATE users SET role = 'admin' WHERE email = 'admin@quantchat.com';"
        ))
        conn.commit()
        
        # Verify update
        result = conn.execute(text(
            "SELECT email, username, role FROM users WHERE email = 'admin@quantchat.com';"
        ))
        updated_user = result.fetchone()
        
        print(f"\n✅ Updated user info:")
        print(f"  Email: {updated_user.email}")
        print(f"  Username: {updated_user.username}")
        print(f"  New role: {updated_user.role}")
        
        print("\n🎉 Admin role updated successfully!")
        print("   You can now login and access the admin dashboard.")
    else:
        print("\n❌ Admin user not found in database!")
        print("   Please make sure admin@quantchat.com exists.")
