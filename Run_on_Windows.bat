@echo off
echo Starting Media Tracker...
cd /d "%~dp0"

IF NOT EXIST venv_win (
    echo [MediaTracker] First time setup: Creating virtual environment...
    python -m venv venv_win
)

call venv_win\Scripts\activate.bat

echo [MediaTracker] Ensuring dependencies are installed...
pip install -r requirements.txt > nul

echo [MediaTracker] Running Security Shield & Database Audit...
python health_check.py --fix

echo [MediaTracker] Opening browser...
start http://127.0.0.1:8000

echo [MediaTracker] Killing any stale process on port 8000...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') DO taskkill /PID %%P /F 2>nul

echo [MediaTracker] Starting Server...
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
