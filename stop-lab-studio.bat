@echo off
setlocal EnableExtensions

set "PACKAGE_DIR=%~dp0"
if "%PACKAGE_DIR:~-1%"=="\" set "PACKAGE_DIR=%PACKAGE_DIR:~0,-1%"
set "SERVER_SCRIPT=%PACKAGE_DIR%\_lab-studio-preview-server.mjs"
set "STATE_FILE=%PACKAGE_DIR%\logs\preview-state.json"

if not exist "%SERVER_SCRIPT%" (
  echo [Lab Studio] The packaged preview server is missing.
  exit /b 1
)

set "NODE_EXE="
for /f "usebackq delims=" %%N in (`where node 2^>nul`) do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo [Lab Studio] Node.js was not found on PATH.
  exit /b 1
)

pushd "%PACKAGE_DIR%"
"%NODE_EXE%" "_lab-studio-preview-server.mjs" --stop --state-file "logs\preview-state.json"
set "STOP_CODE=%ERRORLEVEL%"
popd
exit /b %STOP_CODE%
