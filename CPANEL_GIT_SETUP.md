# 🔧 Configuração Git Version Control no cPanel

Guia passo a passo para configurar deploy automático via Git no cPanel.

## 📋 Pré-requisitos

- ✅ Banco de dados MySQL importado
- ✅ Repositório GitHub configurado: `https://github.com/Kaizenmidias/agridom-dashboard.git`
- ✅ Acesso ao cPanel com Git Version Control habilitado

## 🚀 Passo 1: Configurar Git Repository no cPanel

### 1.1 Acessar Git Version Control

1. Faça login no seu **cPanel**
2. Procure por **"Git Version Control"** na seção de arquivos
3. Clique em **"Git Version Control"**

### 1.2 Criar Repositório

1. Clique em **"Create"**
2. Preencha os campos:

   **Repository Path:** `/public_html/webdesign`
   
   **Repository URL:** `https://github.com/Kaizenmidias/agridom-dashboard.git`
   
   **Branch:** `main`
   
   **Repository Name:** `webdesign-dashboard` (opcional)

3. Clique em **"Create"**

### 1.3 Aguardar Clone

- O cPanel irá clonar o repositório automaticamente
- Aguarde a mensagem de sucesso
- Verifique se os arquivos foram copiados para `/public_html/webdesign`

## 🔧 Passo 2: Configurar Node.js App

### 2.1 Criar Aplicação Node.js

1. No cPanel, procure por **"Node.js Apps"**
2. Clique em **"Create App"**
3. Configure:

   **Node.js Version:** `16.x` ou superior
   
   **Application Mode:** `Production`
   
   **Application Root:** `public_html/webdesign`
   
   **Application URL:** `webdesign` (ou deixe em branco para root)
   
   **Application Startup File:** `server/server.js`

4. Clique em **"Create"**

### 2.2 Instalar Dependências

1. Na lista de aplicações Node.js, clique no nome da sua app
2. No terminal que abrir, execute:

```bash
# Instalar dependências do frontend
npm install

# Fazer build do frontend
npm run build:prod

# Copiar arquivos para public_html
cp -r dist/* ../

# Instalar dependências do backend
cd server
npm install --production
```

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

### 3.1 Criar arquivo .env no servidor

1. No **File Manager** do cPanel, navegue até `/public_html/webdesign/server`
2. Crie um arquivo chamado `.env`
3. Adicione o conteúdo:

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=seu_banco_mysql

# JWT Secret (gere uma chave segura)
JWT_SECRET=sua_chave_jwt_super_secreta_aqui

# Configurações do Servidor
PORT=3000
NODE_ENV=production

# Email (opcional - para recuperação de senha)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
```

### 3.2 Configurar Variáveis no Node.js App

1. Na seção **Node.js Apps**, clique na sua aplicação
2. Vá para a aba **"Environment Variables"**
3. Adicione as mesmas variáveis do arquivo `.env`

## 🔄 Passo 4: Configurar Deploy Automático

### 4.1 Tornar script executável

1. No terminal da aplicação Node.js, execute:

```bash
chmod +x deploy.sh
```

### 4.2 Testar deploy manual

```bash
./deploy.sh
```

### 4.3 Configurar Webhook (Opcional)

1. Crie um arquivo `webhook.php` na raiz do seu domínio:

```php
<?php
// webhook.php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

// Log do webhook
file_put_contents('webhook.log', date('Y-m-d H:i:s') . " - Webhook recebido\n", FILE_APPEND);

// Executar deploy
$output = shell_exec('cd /home/'.get_current_user().'/public_html/webdesign && ./deploy.sh 2>&1');

// Log do resultado
file_put_contents('webhook.log', date('Y-m-d H:i:s') . " - Deploy: " . $output . "\n", FILE_APPEND);

echo 'Deploy executado com sucesso!';
?>
```

2. No GitHub, vá em **Settings > Webhooks**
3. Adicione webhook:
   - **URL:** `https://seudominio.com/webhook.php`
   - **Content type:** `application/json`
   - **Events:** `Just the push event`

## 🧪 Passo 5: Testar a Aplicação

### 5.1 Verificar Frontend

1. Acesse: `https://seudominio.com`
2. Deve aparecer a tela de login

### 5.2 Testar Login

- **Email:** `admin@webdesign.com`
- **Senha:** `admin123`

### 5.3 Verificar API

1. Teste: `https://seudominio.com/api/health`
2. Deve retornar status da API

## 🔍 Troubleshooting

### Problemas Comuns

#### 1. Erro 500 - Internal Server Error

```bash
# Verificar logs
tail -f ~/logs/nodejs_app_error.log
tail -f ~/logs/error_log
```

**Soluções:**
- Verificar se o arquivo `.env` existe
- Conferir permissões dos arquivos
- Verificar se as dependências foram instaladas

#### 2. Banco de dados não conecta

**Verificar:**
- Credenciais no arquivo `.env`
- Se o banco foi importado corretamente
- Se o usuário MySQL tem permissões

#### 3. Build falha

```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build:prod
```

#### 4. Deploy não funciona

```bash
# Verificar permissões
chmod +x deploy.sh

# Testar manualmente
./deploy.sh

# Verificar logs
tail -f webhook.log
```

## 📚 Comandos Úteis

```bash
# Ver status do Git
git status

# Fazer pull manual
git pull origin main

# Verificar logs da aplicação
tail -f ~/logs/nodejs_app_error.log

# Reiniciar aplicação
touch tmp/restart.txt

# Verificar processos Node.js
ps aux | grep node

# Verificar porta da aplicação
netstat -tulpn | grep :3000
```

## ✅ Checklist Final

- [ ] Git Repository configurado no cPanel
- [ ] Node.js App criada e funcionando
- [ ] Arquivo `.env` configurado
- [ ] Dependências instaladas (frontend e backend)
- [ ] Build do frontend realizado
- [ ] Arquivos copiados para public_html
- [ ] Script de deploy executável
- [ ] Aplicação acessível via browser
- [ ] Login funcionando
- [ ] API respondendo
- [ ] Webhook configurado (opcional)

🎉 **Parabéns! Seu deploy automático está configurado!**

---

**📞 Suporte:**
- Verifique logs em caso de problemas
- Teste sempre em ambiente de desenvolvimento primeiro
- Mantenha backups regulares
- Monitore o desempenho da aplicação