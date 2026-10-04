# NEXIA - assistente de configuracao (Windows). Aberto pelo configurar-nexia.bat.
# Guarda os segredos do NEXIA nos segredos do repositorio gilcambe/nexia no GitHub, publica de novo
# e liga a aprovacao do deploy. Tudo gratis. Nunca mostra nem grava em disco o valor de um segredo
# (a chave do Firebase so e lida do arquivo que voce escolher).
# Pode rodar quantas vezes quiser: o que ja existe e pulado, a nao ser que voce peca para trocar.

$ErrorActionPreference = 'Continue'  # no Windows PowerShell 5.1, 'Stop' quebra com avisos normais do gh
$Repo = 'gilcambe/nexia'
$Site = 'https://nexia.gcbezerra.workers.dev'

function Titulo($t) { Write-Host ''; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  OK: $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  $t" -ForegroundColor Yellow }
function Pergunta($t) { Read-Host "  $t" }
function SimNao($t) { $r = Read-Host "  $t (s/N)"; return ($r -match '^(s|sim|y|yes)$') }

function Atualizar-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Le um segredo da area de transferencia (Ctrl+C no navegador e Enter aqui). Colar com Ctrl+V numa
# entrada escondida do PowerShell 5.1 grava "^V" em vez da chave; por isso nada e digitado nem colado.
# Confere o formato e testa o valor de verdade antes de guardar; tenta de novo se estiver errado.
function Ler-DaCopia($t, $formato, $teste) {
  for ($i = 0; $i -lt 3; $i++) {
    Pergunta "$t e depois aperte Enter aqui (nao precisa colar)" | Out-Null
    $v = ([string](Get-Clipboard -Raw)).Trim()
    if (-not $v) { Aviso 'A area de transferencia esta vazia. Copie de novo.'; continue }
    if ($v -notmatch $formato) { Aviso 'Isso nao parece ser o valor certo. Copie de novo (so o codigo, sem espacos).'; continue }
    if (-not (& $teste $v)) { Aviso 'O servico recusou esse valor. Confira se copiou o codigo inteiro e tente de novo.'; continue }
    Set-Clipboard -Value ' '
    return $v
  }
  Aviso 'Pulei este item. Rode o assistente de novo quando quiser.'
  return $null
}

function Testar-Gemini($v) {
  try { Invoke-RestMethod -Uri 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' -Headers @{ 'x-goog-api-key' = $v } | Out-Null; return $true } catch { return $false }
}

function Testar-TokenGithub($v) {
  try { Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/actions/workflows" -Headers @{ Authorization = "Bearer $v"; 'User-Agent' = 'nexia-assistente' } | Out-Null; return $true } catch { return $false }
}

# Grava um segredo no GitHub pela entrada padrao (o valor nunca aparece na tela nem no comando).
function Gravar($nome, $valor) {
  if ([string]::IsNullOrWhiteSpace($valor)) { Aviso "$nome ficou vazio; pulei."; return }
  $valor | gh secret set $nome -R $Repo | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "O GitHub recusou o segredo $nome." }
  Ok "$nome guardado"
  $script:Existentes += $nome
}

function Ja-Existe($nome) { return $script:Existentes -contains $nome }

# Pergunta se deve (re)configurar um grupo; quando nada falta, o padrao e pular.
function Precisa($nomes, $descricao) {
  $faltam = @($nomes | Where-Object { -not (Ja-Existe $_) })
  if ($faltam.Count -eq 0) {
    Ok "$descricao ja esta configurado."
    return (SimNao 'Quer trocar mesmo assim?')
  }
  return $true
}

Write-Host ''
Write-Host 'NEXIA - assistente de configuracao' -ForegroundColor Cyan
Write-Host 'Responda as perguntas. Para pular um item, deixe em branco e aperte Enter.'

# 1. GitHub CLI (gratis, da propria GitHub)
Titulo '1/8 Programa do GitHub'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Aviso 'Instalando o GitHub CLI (programa oficial e gratis da GitHub)...'
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  Atualizar-Path
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'Nao consegui instalar. Baixe em https://cli.github.com, instale e rode este assistente de novo.'
  }
}
Ok 'GitHub CLI instalado'
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Aviso 'Agora o navegador vai abrir para voce entrar na sua conta do GitHub.'
  Aviso 'Copie o codigo de 8 letras que aparecer aqui e cole na pagina.'
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw 'Login no GitHub nao concluido.' }
}
Ok 'Conectado ao GitHub'
$script:Existentes = @(gh secret list -R $Repo --json name --jq '.[].name')
if ($LASTEXITCODE -ne 0) { throw "Sua conta nao tem acesso ao repositorio $Repo." }

