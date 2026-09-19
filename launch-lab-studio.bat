@echo off
setlocal EnableExtensions

set "PACKAGE_DIR=%~dp0"
if "%PACKAGE_DIR:~-1%"=="\" set "PACKAGE_DIR=%PACKAGE_DIR:~0,-1%"
set "BUILD_RECORD=%PACKAGE_DIR%\_lab-studio-build.json"
set "SERVER_SCRIPT=%PACKAGE_DIR%\_lab-studio-preview-server.mjs"
set "STATE_FILE=%PACKAGE_DIR%\logs\preview-state.json"
set "LOG_FILE=%PACKAGE_DIR%\logs\preview.log"
set "LAB_STUDIO_URL=http://127.0.0.1:4180/"

if not exist "%BUILD_RECORD%" (
  call :fail "This is not a packaged Item 3 build. Run scripts\buildItem3HumanTest.mjs from the repository first."
  exit /b 1
)
if not exist "%SERVER_SCRIPT%" (
  call :fail "The packaged preview server is missing. Rebuild the Item 3 package."
  exit /b 1
)

set "NODE_EXE="
for /f "usebackq delims=" %%N in (`where node 2^>nul`) do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  call :fail "Node.js was not found on PATH. Install Node.js, open a new terminal, and run this launcher again."
  exit /b 1
)

set "LAB_STUDIO_PACKAGE_DIR=%PACKAGE_DIR%"
set "LAB_STUDIO_BUILD_RECORD=%BUILD_RECORD%"
set "LAB_STUDIO_NODE=%NODE_EXE%"
set "LAB_STUDIO_SERVER=%SERVER_SCRIPT%"
set "LAB_STUDIO_STATE=%STATE_FILE%"
set "LAB_STUDIO_LOG=%LOG_FILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $record=Get-Content -Raw -LiteralPath $env:LAB_STUDIO_BUILD_RECORD | ConvertFrom-Json; if ($record.launch.url -ne 'http://127.0.0.1:4180/') { throw 'The build record does not target the required loopback URL.' }; $arguments='"' + $env:LAB_STUDIO_SERVER + '" --root "' + $env:LAB_STUDIO_PACKAGE_DIR + '" --port 4180 --expected-build-id "' + $record.buildId + '" --state-file "' + $env:LAB_STUDIO_STATE + '" --log-file "' + $env:LAB_STUDIO_LOG + '"'; Start-Process -FilePath $env:LAB_STUDIO_NODE -ArgumentList $arguments -WorkingDirectory $env:LAB_STUDIO_PACKAGE_DIR -WindowStyle Hidden | Out-Null"
if errorlevel 1 (
  call :fail "The preview process could not be started. Check logs\preview.log."
  exit /b 1
)

echo Starting Lab Studio Item 3 production preview...
for /L %%A in (1,1,45) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$record=Get-Content -Raw -LiteralPath $env:LAB_STUDIO_BUILD_RECORD | ConvertFrom-Json; try { Invoke-WebRequest -UseBasicParsing -Uri $env:LAB_STUDIO_URL -TimeoutSec 2 | Out-Null } catch { exit 1 }; try { $health=Invoke-RestMethod -UseBasicParsing -Uri ($env:LAB_STUDIO_URL + '__lab-studio/health') -TimeoutSec 2 } catch { exit 3 }; if ($health.app -ne 'lab-studio' -or $health.buildId -ne $record.buildId) { exit 3 }; exit 0"
  if not errorlevel 1 (
    start "" "%LAB_STUDIO_URL%"
    echo Lab Studio is ready at %LAB_STUDIO_URL%
    exit /b 0
  )
  if errorlevel 3 (
    call :fail "Port 4180 is occupied by an unrelated service or a different Lab Studio build. Nothing was stopped."
    exit /b 1
  )
  timeout /t 1 /nobreak >nul
)

call :fail "Lab Studio did not become available at %LAB_STUDIO_URL%. Check logs\preview.log."
exit /b 1

:fail
echo [Lab Studio] %~1
if not defined LAB_STUDIO_NO_PAUSE pause
exit /b 1
