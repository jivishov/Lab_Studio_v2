@echo off
setlocal EnableExtensions

rem Launches Lab Studio 3D: starts the Vite development server for this folder in its own window,
rem waits until it answers, then opens the first 3D simulation (Weighing) in the default browser. The title
rem menu in the player switches between the 3D simulations; Studio 3D is at #/3d/studio.
rem If Lab Studio is already being served on the port, it only opens the browser.

cd /d "%~dp0"
set "LAB_STUDIO_3D_PORT=5182"
set "LAB_STUDIO_3D_URL=http://127.0.0.1:%LAB_STUDIO_3D_PORT%/"
set "LAB_STUDIO_3D_PAGE=%LAB_STUDIO_3D_URL%#/3d/technique/weighing"
rem The 3D app is built only with this switch on; the server window inherits it.
set "VITE_STUDIO_3D_V1=true"

where npm >nul 2>nul
if errorlevel 1 (
  call :fail "npm was not found on PATH. Install Node.js and npm, then run this file again."
  exit /b 1
)
if not exist "node_modules\" (
  call :fail "Dependencies are not installed. Run npm install in this folder first."
  exit /b 1
)

call :ping
if not errorlevel 1 goto :ready

start "Lab Studio 3D Dev Server" cmd /k npx vite --host 127.0.0.1 --port %LAB_STUDIO_3D_PORT% --strictPort
echo Starting Lab Studio 3D at %LAB_STUDIO_3D_URL% ...

for /L %%A in (1,1,60) do (
  call :ping
  if not errorlevel 1 goto :ready
  powershell -NoProfile -Command "Start-Sleep -Seconds 1"
)
call :fail "Lab Studio 3D did not start within a minute. Check the Lab Studio 3D Dev Server window."
exit /b 1

:ready
start "" "%LAB_STUDIO_3D_PAGE%"
echo Lab Studio 3D is open at %LAB_STUDIO_3D_PAGE%
echo Close the "Lab Studio 3D Dev Server" window to stop it.
exit /b 0

:ping
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri $env:LAB_STUDIO_3D_URL -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
exit /b %ERRORLEVEL%

:fail
echo [Lab Studio 3D] %~1
pause
exit /b 1
