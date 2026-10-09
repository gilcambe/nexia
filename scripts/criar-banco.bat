@echo off
rem NEXIA - cria UM banco grátis extra para o Cortex (projeto Firebase + Firestore + chave + segredo no GitHub).
rem Uso: de dois cliques. Para o 3o banco responda C; para outro, D. Nao grava a chave no computador (ela e apagada no fim).
title NEXIA - criar banco
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference='SilentlyContinue'; $s = Invoke-RestMethod 'https://raw.githubusercontent.com/gilcambe/nexia/develop/scripts/criar-banco.ps1'; Invoke-Expression $s } catch { Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red }"
echo.
pause
