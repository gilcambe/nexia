$ErrorActionPreference = 'Continue'

# Lê a configuração ao lado deste script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$configPath = Join-Path $scriptDir 'agente.config.json'

if (-not (Test-Path $configPath)) {
  Write-Output 'agente.config.json não encontrado.'
  exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$baseUrl = $config.NEXIA_URL.TrimEnd('/')
$token = $config.NEXIA_MAQUINA_TOKEN
$nome = $config.NEXIA_MAQUINA_NOME
$modelo = $config.NEXIA_MODELO

$headers = @{}
if ($token) { $headers['Authorization'] = "Bearer $token" }

function Enviar-Pulso {
  $body = @{ nome = $nome; momento = (Get-Date).ToString('o') } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "$baseUrl/api/nexia/maquinas/pulso" -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSeconds 10 | Out-Null
    Write-Output "pulso ok $(Get-Date)"
  } catch {
    Write-Output "pulso falhou: $($_.Exception.Message)"
  }
}

function Requisitar-Tarefa {
  try {
    $tarefa = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/nexia/maquinas/tarefa?nome=$nome" -Headers $headers -TimeoutSeconds 10
    return $tarefa
  } catch {
    Write-Output "tarefa falhou: $($_.Exception.Message)"
    return $null
  }
}

function Chamar-Ollama {
  param($mensagem)
  $ollamaUrl = 'http://localhost:11434/api/generate'
  $body = @{ model = $modelo; prompt = $mensagem; stream = $false } | ConvertTo-Json
  try {
    # curl nativo (sem dependências externas)
    $resposta = curl -s -X POST "$ollamaUrl" -H 'Content-Type: application/json' -d "$body"
    $json = $resposta | ConvertFrom-Json
    return $json.response
  } catch {
    Write-Output "ollama falhou: $($_.Exception.Message)"
    return $null
  }
}

function Postar-Resultado {
  param($tarefaId, $resultado, $erro)
  $body = @{ tarefa_id = $tarefaId; resultado = $resultado; erro = $erro; momento = (Get-Date).ToString('o') } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "$baseUrl/api/nexia/maquinas/resultado" -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSeconds 10 | Out-Null
    Write-Output "resultado postado tarefa=$tarefaId"
  } catch {
    Write-Output "resultado falhou: $($_.Exception.Message)"
  }
}

Write-Output "Agente maquina iniciado: $nome"

while ($true) {
  Enviar-Pulso
  $tarefa = Requisitar-Tarefa
  if ($tarefa -and $tarefa.tarefa_id) {
    $resposta = Chamar-Ollama -mensagem $tarefa.mensagem
    if ($resposta -ne $null) {
      Postar-Resultado -tarefaId $tarefa.tarefa_id -resultado $resposta -erro $false
    } else {
      Postar-Resultado -tarefaId $tarefa.tarefa_id -resultado $null -erro $true
    }
  }
  Start-Sleep -Seconds 15
}
