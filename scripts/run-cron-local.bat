@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem =============================================================================
rem LateWiz local cron simulator
rem Calls the same endpoint production cron hits: /api/cron/campaigns
rem
rem Usage:
rem   scripts\run-cron-local.bat
rem   scripts\run-cron-local.bat once
rem   scripts\run-cron-local.bat loop
rem   scripts\run-cron-local.bat loop 60
rem
rem Prerequisites:
rem   1. Dev server running (npm run dev) on BASE_URL
rem   2. CRON_SECRET set in .env or .env.local (optional if empty in env)
rem   3. Deferred campaigns saved with due slots (within generationLeadMinutes)
rem =============================================================================

cd /d "%~dp0\.."

set "BASE_URL=http://localhost:3000"
set "CRON_SECRET=Dan58dokljaha89Hljaf5840ioak3Njs89220930nsdfhknHkjafjkHouia"
set "MODE=once"
set "INTERVAL_SEC=60"

if /I "%~1"=="loop" (
  set "MODE=loop"
  if not "%~2"=="" set "INTERVAL_SEC=%~2"
)
if /I "%~1"=="once" set "MODE=once"
if /I "%~1"=="help" goto :help
if /I "%~1"=="-h" goto :help
if /I "%~1"=="--help" goto :help

call :load_env_var CRON_SECRET
call :load_env_var NEXT_PUBLIC_APP_URL

rem Prefer explicit local override if present
if defined LATEWIZ_CRON_BASE_URL set "BASE_URL=%LATEWIZ_CRON_BASE_URL%"
if defined LATEWIZ_CRON_SECRET set "CRON_SECRET=%LATEWIZ_CRON_SECRET%"

rem If NEXT_PUBLIC_APP_URL is localhost, use it; otherwise keep localhost default
echo.!NEXT_PUBLIC_APP_URL! | findstr /I "localhost 127.0.0.1" >nul
if not errorlevel 1 (
  set "BASE_URL=!NEXT_PUBLIC_APP_URL!"
  if "!BASE_URL:~-1!"=="/" set "BASE_URL=!BASE_URL:~0,-1!"
)

set "URL=!BASE_URL!/api/cron/campaigns"

echo.
echo LateWiz local cron
echo   URL:      !URL!
echo   Mode:     !MODE!
if /I "!MODE!"=="loop" echo   Interval: !INTERVAL_SEC!s
if defined CRON_SECRET (
  echo   Auth:     Bearer ****!CRON_SECRET:~-4!
) else (
  echo   Auth:     none ^(CRON_SECRET empty — allowed only if server has no CRON_SECRET^)
)
echo.

:run_once
echo [%date% %time%] Calling cron...
set "TMP_OUT=%TEMP%\latewiz-cron-out.txt"
set "TMP_ERR=%TEMP%\latewiz-cron-err.txt"

if defined CRON_SECRET (
  curl.exe -sS -X POST "!URL!" ^
    -H "Authorization: Bearer !CRON_SECRET!" ^
    -H "Content-Type: application/json" ^
    -o "!TMP_OUT!" -w "HTTP %%{http_code}" 2>"!TMP_ERR!"
) else (
  curl.exe -sS -X POST "!URL!" ^
    -H "Content-Type: application/json" ^
    -o "!TMP_OUT!" -w "HTTP %%{http_code}" 2>"!TMP_ERR!"
)

echo.
if exist "!TMP_OUT!" (
  echo Response:
  type "!TMP_OUT!"
  echo.
)
if exist "!TMP_ERR!" (
  for %%A in ("!TMP_ERR!") do if %%~zA gtr 0 (
    echo Curl stderr:
    type "!TMP_ERR!"
    echo.
  )
)

if /I "!MODE!"=="once" goto :eof

echo Waiting !INTERVAL_SEC!s before next run... ^(Ctrl+C to stop^)
timeout /t !INTERVAL_SEC! /nobreak >nul
goto :run_once

:help
echo.
echo Usage:
echo   scripts\run-cron-local.bat              Run once against http://localhost:3000
echo   scripts\run-cron-local.bat once         Same as above
echo   scripts\run-cron-local.bat loop         Poll every 60 seconds
echo   scripts\run-cron-local.bat loop 30      Poll every 30 seconds
echo.
echo Env overrides ^(optional^):
echo   set LATEWIZ_CRON_BASE_URL=http://localhost:3000
echo   set LATEWIZ_CRON_SECRET=your-secret
echo.
echo Reads CRON_SECRET from .env or .env.local in the repo root.
echo Make sure npm run dev is running, then save a deferred campaign with due slots.
echo.
exit /b 0

rem -----------------------------------------------------------------------------
rem Load KEY=value from .env.local then .env ^(first match wins per file order^)
rem -----------------------------------------------------------------------------
:load_env_var
set "KEY=%~1"
set "_VAL="
if exist ".env.local" call :parse_env_file ".env.local" "%KEY%"
if defined _VAL (
  set "%KEY%=!_VAL!"
  goto :eof
)
if exist ".env" call :parse_env_file ".env" "%KEY%"
if defined _VAL set "%KEY%=!_VAL!"
goto :eof

:parse_env_file
set "_FILE=%~1"
set "_WANT=%~2"
set "_VAL="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("!_FILE!") do (
  set "_K=%%A"
  set "_V=%%B"
  rem trim spaces around key
  for /f "tokens=* delims= " %%T in ("!_K!") do set "_K=%%T"
  if /I "!_K!"=="!_WANT!" (
    rem strip surrounding quotes
    if defined _V (
      if "!_V:~0,1!"=="""" if "!_V:~-1!"=="""" set "_V=!_V:~1,-1!"
      rem strip inline comments after value ^(simple: space+#^)
      for /f "tokens=1 delims=#" %%C in ("!_V!") do set "_V=%%C"
      for /f "tokens=* delims= " %%T in ("!_V!") do set "_V=%%T"
      set "_VAL=!_V!"
    )
  )
)
goto :eof
