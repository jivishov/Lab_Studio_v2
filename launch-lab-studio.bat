@echo off
setlocal EnableExtensions

set "PACKAGE_DIR=%~dp0"
if "%PACKAGE_DIR:~-1%"=="\" set "PACKAGE_DIR=%PACKAGE_DIR:~0,-1%"
set "BUILD_RECORD=%PACKAGE_DIR%\_lab-studio-build.json"
set "SERVER_SCRIPT=%PACKAGE_DIR%\_lab-studio-preview-server.mjs"
set "LAUNCH_HELPER=%PACKAGE_DIR%\_lab-studio-preview-launcher.ps1"
set "LAB_STUDIO_URL=http://127.0.0.1:4180/"

if not exist "%BUILD_RECORD%" (
  call :fail "This is not a packaged Item 3 build. Run scripts\buildItem3HumanTest.mjs from the repository first."
  exit /b 1
)
if not exist "%SERVER_SCRIPT%" (
  call :fail "The packaged preview server is missing. Rebuild the Item 3 package."
  exit /b 1
)
if not exist "%LAUNCH_HELPER%" (
  call :fail "The packaged preview launcher is missing. Rebuild the Item 3 package."
  exit /b 1
)

set "NODE_EXE="
for /f "usebackq delims=" %%N in (`where node 2^>nul`) do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  call :fail "Node.js was not found on PATH. Install Node.js, open a new terminal, and run this launcher again."
  exit /b 1
)

set "LAB_STUDIO_BUILD_RECORD=%BUILD_RECORD%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%LAUNCH_HELPER%" -PackageDirectory "%PACKAGE_DIR%"
if errorlevel 1 (
  call :fail "The preview process could not be started. Check logs\preview-process.stderr.log."
  exit /b 1
)

echo Starting Lab Studio Item 3 production preview...
set "LAUNCH_FAILURE="
for /L %%A in (1,1,45) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$record=Get-Content -Raw -LiteralPath $env:LAB_STUDIO_BUILD_RECORD | ConvertFrom-Json; try { Invoke-WebRequest -UseBasicParsing -Uri $env:LAB_STUDIO_URL -TimeoutSec 2 | Out-Null } catch { exit 1 }; try { $health=Invoke-RestMethod -UseBasicParsing -Uri ($env:LAB_STUDIO_URL + '__lab-studio/health') -TimeoutSec 2 } catch { exit 3 }; if ($health.app -ne 'lab-studio' -or $health.buildId -ne $record.buildId) { exit 3 }; exit 0"
  if not errorlevel 1 (
    set "LAUNCH_FAILURE="
    goto :preview_ready
  )
  if errorlevel 3 (
    set "LAUNCH_FAILURE=Port 4180 is occupied by an unrelated service or a different Lab Studio build. Nothing was stopped."
    goto :preview_failed
  )
  powershell -NoProfile -Command "Start-Sleep -Seconds 1"
)

set "LAUNCH_FAILURE=Lab Studio did not become available at %LAB_STUDIO_URL%. Check logs\preview.log and logs\preview-process.stderr.log."

:preview_failed
call :fail "%LAUNCH_FAILURE%"
exit /b 1

:preview_ready
start "" "%LAB_STUDIO_URL%"
echo Lab Studio is ready at %LAB_STUDIO_URL%
exit /b 0

:fail
echo [Lab Studio] %~1
if not defined LAB_STUDIO_NO_PAUSE pause
exit /b 1
