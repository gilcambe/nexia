@echo off
rem NEXIA - assistente de configuracao. De dois cliques neste arquivo.
rem Baixa a versao atual do assistente (scripts/configurar-nexia.ps1 do repositorio gilcambe/nexia)
rem e roda no PowerShell do Windows. Nao grava nenhum segredo no seu computador.
title NEXIA - configuracao
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference='SilentlyContinue'; $s = Invoke-RestMethod 'https://raw.githubusercontent.com/gilcambe/nexia/develop/scripts/configurar-nexia.ps1'; Invoke-Expression $s } catch { Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red }"
echo.
pause
