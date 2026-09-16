@echo off
setlocal

cd /d "%~dp0"
set "LAB_STUDIO_URL=http://127.0.0.1:5175"
set "VITE_ASSAY_STUDIO_V1=true"
set "VITE_CAUSALYST_LOCAL_V1=true"

rem Reuse an existing server only when it already has the local feature flags.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$base='%LAB_STUDIO_URL%'; try { $source=(Invoke-WebRequest -UseBasicParsing -Uri ($base + '/src/platform/featureFlags.ts') -TimeoutSec 2).Content; $assay=$source -match '\"VITE_ASSAY_STUDIO_V1\"\s*:\s*\"true\"'; $causalyst=$source -match '\"VITE_CAUSALYST_LOCAL_V1\"\s*:\s*\"true\"'; if ($assay -and $causalyst) { exit 0 }; exit 2 } catch { exit 1 }"
set "LAB_STUDIO_SERVER_STATUS=%ERRORLEVEL%"

if "%LAB_STUDIO_SERVER_STATUS%"=="0" (
  start "" "%LAB_STUDIO_URL%"
  exit /b 0
)

if "%LAB_STUDIO_SERVER_STATUS%"=="2" (
  echo Lab Studio is already running without the Assay Studio and Causalyst flags.
  echo Close the existing "Lab Studio Dev Server" window, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Lab Studio could not start because npm was not found.
  echo Install Node.js and npm, then run this file again.
  pause
  exit /b 1
)

start "Lab Studio Dev Server" cmd /k "cd /d ""%~dp0"" && set ""VITE_ASSAY_STUDIO_V1=true"" && set ""VITE_CAUSALYST_LOCAL_V1=true"" && npm run dev"

echo Starting Lab Studio...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$uri='%LAB_STUDIO_URL%'; for ($attempt=0; $attempt -lt 60; $attempt++) { try { Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 2 | Out-Null; Start-Process $uri; exit 0 } catch { Start-Sleep -Seconds 1 } }; Write-Error 'Lab Studio did not become available within 60 seconds.'; exit 1"

if errorlevel 1 (
  echo.
  echo Check the "Lab Studio Dev Server" window for startup errors.
  pause
  exit /b 1
)

exit /b 0
