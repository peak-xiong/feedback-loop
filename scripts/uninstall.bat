@echo off
chcp 65001 >nul
title Session Helper - 卸载
python "%~dp0uninstall.py"
if errorlevel 1 pause
