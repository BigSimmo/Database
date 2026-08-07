@echo off
echo Fixing Docker and WSL Services...
powershell -Command "Set-Service -Name wslservice -StartupType Manual; Start-Service -Name wslservice; Stop-Process -Name '*docker*' -Force -ErrorAction SilentlyContinue; Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"
echo Done! Docker should be launching now.
pause