# 2. Firebase: so a chave de servico. O resto da configuracao do site o NEXIA busca sozinho no Firebase.
Titulo '2/8 Firebase (login e banco de dados)'
if (Precisa @('FIREBASE_SERVICE_ACCOUNT_BASE64') 'Firebase') {
  Write-Host '  Chave de servico (um arquivo .json):'
  Write-Host '     No navegador: Configuracoes do projeto > Contas de servico > "Gerar nova chave privada".'
  Write-Host '     Se ja tiver um .json dessa chave salvo no computador, pode usar ele (nao precisa gerar outra).'
  Write-Host '     Se o Google disser que o limite de chaves foi atingido, apague UMA chave antiga em:'
  Write-Host '     https://console.cloud.google.com/iam-admin/serviceaccounts > conta firebase-adminsdk > aba Chaves > lixeira'
  Start-Process 'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk'
  $arq = (Pergunta 'Arraste o arquivo .json baixado para esta janela e aperte Enter').Trim('"', ' ')
  if ($arq) {
    $json = Get-Content -Raw -LiteralPath $arq
    $sa = $json | ConvertFrom-Json
    if (-not $sa.private_key -or -not $sa.project_id) { throw 'Esse arquivo nao e uma chave de servico do Firebase.' }
    Gravar 'FIREBASE_SERVICE_ACCOUNT_BASE64' ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))
    Aviso 'Pode apagar o arquivo .json do seu computador agora (ele ja esta guardado no GitHub).'
  }
}

# 3. Seu e-mail de administrador
Titulo '3/8 Seu login no NEXIA'
if (Precisa @('MASTER_EMAIL') 'E-mail de administrador') {
  Write-Host '  Use o e-mail da conta com que voce vai entrar no NEXIA (precisa estar verificado no Firebase).'
  Gravar 'MASTER_EMAIL' (Pergunta 'Seu e-mail')
}

# 4. IA gratis
Titulo '4/8 Inteligencia artificial gratis (Google Gemini)'
if (Precisa @('GEMINI_API_KEY') 'Chave do Gemini') {
  Write-Host '  No navegador: entre com sua conta Google e clique em "Create API key". Copie a chave.'
  Start-Process 'https://aistudio.google.com/apikey'
  Gravar 'GEMINI_API_KEY' (Ler-DaCopia 'Copie a chave (botao de copiar ao lado dela)' '^AIza[0-9A-Za-z_-]{30,}$' ${function:Testar-Gemini})
}

# 5. Token da fila de tarefas
Titulo '5/8 Permissao para o NEXIA rodar tarefas longas'
if (Precisa @('NEXIA_JOBS_TOKEN') 'Token da fila') {
  Write-Host '  No navegador, na pagina de "Fine-grained token":'
  Write-Host '   - Token name: nexia-jobs   - Expiration: 1 year'
  Write-Host '   - Repository access: "Only select repositories" > gilcambe/nexia'
  Write-Host '   - Permissions > Repository permissions > Actions: "Read and write"'
  Write-Host '   - Clique em "Generate token" e copie.'
  Start-Process 'https://github.com/settings/personal-access-tokens/new'
  Gravar 'NEXIA_JOBS_TOKEN' (Ler-DaCopia 'Copie o token (botao de copiar ao lado dele)' '^(github_pat_|ghp_)[0-9A-Za-z_]{20,}$' ${function:Testar-TokenGithub})
}

