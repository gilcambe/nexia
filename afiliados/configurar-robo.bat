@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Configurar o robo de ofertas NEXIA
set REPO=gilcambe/nexia
echo.
echo  ==== Robo de ofertas NEXIA: configuracao ====
echo  Os codigos que voce digitar vao direto para o GitHub, escondidos.
echo  Nada fica salvo neste computador.
echo.

where gh >nul 2>nul
if errorlevel 1 (
  echo Instalando o GitHub CLI, so na primeira vez...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Nao achei o winget. Baixe e instale o GitHub CLI em https://cli.github.com e abra este arquivo de novo.
    pause
    exit /b 1
  )
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"
)
where gh >nul 2>nul
if errorlevel 1 (
  echo O GitHub CLI ainda nao aparece. Feche esta janela, abra o arquivo de novo e tente outra vez.
  pause
  exit /b 1
)

gh auth status >nul 2>nul
if errorlevel 1 (
  echo Vai abrir o navegador para entrar na sua conta do GitHub. Copie o codigo que aparecer aqui.
  gh auth login --hostname github.com --git-protocol https --web --scopes repo,workflow
)

set "LISTA=%TEMP%\nexia-segredos.txt"
if exist "%LISTA%" del "%LISTA%"
set /p SOFALTA=Configurar so os que faltam? (S/N): 
if /i "!SOFALTA!"=="S" gh secret list --repo %REPO% --json name -q ".[].name" > "%LISTA%" 2>nul

call :segredo SHOPEE_APP_ID "Portal de afiliados da Shopee, em Open API: App ID"
call :segredo SHOPEE_SECRET "Portal de afiliados da Shopee, em Open API: Secret"
call :segredo AMAZON_TAG "Amazon Associados: seu ID de loja, parece seunome-20"
call :segredo BLUESKY_HANDLE "Bluesky: seu nome completo, ex. achadosdodia.bsky.social"
call :segredo BLUESKY_APP_PASSWORD "Bluesky: Configuracoes, Privacidade, Senhas de app"
call :segredo X_API_KEY "developer.x.com, Keys and tokens: API Key"
call :segredo X_API_SECRET "developer.x.com, Keys and tokens: API Key Secret"
call :segredo X_ACCESS_TOKEN "developer.x.com, Keys and tokens: Access Token"
call :segredo X_ACCESS_SECRET "developer.x.com, Keys and tokens: Access Token Secret"
call :segredo META_PAGE_ID "Facebook: ID da pagina de ofertas"
call :segredo META_PAGE_TOKEN "Facebook: token da pagina (Graph API Explorer)"
call :segredo META_IG_USER_ID "Instagram profissional ligado a pagina: ID do usuario"
call :segredo PINTEREST_APP_ID "developers.pinterest.com: App ID"
call :segredo PINTEREST_APP_SECRET "developers.pinterest.com: App secret"
call :segredo PINTEREST_REFRESH_TOKEN "Pinterest: refresh token"
call :segredo PINTEREST_BOARD_ID "Pinterest: ID da pasta de ofertas"
call :segredo TELEGRAM_BOT_TOKEN "Telegram, so se usar: token do @BotFather"
call :segredo TELEGRAM_CANAL "Telegram, so se usar: @nome do canal"
if exist "%LISTA%" del "%LISTA%"

echo.
set /p TEMLINK=Tem links do Mercado Livre, Amazon ou Shopee para colar? (S/N): 
if /i "!TEMLINK!"=="S" (
  echo Cole um link por vez e aperte Enter. Para terminar, aperte Enter sem nada.
  call :links
)

echo.
echo Testando as contas (diagnostico)...
gh workflow run afiliados.yml --repo %REPO% -f acao=diagnostico
call :acompanhar
echo.
echo Rodando o robo agora...
gh workflow run afiliados.yml --repo %REPO% -f acao=rodar
call :acompanhar
echo.
echo Pronto. O site de ofertas fica em https://achados-nexia.pages.dev
set /p VER=Abrir a rodada no navegador? (S/N): 
if /i "!VER!"=="S" gh run view !RUNID! --repo %REPO% --web
pause
exit /b 0

:segredo
set "NOME=%~1"
if exist "%LISTA%" (
  findstr /x /c:"%NOME%" "%LISTA%" >nul 2>nul
  if not errorlevel 1 (
    echo %NOME%: ja configurado, pulando.
    exit /b 0
  )
)
echo.
echo %NOME%  ^(onde pegar: %~2^)
set "RESP="
set /p RESP=Configurar %NOME%? (S/N): 
if /i not "!RESP!"=="S" exit /b 0
echo Cole o valor e aperte Enter. Ele nao aparece na tela.
gh secret set %NOME% --repo %REPO%
if errorlevel 1 echo Nao deu certo para %NOME%. Seguindo com os outros.
exit /b 0

:links
set "LINK="
set /p LINK=Link: 
if not defined LINK exit /b 0
gh workflow run afiliados.yml --repo %REPO% -f acao=adicionar -f "link=!LINK!"
if errorlevel 1 echo Nao consegui mandar esse link. Confira e tente de novo.
goto links

:acompanhar
timeout /t 6 /nobreak >nul
set "RUNID="
for /f "delims=" %%i in ('gh run list --repo %REPO% --workflow afiliados.yml --limit 1 --json databaseId -q ".[0].databaseId"') do set "RUNID=%%i"
if not defined RUNID (
  echo Nao achei a rodada. Veja em https://github.com/%REPO%/actions
  exit /b 0
)
gh run watch !RUNID! --repo %REPO% --exit-status
if errorlevel 1 echo Essa rodada teve erro. Mande a tela para o Claude ver.
exit /b 0
