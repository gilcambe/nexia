$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$agentePs1 = Join-Path $scriptDir 'agente.ps1'
$configJson = Join-Path $scriptDir 'agente.config.json'

if (-not (Test-Path $agentePs1)) {
  Write-Output 'agente.ps1 não encontrado.'
  exit 1
}
if (-not (Test-Path $configJson)) {
  Write-Output 'agente.config.json não encontrado.'
  exit 1
}

$nomeTarefa = 'NEXIA Agente Maquina'

# Remove tarefa existente com mesmo nome, se houver
schtasks /Delete /TN "$nomeTarefa" /F 2>$null

# Cria tarefa agendada para rodar no boot do Windows, em segundo plano
schtasks /Create /TN "$nomeTarefa" /TR "powershell.exe -ExecutionPolicy Bypass -File '$agentePs1'" /SC ONSTART /RL HIGHEST /F

Write-Output "Tarefa agendada '$nomeTarefa' criada. Roda agente.ps1 no boot do Windows."
