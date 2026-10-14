# NEXIA Divulga: liga o Facebook e o Instagram do robô. Roda no seu computador.
# Troca o código curto da Meta por um código que não vence e guarda escondido no GitHub.
$ErrorActionPreference = 'Stop'
$repo = 'gilcambe/nexia'
$g = 'https://graph.facebook.com/v21.0'
function Ler($t) { Read-Host $t | ForEach-Object { $_.Trim() } }
try {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host 'Instalando o GitHub CLI, so na primeira vez...'
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    $env:Path += ";$env:ProgramFiles\GitHub CLI"
  }
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { gh auth login --hostname github.com --git-protocol https --web --scopes repo,workflow }

  $appId = Ler 'Cole o ID do app (App ID)'
  $segredo = Ler 'Cole a Chave secreta do app (App Secret)'
  $curto = Ler 'Cole o token gerado no Graph API Explorer'

  $longo = (Invoke-RestMethod "$g/oauth/access_token?grant_type=fb_exchange_token&client_id=$appId&client_secret=$segredo&fb_exchange_token=$curto").access_token
  $paginas = (Invoke-RestMethod "$g/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=$longo").data
  if (-not $paginas) { throw 'Nenhuma pagina do Facebook apareceu. No Graph API Explorer, marque a sua pagina ao gerar o token.' }
  $pag = $paginas | Where-Object { $_.name -like '*Body Coach*' } | Select-Object -First 1
  if (-not $pag) { $pag = $paginas[0] }
  Write-Host "Pagina encontrada: $($pag.name)"
  $ig = $pag.instagram_business_account.id
  if (-not $ig) { throw 'Essa pagina nao tem Instagram comercial ligado. Ligue o Instagram a pagina e rode de novo.' }

  $pag.id | gh secret set DIVULGA_META_PAGE_ID --repo $repo
  $pag.access_token | gh secret set DIVULGA_META_PAGE_TOKEN --repo $repo
  $ig | gh secret set DIVULGA_META_IG_USER_ID --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'O GitHub nao aceitou guardar os codigos.' }

  gh workflow run divulga.yml --repo $repo -f acao=rodar
  Write-Host ''
  Write-Host 'Pronto! Facebook e Instagram ligados. O primeiro post sai em alguns minutos.'
} catch {
  Write-Host ''
  Write-Host "Nao deu certo: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host 'Aperte Enter para fechar'
