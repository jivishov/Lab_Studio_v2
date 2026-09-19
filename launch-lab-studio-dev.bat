@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "LAB_STUDIO_URL=http://127.0.0.1:5175/"

where npm >nul 2>nul
if errorlevel 1 (
  echo [Lab Studio] npm was not found on PATH. Install Node.js and npm, then run this file again.
  exit /b 1
)

start "Lab Studio Dev Server" cmd /k "cd /d ""%~dp0"" && set ""VITE_ASSAY_STUDIO_V1=true"" && set ""VITE_CAUSALYST_LOCAL_V1=true"" && npm run dev"
echo Starting Lab Studio development server at %LAB_STUDIO_URL%
exit /b 0
