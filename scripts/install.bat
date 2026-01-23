@echo off
chcp 65001 >nul
title Session Helper - 安装
python "%~dp0install.py"
if errorlevel 1 pause
