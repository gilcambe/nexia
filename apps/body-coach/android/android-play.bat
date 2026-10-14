@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
set REPO=gilcambe/nexia
set PASTA=%USERPROFILE%\Documents\NEXIA-chave-android
set KS=%PASTA%\upload.keystore
title NEXIA Body Coach - Google Play
echo ==============================================
echo  NEXIA Body Coach - gerar o app da Google Play
echo ==============================================
where gh >nul 2>nul || (
  echo Instalando o GitHub CLI...
  winget install -e --id GitHub.cli --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"
)
gh auth status >nul 2>nul || gh auth login --web --scopes repo,workflow
if exist "%KS%" goto :temchave
set KT=
for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\*") do if exist "%%D\bin\keytool.exe" set "KT=%%D\bin\keytool.exe"
if not defined KT (
  echo Instalando o Java, que so serve para criar a chave do app...
  winget install -e --id EclipseAdoptium.Temurin.17.JRE --accept-source-agreements --accept-package-agreements
  for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\*") do if exist "%%D\bin\keytool.exe" set "KT=%%D\bin\keytool.exe"
)
if not defined KT (
  echo Nao achei o Java. Feche esta janela e rode este arquivo de novo.
  pause
  exit /b 1
)
:senha
echo.
set "SENHA="
set /p SENHA=Crie uma senha para a chave do app (so letras e numeros, minimo 8): 
if "!SENHA:~7,1!"=="" ( echo Senha curta demais. & goto :senha )
echo !SENHA!| findstr /r /x "[a-zA-Z0-9]*" >nul || ( echo Use so letras e numeros. & goto :senha )
mkdir "%PASTA%" 2>nul
"!KT!" -genkeypair -keystore "%KS%" -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storepass %SENHA% -keypass %SENHA% -dname "CN=NEXIA Body Coach, O=NEXIA, C=BR"
if errorlevel 1 ( echo Erro ao criar a chave. & pause & exit /b 1 )
> "%PASTA%\SENHA-DA-CHAVE.txt" echo Senha da chave do app Body Coach: %SENHA%
echo.
echo IMPORTANTE: copie a pasta %PASTA% para um pendrive e para o Google Drive.
echo Sem ela voce nao consegue mandar atualizacoes do app para a Google Play.
pause
goto :segredos
:temchave
echo A chave ja existe em %PASTA%. Vou usar a mesma.
gh secret list --repo %REPO% | findstr /b /c:"ANDROID_KEYSTORE_B64" >nul && goto :gerar
set /p SENHA=Digite a senha da chave (esta em %PASTA%\SENHA-DA-CHAVE.txt): 
:segredos
echo Guardando a chave escondida no GitHub...
powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes($env:KS))" > "%TEMP%\ks.b64"
gh secret set ANDROID_KEYSTORE_B64 --repo %REPO% < "%TEMP%\ks.b64"
del "%TEMP%\ks.b64"
<nul set /p "=%SENHA%"| gh secret set ANDROID_KEYSTORE_PASS --repo %REPO%
:gerar
echo.
echo Gerando o app no GitHub. Leva uns 10 minutos, deixe esta janela aberta...
gh workflow run android-play.yml --repo %REPO% --ref develop
if errorlevel 1 ( echo Nao consegui iniciar. Mande um print desta tela para o Claude. & pause & exit /b 1 )
timeout /t 10 >nul
for /f %%i in ('gh run list --repo %REPO% --workflow android-play.yml --limit 1 --json databaseId -q ".[0].databaseId"') do set RUN=%%i
gh run watch !RUN! --repo %REPO% --exit-status
if errorlevel 1 ( echo O app nao foi gerado. Mande um print desta tela para o Claude. & pause & exit /b 1 )
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESK=%%d"
set "SAIDA=!DESK!\BodyCoach-GooglePlay"
rmdir /s /q "!SAIDA!" 2>nul
gh run download !RUN! --repo %REPO% -n body-coach-play -D "!SAIDA!"
echo.
echo PRONTO! O arquivo app-release-bundle.aab esta na pasta BodyCoach-GooglePlay da sua Area de Trabalho.
echo Agora suba esse arquivo no Google Play Console, em Teste fechado.
explorer "!SAIDA!"
start "" https://play.google.com/console
pause
