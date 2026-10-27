@echo off
REM NEXIA - libera e cria os indices nos bancos novos do Vault (D, E, ...). Dois cliques.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0liberar-indices.ps1"
pause
