#!/bin/bash
# Run database migrations before starting the server
set -e

echo "🔄 Running database migrations..."
python -m alembic upgrade head

echo "✅ Migrations completed successfully"
