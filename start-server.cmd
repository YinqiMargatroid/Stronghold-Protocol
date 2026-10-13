@echo off
setlocal EnableExtensions
call "%~dp0scripts\start-windows.bat" --asset-source=mirror --no-open %*
exit /b %errorlevel%
