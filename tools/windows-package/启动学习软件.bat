@echo off
chcp 65001 >nul
title 申硕英语词汇学习
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.
echo 服务已退出。按任意键关闭窗口。
pause >nul
