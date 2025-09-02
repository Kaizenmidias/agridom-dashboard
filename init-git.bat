@echo off
echo ==========================================
echo    INICIALIZANDO REPOSITORIO GIT
echo ==========================================
echo.

REM Verificar se Git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git não está instalado ou não está no PATH
    echo Por favor, instale o Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo ✅ Git encontrado!
echo.

REM Verificar se já é um repositório Git
if exist ".git" (
    echo ⚠️  Este diretório já é um repositório Git
    echo.
    choice /c YN /m "Deseja continuar mesmo assim? (Y/N)"
    if errorlevel 2 exit /b 0
    echo.
)

REM Inicializar repositório
echo 📦 Inicializando repositório Git...
git init
if %errorlevel% neq 0 (
    echo ❌ Erro ao inicializar repositório
    pause
    exit /b 1
)

echo ✅ Repositório inicializado!
echo.

REM Configurar usuário (se não estiver configurado)
for /f "tokens=*" %%i in ('git config --global user.name 2^>nul') do set USERNAME=%%i
for /f "tokens=*" %%i in ('git config --global user.email 2^>nul') do set USEREMAIL=%%i

if "%USERNAME%"=="" (
    echo ⚙️  Configurando usuário Git...
    set /p USERNAME="Digite seu nome: "
    git config --global user.name "%USERNAME%"
)

if "%USEREMAIL%"=="" (
    echo ⚙️  Configurando email Git...
    set /p USEREMAIL="Digite seu email: "
    git config --global user.email "%USEREMAIL%"
)

echo ✅ Usuário configurado: %USERNAME% (%USEREMAIL%)
echo.

REM Adicionar arquivos
echo 📁 Adicionando arquivos ao repositório...
git add .
if %errorlevel% neq 0 (
    echo ❌ Erro ao adicionar arquivos
    pause
    exit /b 1
)

echo ✅ Arquivos adicionados!
echo.

REM Fazer commit inicial
echo 💾 Fazendo commit inicial...
git commit -m "Initial commit: AgriDom Dashboard"
if %errorlevel% neq 0 (
    echo ❌ Erro ao fazer commit
    pause
    exit /b 1
)

echo ✅ Commit inicial realizado!
echo.

REM Renomear branch para main
echo 🌿 Configurando branch principal como 'main'...
git branch -M main

echo.
echo ========================================
echo   CONECTAR AO GITHUB
echo ========================================
echo.
echo ATENCAO: Se voce teve erro "Repository not found",
echo o repositorio kaizenmidias/agridom-dashboard nao existe!
echo.
echo Escolha uma opcao:
echo 1. Usar repositorio original (RECOMENDADO)
echo 2. Criar novo repositorio
echo 3. Solicitar criacao do repositorio kaizenmidias
echo.
set /p choice="Digite sua escolha (1-3): "

if "%choice%"=="1" (
    echo.
    echo Removendo remote incorreto (se existir)...
    git remote remove origin 2>nul
    echo.
    echo Conectando ao repositorio original...
    git remote add origin https://github.com/tiagoo4000/agri-dom-5238.git
    echo.
    echo Fazendo o push...
    git push -u origin main
    echo.
    echo ✅ Sucesso! Repositorio conectado e atualizado.
) else if "%choice%"=="2" (
    echo.
    echo Para criar um novo repositorio:
    echo 1. Va para https://github.com/new
    echo 2. Nome do repositorio: agridom-dashboard
    echo 3. Deixe como publico
    echo 4. NAO inicialize com README
    echo 5. Execute os comandos abaixo:
    echo.
    echo git remote remove origin
    echo git remote add origin https://github.com/SEU_USUARIO/agridom-dashboard.git
    echo git push -u origin main
) else if "%choice%"=="3" (
    echo.
    echo Para usar o repositorio kaizenmidias:
    echo 1. Contate o usuario kaizenmidias
    echo 2. Solicite a criacao do repositorio agridom-dashboard
    echo 3. Ou peca acesso de colaborador
    echo 4. Depois execute:
    echo.
    echo git remote add origin https://github.com/kaizenmidias/agridom-dashboard.git
    echo git push -u origin main
) else (
    echo Opcao invalida!
    goto end
)

:end
echo.
echo ✅ Repositório Git inicializado com sucesso!
echo.
pause