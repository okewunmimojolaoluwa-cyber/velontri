@echo off
REM Velontri frontend — clean install (Windows)
cd /d "%~dp0"
echo Cleaning...
if exist node_modules rmdir /s /q node_modules 2>nul
if exist package-lock.json del /f package-lock.json 2>nul
echo Installing (skip postinstall scripts — safe for paths with spaces)...
call npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 (
  echo.
  echo INSTALL FAILED. Try:
  echo   1. Use Node 20 LTS: nvm install 20 ^&^& nvm use 20
  echo   2. Move project to C:\dev\velontri (no spaces in path)
  echo   3. Run as Administrator if EPERM errors
  exit /b 1
)
echo.
echo Verifying...
call npm run type-check
call npm run test
echo Done.
