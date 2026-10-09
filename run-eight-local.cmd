@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
where deno >nul 2>&1
if errorlevel 1 (
  echo Deno is not installed. It is FREE.
  echo Open Windows Terminal and type: winget install DenoLand.Deno
  echo Then reopen this script. No Replit credits needed.
  pause
  exit /b 1
)
if "%~8"=="" (
 echo Select the eight original JPG photos, then drag them TOGETHER onto this CMD file.
 pause
 exit /b 2
)
echo Starting PRIVATE OMR read-only test of eight photos ...
deno run --allow-read --allow-write qa\omr\local-eight.ts %*
echo.
echo Results are in this folder: omr-eight-result.csv and omr-eight-result.json
pause
