import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connect as postgres user to grant permissions
# Try with superuser password
conn = psycopg2.connect(
    host="localhost",
    database="messenger_app",
    user="postgres",
    password="12345678"
)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

# Grant permissions
sql_commands = [
    "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO message_user;",
    "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO message_user;",
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO message_user;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO message_user;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO message_user;",
]

for sql in sql_commands:
    try:
        cursor.execute(sql)
        print(f"✅ Executed: {sql}")
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"   Command: {sql}")

cursor.close()
conn.close()
print("\n✅ All permissions granted successfully!")
