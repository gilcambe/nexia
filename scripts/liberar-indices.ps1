# NEXIA - libera a criacao de indices nos bancos do Vault ja criados (nexia-cortex-*) e cria os indices.
# Roda no PowerShell do Windows (chamado por liberar-indices.bat). Usa o login do Google e do GitHub ja feito no criar-banco.
$ErrorActionPreference = 'Stop'
$repo = 'gilcambe/nexia'
function Roda($c) { & cmd /c $c; if ($LASTEXITCODE -ne 0) { throw "Falhou: $c" } }

$projetos = (& gcloud projects list --filter="projectId:nexia-cortex-*" --format="value(projectId)") | Where-Object { $_ }
if (-not $projetos) { throw 'Nenhum banco nexia-cortex-* encontrado. Rode gcloud auth login com gcbezerra@gmail.com.' }
foreach ($p in $projetos) {
  $sa = "firebase-adminsdk-nexia@$p.iam.gserviceaccount.com"
  Write-Host "== Liberando indices em $p" -ForegroundColor Cyan
  & cmd /c "gcloud iam service-accounts describe $sa --project=$p >nul 2>nul"
  if ($LASTEXITCODE -ne 0) { Write-Host "   (sem a conta $sa, pulei)"; continue }
  Roda "gcloud projects add-iam-policy-binding $p --member=serviceAccount:$sa --role=roles/datastore.indexAdmin --condition=None"
}
Roda "gh workflow run publicar-indices.yml --repo $repo --ref develop -f confirm=COFRE"
Write-Host ''
Write-Host 'PRONTO. Os indices ficam prontos em alguns minutos e o Cortex passa a usar os bancos novos sozinho.' -ForegroundColor Green
