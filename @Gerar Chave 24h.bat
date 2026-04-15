@echo off
title Criador de Keys NinjaCoin (24 Horas)
color 0A
cd /d "%~dp0"
echo Gerando licenca de 24 horas...
echo.
"C:\Program Files\nodejs\node.exe" keygen.js 24h
echo.
pause
