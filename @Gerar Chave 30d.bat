@echo off
title Criador de Keys NinjaCoin (30 Dias)
color 0E
cd /d "%~dp0"
echo Gerando licenca de 30 dias...
echo.
"C:\Program Files\nodejs\node.exe" keygen.js 30d
echo.
pause
