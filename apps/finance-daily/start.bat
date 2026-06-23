@echo off
cd /d "%~dp0"
node node_modules\vite\bin\vite.js --port 5173 --host 0.0.0.0
pause
