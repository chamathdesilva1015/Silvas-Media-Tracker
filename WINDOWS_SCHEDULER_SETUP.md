# 🎬 Windows Task Scheduler Setup: Retroactive Auditor

To ensure your Auditor scans for gaps every night without you having to click anything, follow these steps to set up a Windows Task:

### 1. Identify your Python Path
Find where your python executable is (e.g., `C:\Users\Name\AppData\Local\Programs\Python\Python311\python.exe` or your virtualenv path).

### 2. Create the Task
1. Open **Task Scheduler** on Windows.
2. Click **Create Basic Task...** on the right.
3. **Name**: `Media Tracker Auditor`
4. **Trigger**: `Daily` (Set it to 3:00 AM).
5. **Action**: `Start a Program`.

### 3. Configure the Action
*   **Program/script**: `python` (or the full path to your python.exe)
*   **Add arguments**: `run_audit_cli.py`
*   **Start in**: The full path to your `media-tracker` folder (e.g., `C:\Coding\media-tracker`)

### 4. Alternative: Use the In-App Scheduler
The web server (`main.py`) already has a built-in scheduler that runs at 3 AM. If you keep your PC on and the server running, you don't need to do anything! 

The Windows Task Scheduler is only necessary if you want the scan to run even when the web server is closed.

---
**Tip**: If you want to run a scan manually from the terminal right now, just run:
```bash
python run_audit_cli.py
```
