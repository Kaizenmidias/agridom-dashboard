#!/bin/bash

# Script de Deploy Automático para cPanel
# WebDesign Dashboard

echo "🚀 Iniciando deploy automático do WebDesign Dashboard..."

# Definir variáveis
PROJECT_DIR="/home/$(whoami)/public_html/webdesign"
BACKUP_DIR="/home/$(whoami)/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

echo "📁 Navegando para o diretório do projeto: $PROJECT_DIR"
cd $PROJECT_DIR

# Criar backup antes do deploy
echo "💾 Criando backup: webdesign_$DATE.tar.gz"
tar -czf $BACKUP_DIR/webdesign_$DATE.tar.gz $PROJECT_DIR

# Manter apenas os 5 backups mais recentes
ls -t $BACKUP_DIR/webdesign_*.tar.gz | tail -n +6 | xargs rm -f

echo "📥 Fazendo pull das mudanças do GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Erro ao fazer pull do repositório"
    exit 1
fi

echo "📦 Instalando dependências do frontend..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do frontend"
    exit 1
fi

echo "🏗️ Fazendo build do frontend..."
npm run build:prod

if [ $? -ne 0 ]; then
    echo "❌ Erro no build do frontend"
    exit 1
fi

echo "📂 Copiando arquivos do frontend para public_html..."
cp -r dist/* ../

echo "🔧 Configurando backend..."
cd server

echo "📦 Instalando dependências do backend..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências do backend"
    exit 1
fi

echo "🔄 Reiniciando aplicação Node.js..."
# Método comum para reiniciar apps Node.js no cPanel
touch tmp/restart.txt

# Verificar se existe arquivo de configuração específico do cPanel
if [ -f "restart.txt" ]; then
    touch restart.txt
fi

echo "🔍 Verificando arquivos de configuração..."
if [ ! -f ".env" ]; then
    echo "⚠️ ATENÇÃO: Arquivo .env não encontrado!"
    echo "📝 Copie o arquivo .env.example e configure as variáveis de ambiente"
fi

echo "✅ Deploy concluído com sucesso!"
echo "📊 Estatísticas do deploy:"
echo "   - Backup criado: webdesign_$DATE.tar.gz"
echo "   - Commit atual: $(git rev-parse --short HEAD)"
echo "   - Data/Hora: $(date)"
echo "   - Usuário: $(whoami)"

echo "🌐 Acesse sua aplicação em: https://seudominio.com"
echo "🔧 API disponível em: https://seudominio.com/api"

echo "📋 Próximos passos:"
echo "   1. Verificar se a aplicação está funcionando"
echo "   2. Testar login com: admin@webdesign.com / admin123"
echo "   3. Configurar variáveis de ambiente se necessário"
echo "   4. Verificar logs em caso de problemas"

echo "🎉 Deploy finalizado!"