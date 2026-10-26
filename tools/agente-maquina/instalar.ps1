# Instala o agente NEXIA para abrir sozinho quando o PC liga (tarefa agendada, sem ninguém logado).
# Rodar como administrador, na pasta onde estão agente.ps1 e agente.config.json.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $dir 'agente.config.json'))) { Write-Host 'Falta agente.config.json (copie o exemplo e preencha).'; exit 1 }
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dir\agente.ps1`""
$quando = New-ScheduledTaskTrigger -AtStartup
$cfg = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName 'NEXIA Agente' -Action $acao -Trigger $quando -Settings $cfg -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName 'NEXIA Agente'
Write-Host 'Agente NEXIA instalado e rodando. Veja na Central (card Máquinas).'
