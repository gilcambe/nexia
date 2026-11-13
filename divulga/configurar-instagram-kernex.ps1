# KERNEX Divulga (C2-F5): liga o Instagram profissional da KERNEX ao robô, SEM Página do Facebook
# ("Instagram API with Instagram Login"). Roda no seu computador; você cola os códigos, eles vão escondidos para o GitHub.
# Usa o MESMO app de desenvolvedor da Meta do Body Coach (produto "Instagram" > "API setup with Instagram login").
# O código longo dura 60 dias: rode este arquivo de novo antes disso (a Central avisa quando o post falhar).
$ErrorActionPreference = 'Stop'
$repo = 'gilcambe/nexia'
function Ler($t) { Read-Host $t | ForEach-Object { $_.Trim() } }
try {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host 'Instalando o GitHub CLI, so na primeira vez...'
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    $env:Path += ";$env:ProgramFiles\GitHub CLI"
  }
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { gh auth login --hostname github.com --git-protocol https --web --scopes repo,workflow }

  Write-Host 'No app da Meta: Instagram > API setup with Instagram login > Generate token (conta da KERNEX).'
  $segredo = Ler 'Cole a Chave secreta do app do Instagram (Instagram app secret)'
  $curto = Ler 'Cole o token gerado para a conta da KERNEX'

  # Troca o token curto pelo de 60 dias (se ele já for longo, a Meta recusa a troca e usamos o que veio).
  $token = $curto
  try { $token = (Invoke-RestMethod "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=$segredo&access_token=$curto").access_token } catch {}
  $eu = Invoke-RestMethod "https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=$token"
  if (-not $eu.user_id) { throw 'A Meta nao devolveu a conta. Gere o token de novo com a conta da KERNEX.' }
  Write-Host "Conta encontrada: @$($eu.username)"
  if ($eu.username -notmatch 'kernex') {
    $ok = Ler "Essa conta nao parece ser a da KERNEX. Continuar mesmo assim? (s/n)"
    if ($ok -ne 's') { throw 'Cancelado.' }
  }

  gh secret set KERNEX_IG_USER_ID --repo $repo --body "$($eu.user_id)"
  gh secret set KERNEX_IG_TOKEN --repo $repo --body "$token"
  if ($LASTEXITCODE -ne 0) { throw 'O GitHub nao aceitou guardar os codigos.' }

  gh workflow run divulga-kernex.yml --repo $repo -f acao=ensaio
  Write-Host ''
  Write-Host 'Pronto! Instagram da KERNEX ligado. Rodei um ENSAIO (nao publica). Para postar sozinho 3x por dia, peca para ligar o horario.'
} catch {
  Write-Host ''
  Write-Host "Nao deu certo: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host 'Aperte Enter para fechar'
