# Ajudante "agy" (13/11/2026): usa o Gemini do plano do dono (Google AI Plus) pelo Antigravity CLI (agy) como degrau
# do Cortex ANTES do Claude Pro. Roda COMO O DONO (o login do agy fica no cofre de senhas do Windows dele; o agente
# principal roda como SISTEMA e não enxerga). Pega na fila só tarefas modelo "agy" (?modelos=agy), escreve o pedido
# num arquivo numa pasta vazia e manda o agy ler e responder, SEM liberar comandos nem alterar arquivos.
# Config: o mesmo agente.config.json do agente (url, token, nome). Desligar: parar a tarefa "NEXIA agy".
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgPath = if (Test-Path (Join-Path $dir 'agente.config.json')) { Join-Path $dir 'agente.config.json' } else { 'C:\NEXIA-agente\agente.config.json' }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$base = ($cfg.url.TrimEnd('/')) + '/api/nexia/maquinas'
$H = @{ Authorization = "Bearer $($cfg.token)" }
$nome = "$($cfg.nome)-agy"
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
$trabalho = Join-Path $env:LOCALAPPDATA 'nexia-agy'
$log = Join-Path $trabalho 'agy.log'
New-Item -ItemType Directory -Force $trabalho | Out-Null
function Log($t) { "$(Get-Date -Format s) $t" | Add-Content $log }

function Pulso {
  $ok = Test-Path $agy
  $b = @{ nome = $nome; cpu = 'agy (Gemini do dono)'; modelos = @('agy'); ollamaOk = $ok } | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/pulso" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($b)) -TimeoutSec 20 -DisableKeepAlive | Out-Null
}

function Trabalhar {
  $r = Invoke-WebRequest "$base/tarefa?nome=$nome&modelos=agy" -Headers $H -TimeoutSec 20 -DisableKeepAlive -UseBasicParsing
  if ($r.StatusCode -ne 200) { return }
  $t = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $ini = Get-Date
  # pasta vazia por tarefa: o agy só enxerga o pedido
  $pasta = Join-Path $trabalho ("t-" + $t.id)
  New-Item -ItemType Directory -Force $pasta | Out-Null
  try {
    $texto = ($t.mensagens | ForEach-Object { "### $($_.role)`n$($_.content)" }) -join "`n`n"
    [IO.File]::WriteAllText((Join-Path $pasta 'pedido.txt'), $texto, (New-Object Text.UTF8Encoding $false))
    Push-Location $pasta
    $saida = & $agy -p 'Leia o arquivo pedido.txt desta pasta: ele tem instruções (system) e o pedido (user). Faça exatamente o que ele pede. Não rode comandos, não crie nem altere arquivos. Responda só com o resultado final, no formato pedido.' --print-timeout 600s 2>&1 | Out-String
    Pop-Location
    $saida = $saida.Trim()
    if (-not $saida -or $saida -match '^jetski: no output produced') { throw "agy sem resposta: $($saida.Substring(0, [Math]::Min(200, $saida.Length)))" }
    $res = @{ nome = $nome; id = $t.id; texto = $saida; tokens = 0; ms = [int]((Get-Date) - $ini).TotalMilliseconds }
  } catch { try { Pop-Location } catch {}; $res = @{ nome = $nome; id = $t.id; erro = "$_" } }
  finally { Remove-Item $pasta -Recurse -Force -ErrorAction SilentlyContinue }
  $j = $res | ConvertTo-Json -Compress
  Invoke-RestMethod "$base/resultado" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($j)) -TimeoutSec 20 -DisableKeepAlive | Out-Null
  Log "tarefa $($t.id) $(if ($res.erro) { 'erro: ' + $res.erro } else { 'feita em ' + [int]($res.ms / 1000) + ' s' })"
}

Log 'ajudante agy iniciado'
while ($true) {
  try { Pulso; Trabalhar } catch { Log "erro: $_" }
  Start-Sleep -Seconds 15
}
