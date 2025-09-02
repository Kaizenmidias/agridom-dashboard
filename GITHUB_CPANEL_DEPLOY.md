# 🚀 Deploy Automático: GitHub + cPanel

Este guia mostra como configurar seu projeto no GitHub e fazer deploy automático para o cPanel usando Git.

## 📋 Pré-requisitos

- Conta no GitHub
- cPanel com suporte a Git (Node.js App)
- SSH habilitado na hospedagem (opcional, mas recomendado)

## 🔧 Configuração Inicial

### 1. Preparar o Projeto para Git

Primeiro, vamos criar um `.gitignore` adequado:

```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
dist/
build/
deploy-cpanel/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.db
*.sqlite
*.sqlite3

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Uploads (opcional - remova se quiser versionar)
uploads/

# Temporary files
tmp/
temp/
```

### 2. Inicializar Repositório Git

```bash
# No diretório do projeto
git init
git add .
git commit -m "Initial commit: AgriDom Dashboard"
```

### 3. Criar Repositório no GitHub

1. Acesse [GitHub](https://github.com)
2. Clique em "New repository"
3. Configure:
   - **Repository name**: `agridom-dashboard`
   - **Description**: `Dashboard moderno para gestão agrícola`
   - **Visibility**: Private (recomendado) ou Public
   - **NÃO** marque "Initialize with README" (já temos um)

4. Após criar, conecte o repositório local:

```bash
git remote add origin https://github.com/SEU_USUARIO/agridom-dashboard.git
git branch -M main
git push -u origin main
```

## 🔄 Deploy Automático via cPanel

### Método 1: Git Repository (Recomendado)

#### 1.1 Configurar no cPanel

1. **Acesse Git Version Control** no cPanel
2. Clique em **"Create"**
3. Configure:
   - **Repository Path**: `/public_html/agridom` (ou outro diretório)
   - **Repository URL**: `https://github.com/SEU_USUARIO/agridom-dashboard.git`
   - **Branch**: `main`

#### 1.2 Configurar Deploy Hook

Crie um script de deploy automático:

```bash
# No cPanel, vá em File Manager
# Crie o arquivo: /public_html/agridom/deploy.sh

#!/bin/bash
echo "🚀 Iniciando deploy automático..."

# Navegar para o diretório do projeto
cd /home/SEU_USUARIO/public_html/agridom

# Fazer pull das mudanças
git pull origin main

# Instalar dependências do frontend
npm install

# Build do frontend
npm run build:prod

# Copiar arquivos para public_html
cp -r dist/* ../

# Instalar dependências do backend
cd server
npm install --production

# Reiniciar aplicação Node.js
# (Isso varia dependendo do cPanel)
touch tmp/restart.txt

echo "✅ Deploy concluído!"
```

#### 1.3 Tornar o Script Executável

```bash
chmod +x deploy.sh
```

### Método 2: Webhook Automático

#### 2.1 Criar Script de Webhook

Crie um arquivo PHP para receber webhooks do GitHub:

```php
<?php
// webhook.php

// Verificar se é uma requisição POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

// Verificar secret (opcional, mas recomendado)
$secret = 'SEU_SECRET_AQUI';
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$payload = file_get_contents('php://input');

if ($secret && !hash_equals('sha256=' . hash_hmac('sha256', $payload, $secret), $signature)) {
    http_response_code(403);
    exit('Forbidden');
}

// Log do webhook
file_put_contents('webhook.log', date('Y-m-d H:i:s') . " - Webhook recebido\n", FILE_APPEND);

// Executar deploy
$output = shell_exec('cd /home/SEU_USUARIO/public_html/agridom && ./deploy.sh 2>&1');

// Log do resultado
file_put_contents('webhook.log', date('Y-m-d H:i:s') . " - Deploy: " . $output . "\n", FILE_APPEND);

echo 'Deploy executado com sucesso!';
?>
```

#### 2.2 Configurar Webhook no GitHub

1. No seu repositório GitHub, vá em **Settings > Webhooks**
2. Clique em **"Add webhook"**
3. Configure:
   - **Payload URL**: `https://seudominio.com/webhook.php`
   - **Content type**: `application/json`
   - **Secret**: (mesmo usado no PHP)
   - **Events**: "Just the push event"

## 🔧 Configuração Avançada

### Deploy com Branches Específicas

Modifique o `deploy.sh` para diferentes ambientes:

```bash
#!/bin/bash

# Verificar branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 Deploy da branch: $BRANCH"

if [ "$BRANCH" = "main" ]; then
    echo "📦 Deploy de PRODUÇÃO"
    npm run build:prod
    cp .env.production .env
elif [ "$BRANCH" = "staging" ]; then
    echo "🧪 Deploy de STAGING"
    npm run build:dev
    cp .env.staging .env
else
    echo "❌ Branch não configurada para deploy"
    exit 1
fi

# Continuar com o deploy...
```

### Backup Automático

Adicione backup antes do deploy:

```bash
#!/bin/bash

# Criar backup
BACKUP_DIR="/home/SEU_USUARIO/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/agridom_$DATE.tar.gz /home/SEU_USUARIO/public_html/agridom

# Manter apenas os 5 backups mais recentes
ls -t $BACKUP_DIR/agridom_*.tar.gz | tail -n +6 | xargs rm -f

echo "💾 Backup criado: agridom_$DATE.tar.gz"

# Continuar com deploy...
```

## 📝 Workflow Recomendado

### 1. Desenvolvimento Local

```bash
# Fazer mudanças no código
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

### 2. Deploy Automático

O webhook ou pull manual no cPanel irá:
1. Baixar as mudanças
2. Instalar dependências
3. Fazer build
4. Atualizar arquivos
5. Reiniciar serviços

### 3. Verificação

1. Verificar logs: `tail -f webhook.log`
2. Testar aplicação: `https://seudominio.com`
3. Verificar API: `https://seudominio.com/backend/api/health`

## 🔒 Segurança

### Variáveis de Ambiente

**NUNCA** commite arquivos `.env` com dados sensíveis!

1. Use `.env.example` como template
2. Configure variáveis diretamente no servidor
3. Use secrets do GitHub para CI/CD

### Exemplo .env.example

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=seu_banco

# JWT
JWT_SECRET=sua_chave_secreta_aqui

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de permissão**:
   ```bash
   chmod +x deploy.sh
   chmod 755 webhook.php
   ```

2. **Node.js não encontrado**:
   ```bash
   # Adicionar ao deploy.sh
   export PATH="/opt/cpanel/ea-nodejs16/bin:$PATH"
   ```

3. **Webhook não funciona**:
   - Verificar URL do webhook
   - Conferir logs: `tail -f webhook.log`
   - Testar manualmente: `curl -X POST https://seudominio.com/webhook.php`

4. **Build falha**:
   - Verificar se todas as dependências estão no `package.json`
   - Conferir versão do Node.js no servidor
   - Verificar logs de erro

### Logs Úteis

```bash
# Ver logs do webhook
tail -f webhook.log

# Ver logs do Node.js (varia por cPanel)
tail -f ~/logs/nodejs_app_error.log

# Ver logs do Apache
tail -f ~/logs/error_log
```

## 📚 Recursos Adicionais

- [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [cPanel Git Version Control](https://docs.cpanel.net/cpanel/software/git-version-control/)
- [Node.js Apps in cPanel](https://docs.cpanel.net/cpanel/software/nodejs-apps/)

---

**✅ Checklist de Deploy:**
- [ ] Repositório GitHub criado
- [ ] `.gitignore` configurado
- [ ] Variáveis de ambiente seguras
- [ ] Script de deploy criado
- [ ] Webhook configurado (opcional)
- [ ] Backup automático configurado
- [ ] Deploy testado

🎉 **Agora você tem deploy automático do GitHub para o cPanel!**