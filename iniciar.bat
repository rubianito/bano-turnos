@echo off
title BanoTurnos - Servidor de Turnos
echo ==============================================
echo   Iniciando BanoTurnos en http://localhost:3000
echo ==============================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
  start http://localhost:3000
  node server.js
) else (
  if exist "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe" (
    start http://localhost:3000
    "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe" server.js
  ) else (
    echo [ERROR] No se encontro Node.js instalado.
    pause
  )
)
