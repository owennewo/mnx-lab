#!/bin/bash

# Determine the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Stopping frontend and backend servers..."
    # Get PIDs of background jobs
    local pids=$(jobs -p)
    if [ -n "$pids" ]; then
        kill $pids 2>/dev/null
    fi
}

# Run cleanup when the script is interrupted (Ctrl+C) or terminated
trap cleanup EXIT INT TERM

echo "Starting mnx-editor development servers..."

# Start the backend server
echo "Starting backend server (Express)..."
cd "$SCRIPT_DIR/server" && npm start &

# Start the frontend server
echo "Starting frontend server (Vite)..."
cd "$SCRIPT_DIR" && npm run dev &

# Wait for background processes to finish
wait