# 6. GitHub App do NEXIA: deixa o Cortex escrever codigo e abrir PR (gratis, criada em 1 clique)
Titulo '6/8 Permitir que o Cortex escreva codigo no GitHub'
if (Precisa @('NEXIA_GITHUB_APP_ID', 'NEXIA_GITHUB_APP_PRIVATE_KEY') 'GitHub App do NEXIA') {
  Write-Host '  O navegador vai abrir uma pagina do GitHub ja preenchida. So clique no botao verde "Create GitHub App".'
  $porta = 8765
  $estado = [guid]::NewGuid().ToString('N')
  $nomeApp = ('NEXIA-' + (gh api user --jq '.login') + '-' + $estado.Substring(0, 4))
  if ($nomeApp.Length -gt 34) { $nomeApp = 'NEXIA-' + $estado.Substring(0, 8) }
  $manifesto = @{
    name = $nomeApp; url = $Site; public = $false
    hook_attributes = @{ url = "$Site/api/nexia/github-webhook"; active = $false }
    redirect_url = "http://localhost:$porta/pronto"
    default_permissions = @{ contents = 'write'; pull_requests = 'write'; actions = 'write'; checks = 'read'; issues = 'read'; metadata = 'read' }
  } | ConvertTo-Json -Depth 5 -Compress
  $pagina = '<html><body><p>Abrindo o GitHub...</p><form id="f" method="post" action="https://github.com/settings/apps/new?state=' + $estado + '">' +
    '<input type="hidden" name="manifest" value="' + [System.Net.WebUtility]::HtmlEncode($manifesto) + '"></form>' +
    '<script>document.getElementById("f").submit()</script></body></html>'
  $ouvinte = New-Object System.Net.HttpListener
  $ouvinte.Prefixes.Add("http://localhost:$porta/")
  $codigo = $null
  try {
    $ouvinte.Start()
    Start-Process "http://localhost:$porta/"
    $limite = (Get-Date).AddMinutes(10)
    while (-not $codigo -and (Get-Date) -lt $limite) {
      $espera = $ouvinte.BeginGetContext($null, $null)
      if (-not $espera.AsyncWaitHandle.WaitOne(600000)) { break }
      $ctx = $ouvinte.EndGetContext($espera)
      $resposta = $pagina
      if ($ctx.Request.Url.AbsolutePath -eq '/pronto') {
        if ($ctx.Request.QueryString['state'] -eq $estado) { $codigo = $ctx.Request.QueryString['code'] }
        $resposta = '<html><body><h2>Pronto! Pode fechar esta aba e voltar para a janela do assistente.</h2></body></html>'
      }
      $bytes = [Text.Encoding]::UTF8.GetBytes($resposta)
      $ctx.Response.ContentType = 'text/html; charset=utf-8'
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $ctx.Response.Close()
    }
  } catch { Aviso ('Nao consegui abrir a pagina local: ' + $_.Exception.Message) }
  finally { $ouvinte.Close() }
  if ($codigo -and $codigo -match '^[A-Za-z0-9]+$') {
    $app = gh api -X POST "app-manifests/$codigo/conversions" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $app.id) { throw 'O GitHub nao confirmou a criacao da App.' }
    Gravar 'NEXIA_GITHUB_APP_ID' ([string]$app.id)
    Gravar 'NEXIA_GITHUB_APP_PRIVATE_KEY' $app.pem
    Write-Host ''
    Write-Host '  Agora instale a App: na pagina que vai abrir, escolha os repositorios que o Cortex pode mexer'
    Write-Host '  (inclua gilcambe/nexia) e clique em "Install".'
    Start-Process "https://github.com/apps/$($app.slug)/installations/new"
    Pergunta 'Depois de instalar, aperte Enter aqui' | Out-Null
  } else { Aviso 'A App nao foi criada (tempo esgotado ou cancelado). Rode o assistente de novo quando quiser.' }
}

# 7. Publicar de novo (copia os segredos para o Cloudflare)
Titulo '7/8 Publicar o NEXIA'
gh workflow run deploy-cloudflare.yml -R $Repo --ref develop -f confirm=DEPLOY | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao consegui iniciar a publicacao.' }
Aviso 'Publicando (leva 2 a 3 minutos)...'
Start-Sleep -Seconds 8
$run = gh run list -R $Repo --workflow deploy-cloudflare.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $run -R $Repo --exit-status | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "Publicado em $Site" } else { Aviso "A publicacao falhou. Veja em https://github.com/$Repo/actions" }

# 8. Aprovacao humana no deploy (voce aprova cada publicacao)
Titulo '8/8 Aprovacao do deploy'
$eu = gh api user --jq '.id'
@{ reviewers = @(@{ type = 'User'; id = [int64]$eu }); prevent_self_review = $false } | ConvertTo-Json -Depth 4 |
  gh api -X PUT "repos/$Repo/environments/production" --input - | Out-Null
if ($LASTEXITCODE -eq 0) { Ok 'Daqui pra frente cada deploy espera a sua aprovacao no GitHub.' } else { Aviso 'Nao consegui ligar a aprovacao; faca em Settings > Environments > production.' }

Write-Host ''
Write-Host "Pronto! Abra $Site/login e entre com o e-mail que voce informou." -ForegroundColor Green
Write-Host 'Depois avise no chat do projeto para eu testar tudo logado.'
