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
  # 13/11: diz à fila que modelos este PC tem (só recebe o que consegue fazer); sem o pedido, usa o seu (config)
  $locais = @(); try { $locais = @((Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 5).models.name) } catch {}
  if (-not $locais.Count) { return }  # sem Ollama ligado não pega tarefa (antes pegava e devolvia erro)
  $r = Invoke-WebRequest "$base/tarefa?nome=$($cfg.nome)&modelos=$([uri]::EscapeDataString($locais -join ','))" -Headers $H -TimeoutSec 20 -DisableKeepAlive -UseBasicParsing
  if ($r.StatusCode -ne 200) { return }
  $t = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $modelo = if ($t.modelo -and ($locais -contains $t.modelo)) { $t.modelo } else { $cfg.modelo }
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
# Cockpit (12/11): manda o quadro de tarefas dos PCs para a Central (só quando o arquivo muda). Opcional: "quadro" no config.
$quadro = if ($cfg.quadro) { $cfg.quadro } elseif (Test-Path 'T:\equipe\tarefas.json') { 'T:\equipe\tarefas.json' } else { 'C:\NEXIA-TROCA\equipe\tarefas.json' }
$quadroVisto = $null
function Quadro {
  if (-not (Test-Path $quadro)) { return }
  $quando = (Get-Item $quadro).LastWriteTimeUtc
  if ($quadroVisto -eq $quando) { return }
  $t = Get-Content $quadro -Raw -Encoding UTF8 | ConvertFrom-Json
  $b = @{ nome = $cfg.nome; tarefas = @($t) } | ConvertTo-Json -Depth 5 -Compress
  Invoke-RestMethod "$base/quadro" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($b)) -TimeoutSec 20 -DisableKeepAlive | Out-Null
  $script:quadroVisto = $quando
}

# C2-F3 (13/11): pasta única da empresa, separada do pessoal. O agente SÓ lista e abre o que está dentro dela.
# Cria as pastas na 1ª vez, manda o índice (nome, tamanho, data; nunca o conteúdo) a cada 5 min se mudou,
# e abre no PC o arquivo que o dono tocar na Central (só se o caminho final continuar dentro de C:\KERNEX).
$kernex = if ($cfg.kernex) { $cfg.kernex } else { 'C:\KERNEX' }
foreach ($p in 'Clientes', 'Projetos', 'Marketing', 'Documentos-Kernex') { New-Item -ItemType Directory -Force -Path (Join-Path $kernex $p) | Out-Null }
$raizK = (Resolve-Path $kernex).Path.TrimEnd('\') + '\'
$arqVisto = ''; $arqQuando = [datetime]::MinValue
function Arquivos {
  if (((Get-Date) - $script:arqQuando).TotalMinutes -lt 5) { return }
  $script:arqQuando = Get-Date
  $lista = @(Get-ChildItem $raizK -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 2000 |
    ForEach-Object { @{ c = $_.FullName.Substring($raizK.Length); t = $_.Length; m = $_.LastWriteTimeUtc.ToString('s') + 'Z' } })
  $b = @{ nome = $cfg.nome; arquivos = $lista } | ConvertTo-Json -Depth 4 -Compress
  if ($b -eq $script:arqVisto) { return }
  Invoke-RestMethod "$base/arquivos" -Method Post -Headers $H -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($b)) -TimeoutSec 30 -DisableKeepAlive | Out-Null
  $script:arqVisto = $b
}
# C2-B (13/11): o agente roda como SYSTEM (tarefa no boot), e o Explorador aberto por ele não aparece na tela do dono.
# Então entrega para quem está LOGADO: tarefa agendada de 1 vez, "só quando o usuário está conectado" (Interactive),
# que abre o Explorador na sessão dele e é apagada logo depois. Sem ninguém logado, não abre (fica no log).
function MostrarParaUsuario([string]$cheio) {
  $arg = "/select,`"$cheio`""
  if (-not [Security.Principal.WindowsIdentity]::GetCurrent().IsSystem) { Start-Process -FilePath 'explorer.exe' -ArgumentList $arg; return 'mesma sessao' }
  $usuario = (Get-CimInstance Win32_ComputerSystem).UserName
  if (-not $usuario) { throw 'ninguem logado no PC' }
  $nomeTarefa = 'KERNEX Mostrar arquivo'
  $acao = New-ScheduledTaskAction -Execute 'explorer.exe' -Argument $arg
  $quem = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $nomeTarefa -Action $acao -Principal $quem -Force | Out-Null
  try { Start-ScheduledTask -TaskName $nomeTarefa; Start-Sleep -Seconds 3 } finally { Unregister-ScheduledTask -TaskName $nomeTarefa -Confirm:$false -ErrorAction SilentlyContinue }
  return $usuario
}
function Abrir {
  $r = Invoke-RestMethod "$base/abrir?nome=$($cfg.nome)" -Headers $H -TimeoutSec 20 -DisableKeepAlive
  foreach ($c in @($r.abrir)) {
    if (-not $c) { continue }
    $cheio = [IO.Path]::GetFullPath((Join-Path $raizK $c))
    if (-not $cheio.StartsWith($raizK, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $cheio)) { Log "abrir recusado: $c"; continue }
    try { $para = MostrarParaUsuario $cheio; Log "abriu: $c (para $para)" } catch { Log "abrir falhou: $c ($_)" }
  }
}

while ($true) {
  try { Pulso; Trabalhar } catch { Log "erro: $_" }
  try { Quadro } catch { Log "quadro: $_" }
  try { Arquivos; Abrir } catch { Log "arquivos: $_" }
  Start-Sleep -Seconds 15
}
