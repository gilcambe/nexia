# NEXIA Divulga: liga o Facebook e o Instagram do robô. Roda no seu computador.
# Troca o código curto da Meta por um código que não vence e guarda escondido no GitHub.
param([string]$Perfil = '')
# -Perfil kernex (C2-F5): liga a Pagina/Instagram da KERNEX e guarda em KERNEX_META_* (o Body Coach continua em DIVULGA_META_*).
$ErrorActionPreference = 'Stop'
$pre = if ($Perfil -eq 'kernex') { 'KERNEX_META' } else { 'DIVULGA_META' }
$busca = if ($Perfil -eq 'kernex') { '*KERNEX*' } else { '*Body Coach*' }
$fluxo = if ($Perfil -eq 'kernex') { 'divulga-kernex.yml' } else { 'divulga.yml' }
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
  $pag = $paginas | Where-Object { $_.name -like $busca } | Select-Object -First 1
  if (-not $pag) { $pag = $paginas[0] }
  Write-Host "Pagina encontrada: $($pag.name)"
  $ig = $pag.instagram_business_account.id
  if (-not $ig) { throw 'Essa pagina nao tem Instagram comercial ligado. Ligue o Instagram a pagina e rode de novo.' }

  gh secret set ${pre}_PAGE_ID --repo $repo --body "$($pag.id)"
  gh secret set ${pre}_PAGE_TOKEN --repo $repo --body "$($pag.access_token)"
  gh secret set ${pre}_IG_USER_ID --repo $repo --body "$ig"
  if ($LASTEXITCODE -ne 0) { throw 'O GitHub nao aceitou guardar os codigos.' }

  gh workflow run $fluxo --repo $repo -f acao=rodar
  Write-Host ''
  Write-Host 'Pronto! Facebook e Instagram ligados. O primeiro post sai em alguns minutos.'
} catch {
  Write-Host ''
  Write-Host "Nao deu certo: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host 'Aperte Enter para fechar'
