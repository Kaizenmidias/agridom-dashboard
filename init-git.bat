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
echo ==========================================
echo           REPOSITÓRIO PRONTO!
echo ==========================================
echo.
echo 📋 Próximos passos:
echo.
echo 1. Crie um repositório no GitHub:
echo    https://github.com/new
echo.
echo 2. Conecte o repositório local:
echo    git remote add origin https://github.com/SEU_USUARIO/agridom-dashboard.git
echo.
echo 3. Faça o primeiro push:
echo    git push -u origin main
echo.
echo 4. Configure o deploy automático seguindo o guia:
echo    GITHUB_CPANEL_DEPLOY.md
echo.
echo ✅ Repositório Git inicializado com sucesso!
echo.
pause