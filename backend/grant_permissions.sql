-- Grant all permissions on all tables to message_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO message_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO message_user;
GRANT ALL PRIVILEGES ON DATABASE messenger_app TO message_user;

-- Specifically grant permissions on invitations table
GRANT SELECT, INSERT, UPDATE, DELETE ON invitations TO message_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO message_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO message_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO message_user;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO message_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO message_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO message_user;
