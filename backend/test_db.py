import psycopg2

dsn = "postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

try:
    conn = psycopg2.connect(dsn)
    print("✅ Connected")
    conn.close()
except Exception as e:
    print("❌ Error:", e)
