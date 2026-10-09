# NEXIA - cria um banco Firebase/Firestore grátis para o Cortex e grava a chave como segredo do GitHub.
# Roda no PowerShell do Windows (chamado por criar-banco.bat). Pede login no navegador uma vez (Google e GitHub).
$ErrorActionPreference = 'Stop'
$repo = 'gilcambe/nexia'

function Passo($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Tem($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Roda($c) { & cmd /c $c; if ($LASTEXITCODE -ne 0) { throw "Falhou: $c" } }

$letra = (Read-Host 'Qual a letra deste banco? (C para o 3o banco, D para o 4o)').Trim().ToUpper()
if ($letra -notmatch '^[C-H]$') { throw 'Use uma letra de C a H.' }
$projeto = "nexia-cortex-$($letra.ToLower())-" + (Get-Random -Minimum 10000 -Maximum 99999)
$segredo = "FIREBASE_SERVICE_ACCOUNT_$letra"

Passo 'Instalando o que falta (so na primeira vez)'
if (-not (Tem 'gh'))     { winget install -e --id GitHub.cli --accept-source-agreements --accept-package-agreements }
if (-not (Tem 'gcloud')) { winget install -e --id Google.CloudSDK --accept-source-agreements --accept-package-agreements }
if (-not (Tem 'node'))   { winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements }
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
if (-not (Tem 'gh') -or -not (Tem 'gcloud') -or -not (Tem 'node')) { throw 'Instalei os programas. Feche esta janela e de dois cliques no .bat de novo.' }

Passo 'Login no GitHub (abre o navegador)'
& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { Roda 'gh auth login --web --git-protocol https --scopes repo' }

Passo 'Login no Google (abre o navegador; use gcbezerra@gmail.com)'
Roda 'gcloud auth login'

Passo "Criando o projeto $projeto"
Roda "gcloud projects create $projeto --name=`"NEXIA Cortex $letra`""
Roda "gcloud services enable firebase.googleapis.com firestore.googleapis.com iam.googleapis.com --project=$projeto"
# Transforma em projeto Firebase (plano Spark, gratis): precisa do firebase-tools.
Roda "npx --yes firebase-tools@13.35.1 projects:addfirebase $projeto"

Passo 'Criando o Firestore (Sao Paulo)'
Roda "gcloud firestore databases create --location=southamerica-east1 --project=$projeto"

Passo 'Gerando a chave de acesso'
$sa = "firebase-adminsdk-nexia@$projeto.iam.gserviceaccount.com"
Roda "gcloud iam service-accounts create firebase-adminsdk-nexia --display-name=`"NEXIA Cortex`" --project=$projeto"
Roda "gcloud projects add-iam-policy-binding $projeto --member=serviceAccount:$sa --role=roles/datastore.user"
$chave = Join-Path $env:TEMP "nexia-$letra.json"
Roda "gcloud iam service-accounts keys create `"$chave`" --iam-account=$sa --project=$projeto"

Passo "Gravando o segredo $segredo no GitHub"
Get-Content $chave -Raw | & gh secret set $segredo --repo $repo
if ($LASTEXITCODE -ne 0) { Remove-Item $chave -Force; throw 'Nao consegui gravar o segredo.' }
Remove-Item $chave -Force

Write-Host ''
Write-Host "PRONTO. Banco $letra criado ($projeto) e segredo $segredo gravado. Pode fechar. O Cortex passa a usa-lo sozinho." -ForegroundColor Green
