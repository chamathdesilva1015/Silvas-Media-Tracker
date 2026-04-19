#!/bin/bash
echo "Starting Media Tracker..."
cd "$(dirname "$0")"

if [ ! -d "venv_mac" ]; then
    echo "[MediaTracker] First time setup: Creating virtual environment..."
    python3 -m venv venv_mac
fi

source venv_mac/bin/activate

echo "[MediaTracker] Ensuring dependencies are installed..."
pip install -r requirements.txt > /dev/null

echo "[MediaTracker] Running Security Shield & Database Audit..."
python3 health_check.py --fix

echo "[MediaTracker] Opening browser..."
open http://127.0.0.1:8000

echo "[MediaTracker] Killing any stale process on port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

echo "[MediaTracker] Starting Server..."
uvicorn main:app --host 0.0.0.0 --port 8000
