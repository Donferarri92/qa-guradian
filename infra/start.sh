#!/bin/sh
set -e

echo "Starting QA Guardian..."

# Run database migrations
echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy

# Start backend in background
echo "Starting backend API..."
node dist/server.js &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd /app/frontend
npm start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
