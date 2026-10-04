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

function Ler-Secreto($t) {
  $s = Read-Host "  $t" -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
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
Titulo '1/7 Programa do GitHub'
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

# 2. Firebase: chave de servico (1 segredo) e configuracao do site (6 segredos) = os 7 FIREBASE_*
Titulo '2/7 Firebase (login e banco de dados)'
$fbNomes = 'FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID'
if (Precisa $fbNomes 'Firebase') {
  Write-Host '  a) Chave de servico (um arquivo .json):'
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
  Write-Host ''
  Write-Host '  b) Configuracao do site:'
  Write-Host '     No navegador: Configuracoes do projeto > Geral > "Seus apps" > app da Web > "Configuracao".'
  Write-Host '     Copie o bloco inteiro que comeca com  const firebaseConfig = {'
  Start-Process 'https://console.firebase.google.com/project/_/settings/general'
  Write-Host '  Cole aqui e aperte Enter duas vezes:'
  $linhas = @()
  while ($true) { $l = Read-Host; if ([string]::IsNullOrWhiteSpace($l)) { if ($linhas.Count) { break } else { continue } }; $linhas += $l; if ($l -match '^\s*};?\s*$') { break } }
  $bloco = $linhas -join "`n"
  $campos = @{ apiKey = 'FIREBASE_API_KEY'; authDomain = 'FIREBASE_AUTH_DOMAIN'; projectId = 'FIREBASE_PROJECT_ID'; storageBucket = 'FIREBASE_STORAGE_BUCKET'; messagingSenderId = 'FIREBASE_MESSAGING_SENDER_ID'; appId = 'FIREBASE_APP_ID' }
  foreach ($k in $campos.Keys) {
    $m = [regex]::Match($bloco, "$k\s*:\s*[`"']([^`"']+)[`"']")
    if ($m.Success) { Gravar $campos[$k] $m.Groups[1].Value } else { Aviso "Nao achei '$k' no bloco colado." }
  }
}

# 3. Seu e-mail de administrador
Titulo '3/7 Seu login no NEXIA'
if (Precisa @('MASTER_EMAIL') 'E-mail de administrador') {
  Write-Host '  Use o e-mail da conta com que voce vai entrar no NEXIA (precisa estar verificado no Firebase).'
  Gravar 'MASTER_EMAIL' (Pergunta 'Seu e-mail')
}

# 4. IA gratis
Titulo '4/7 Inteligencia artificial gratis (Google Gemini)'
if (Precisa @('GEMINI_API_KEY') 'Chave do Gemini') {
  Write-Host '  No navegador: entre com sua conta Google e clique em "Create API key". Copie a chave.'
  Start-Process 'https://aistudio.google.com/apikey'
  Gravar 'GEMINI_API_KEY' (Ler-Secreto 'Cole a chave (ela nao aparece na tela)')
}

# 5. Token da fila de tarefas
Titulo '5/7 Permissao para o NEXIA rodar tarefas longas'
if (Precisa @('NEXIA_JOBS_TOKEN') 'Token da fila') {
  Write-Host '  No navegador, na pagina de "Fine-grained token":'
  Write-Host '   - Token name: nexia-jobs   - Expiration: 1 year'
  Write-Host '   - Repository access: "Only select repositories" > gilcambe/nexia'
  Write-Host '   - Permissions > Repository permissions > Actions: "Read and write"'
  Write-Host '   - Clique em "Generate token" e copie.'
  Start-Process 'https://github.com/settings/personal-access-tokens/new'
  Gravar 'NEXIA_JOBS_TOKEN' (Ler-Secreto 'Cole o token (ele nao aparece na tela)')
}

# 6. Publicar de novo (copia os segredos para o Cloudflare)
Titulo '6/7 Publicar o NEXIA'
gh workflow run deploy-cloudflare.yml -R $Repo --ref develop -f confirm=DEPLOY | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao consegui iniciar a publicacao.' }
Aviso 'Publicando (leva 2 a 3 minutos)...'
Start-Sleep -Seconds 8
$run = gh run list -R $Repo --workflow deploy-cloudflare.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $run -R $Repo --exit-status | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "Publicado em $Site" } else { Aviso "A publicacao falhou. Veja em https://github.com/$Repo/actions" }

# 7. Aprovacao humana no deploy (voce aprova cada publicacao)
Titulo '7/7 Aprovacao do deploy'
$eu = gh api user --jq '.id'
@{ reviewers = @(@{ type = 'User'; id = [int64]$eu }); prevent_self_review = $false } | ConvertTo-Json -Depth 4 |
  gh api -X PUT "repos/$Repo/environments/production" --input - | Out-Null
if ($LASTEXITCODE -eq 0) { Ok 'Daqui pra frente cada deploy espera a sua aprovacao no GitHub.' } else { Aviso 'Nao consegui ligar a aprovacao; faca em Settings > Environments > production.' }

Write-Host ''
Write-Host "Pronto! Abra $Site/login e entre com o e-mail que voce informou." -ForegroundColor Green
Write-Host 'Depois avise no chat do projeto para eu testar tudo logado.'
