@echo off
REM ============================================================
REM Personal Finance - build & package for deployment
REM
REM Usage:
REM   deploy\package.cmd
REM
REM Windows blocks unsigned .ps1 by default, so we bypass the
REM execution policy for this process only (-ExecutionPolicy Bypass).
REM ============================================================
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo [FAILED] packaging failed, see the errors above.
)
endlocal & exit /b %EXITCODE%
