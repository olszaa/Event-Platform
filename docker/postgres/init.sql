-- Event Platform Database Initialization
-- This script runs automatically when the PostgreSQL container starts for the first time.

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE event_platform TO postgres;

-- Note: Prisma will handle table creation via migrations.
-- Run `npx prisma migrate deploy` after the database is ready.
