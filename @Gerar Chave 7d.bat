@echo off
title Criador de Keys NinjaCoin (7 Dias)
color 0B
cd /d "%~dp0"
echo Gerando licenca de 7 dias...
echo.
"C:\Program Files\nodejs\node.exe" keygen.js 7d
echo.
pause
