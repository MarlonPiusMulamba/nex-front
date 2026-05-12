@echo off
echo Starting NexFi Desktop App...
cd /d "%~dp0"
node_modules\electron\dist\electron.exe .
