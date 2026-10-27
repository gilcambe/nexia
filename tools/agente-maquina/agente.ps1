# Agente NEXIA (#1846): liga este PC ao Cortex SEM túnel. A cada 15 s manda o pulso (CPU, RAM, modelos),
# pega 1 tarefa leve, roda no Ollama local e devolve o resultado. Só saída de internet; nada fica aberto.
# Config em agente.config.json (ao lado deste arquivo): url, token, nome, modelo.
$ErrorActionPreference = 'Continue'
# PowerShell 5.1 reaproveita conexões que o Cloudflare já fechou ("conexão subjacente estava fechada"):
# TLS 1.2 fixo e conexão nova a cada chamada.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content (Join-Path $dir 'agente.config.json') -Raw | ConvertFrom-Json
$base = ($cfg.url.TrimEnd('/')) + '/api/nexia/maquinas'
$H = @{ Authorization = "Bearer $($cfg.token)" }
$log = Join-Path $dir 'agente.log'
function Log($t) { "$(Get-Date -Format s) $t" | Add-Content $log }

function Pulso {
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
  $modelos = @(); $ok = $false
  try { $modelos = @((Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 5).models.name); $ok = $true } catch {}
  $b = @{ nome = $cfg.nome; cpu = $cpu; ramTotal = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
          ramLivre = [math]::Round($os.FreePhysicalMemory / 1MB, 1); modelos = $modelos; ollamaOk = $ok } | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/pulso" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($b)) -TimeoutSec 20 -DisableKeepAlive | Out-Null
}

function Trabalhar {
  $r = Invoke-WebRequest "$base/tarefa?nome=$($cfg.nome)" -Headers $H -TimeoutSec 20 -DisableKeepAlive -UseBasicParsing
  if ($r.StatusCode -ne 200) { return }
  $t = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $modelo = if ($t.modelo) { $t.modelo } else { $cfg.modelo }
  $ini = Get-Date
  try {
    $corpo = @{ model = $modelo; messages = $t.mensagens; stream = $false } | ConvertTo-Json -Depth 6 -Compress
    $resp = Invoke-RestMethod 'http://localhost:11434/v1/chat/completions' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) -TimeoutSec 600
    $res = @{ nome = $cfg.nome; id = $t.id; texto = $resp.choices[0].message.content; tokens = $resp.usage.completion_tokens; ms = [int]((Get-Date) - $ini).TotalMilliseconds }
  } catch { $res = @{ nome = $cfg.nome; id = $t.id; erro = "$_" } }
  $j = $res | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/resultado" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($j)) -TimeoutSec 20 -DisableKeepAlive | Out-Null
  Log "tarefa $($t.id) feita"
}

Log 'agente iniciado'
while ($true) {
  try { Pulso; Trabalhar } catch { Log "erro: $_" }
  Start-Sleep -Seconds 15
}
