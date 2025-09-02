# 🚀 Guia Completo de Deploy para cPanel

Este guia irá te ajudar a colocar o projeto AgriDom Dashboard em produção usando hospedagem compartilhada com cPanel.

## 📋 Pré-requisitos

- Hospedagem compartilhada com cPanel
- Suporte a Node.js (versão 16+ recomendada)
- MySQL disponível
- Domínio configurado
- Acesso FTP ou File Manager

## 🛠️ Passo 1: Preparar os Arquivos Localmente

### 1.1 Build do Frontend
```bash
# No diretório raiz do projeto
npm run build:cpanel
```

Este comando irá:
- Fazer o build otimizado do React
- Preparar todos os arquivos para upload
- Criar a pasta `deploy-cpanel` com a estrutura correta

### 1.2 Estrutura Gerada
```
deploy-cpanel/
├── public_html/          # Arquivos do frontend
│   ├── index.html
│   ├── assets/
│   └── .htaccess
├── backend/              # Arquivos do servidor
│   ├── server.js
│   ├── package.json
│   ├── .env.production
│   ├── routes/
│   ├── middleware/
│   └── utils/
└── INSTRUCOES_DEPLOY.md  # Este arquivo
```

## 🗄️ Passo 2: Configurar o Banco de Dados

### 2.1 Criar Banco MySQL
1. Acesse o cPanel
2. Vá em **MySQL Databases**
3. Crie um novo banco de dados:
   - Nome: `agridom_prod` (ou outro de sua escolha)
4. Crie um usuário MySQL:
   - Usuário: `agridom_user`
   - Senha: (gere uma senha forte)
5. Associe o usuário ao banco com **ALL PRIVILEGES**

### 2.2 Importar Estrutura do Banco
1. Acesse **phpMyAdmin** no cPanel
2. Selecione o banco criado
3. Vá na aba **Import**
4. Faça upload do arquivo `database/setup-mysql.sql`
5. Execute a importação

## 📁 Passo 3: Upload dos Arquivos

### 3.1 Frontend (public_html)
1. Acesse o **File Manager** no cPanel
2. Navegue até `public_html/`
3. Faça upload de todos os arquivos da pasta `deploy-cpanel/public_html/`
4. **IMPORTANTE**: Certifique-se de que o arquivo `.htaccess` foi enviado

### 3.2 Backend
1. Crie uma pasta `backend` em `public_html/backend/`
2. Faça upload de todos os arquivos da pasta `deploy-cpanel/backend/`
3. Ou coloque em um diretório fora do `public_html` se preferir

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

### 4.1 Editar .env.production
No arquivo `backend/.env.production`, atualize:

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=seu_banco_dados
DB_PORT=3306

# URLs do seu domínio
FRONTEND_URL=https://seudominio.com
BACKEND_URL=https://seudominio.com/backend
CORS_ORIGIN=https://seudominio.com

# Chaves de segurança (GERE NOVAS!)
JWT_SECRET=sua_chave_jwt_muito_forte_aqui_32_caracteres_minimo
SESSION_SECRET=outra_chave_secreta_para_sessoes

# Configurações de Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app_gmail
EMAIL_FROM=noreply@seudominio.com
```

### 4.2 Gerar Chaves Seguras
Para gerar chaves JWT seguras, use:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Passo 5: Configurar Node.js no cPanel

### 5.1 Criar Aplicação Node.js
1. No cPanel, acesse **Node.js App**
2. Clique em **Create Application**
3. Configure:
   - **Node.js Version**: 18.x ou superior
   - **Application Mode**: Production
   - **Application Root**: `backend` (ou caminho onde colocou)
   - **Application URL**: `backend` (será acessível em seudominio.com/backend)
   - **Application Startup File**: `server.js`
   - **Environment Variables**: Adicione `NODE_ENV=production`

### 5.2 Instalar Dependências
1. No terminal da aplicação Node.js (ou SSH se disponível):
```bash
cd /home/seuusuario/public_html/backend
npm install --production
```

### 5.3 Iniciar Aplicação
1. No painel Node.js, clique em **Start**
2. Verifique se o status está "Running"

## 🔧 Passo 6: Configurações Finais

### 6.1 Verificar .htaccess do Frontend
Certifique-se de que o arquivo `.htaccess` em `public_html` contém:
```apache
RewriteEngine On
RewriteBase /

# Redirecionar API para backend
RewriteRule ^api/(.*)$ /backend/server.js/$1 [L,QSA]

# SPA routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### 6.2 Configurar SSL
1. No cPanel, vá em **SSL/TLS**
2. Ative o **Force HTTPS Redirect**
3. Instale certificado SSL (Let's Encrypt gratuito)

### 6.3 Configurar Permissões
```bash
# Permissões recomendadas
find public_html -type d -exec chmod 755 {} \;
find public_html -type f -exec chmod 644 {} \;
chmod 755 backend/server.js
```

## 🧪 Passo 7: Testar a Aplicação

### 7.1 Testes Básicos
1. **Frontend**: Acesse `https://seudominio.com`
2. **API Health**: Acesse `https://seudominio.com/backend/api/health`
3. **Login**: Teste o login com:
   - Email: `admin@agridom.com`
   - Senha: `admin123`
   - **⚠️ ALTERE A SENHA IMEDIATAMENTE!**

### 7.2 Verificar Logs
1. No cPanel Node.js, verifique os logs da aplicação
2. Procure por erros de conexão ou configuração

## 🔍 Troubleshooting

### Problemas Comuns

#### Frontend não carrega
- ✅ Verifique se o `.htaccess` foi enviado
- ✅ Confirme se o SSL está ativo
- ✅ Verifique permissões dos arquivos

#### API não funciona
- ✅ Verifique se a aplicação Node.js está rodando
- ✅ Confirme as configurações do `.env.production`
- ✅ Verifique os logs no painel Node.js

#### Erro de banco de dados
- ✅ Confirme credenciais no `.env.production`
- ✅ Verifique se o banco foi criado corretamente
- ✅ Teste conexão no phpMyAdmin

#### Problemas de CORS
- ✅ Verifique `CORS_ORIGIN` no `.env.production`
- ✅ Confirme se as URLs estão corretas

### Logs Úteis
```bash
# Ver logs da aplicação Node.js
tail -f ~/logs/nodejs_app_error.log

# Ver logs do Apache
tail -f ~/logs/access_log
tail -f ~/logs/error_log
```

## 🔄 Atualizações Futuras

Para atualizar a aplicação:

1. **Frontend**:
   ```bash
   npm run build:cpanel
   # Upload apenas dos arquivos em deploy-cpanel/public_html/
   ```

2. **Backend**:
   - Pare a aplicação Node.js no cPanel
   - Faça upload dos novos arquivos
   - Execute `npm install` se houver novas dependências
   - Reinicie a aplicação

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no cPanel
2. Confirme todas as configurações
3. Teste cada componente individualmente
4. Entre em contato com o suporte da hospedagem se necessário

---

**✅ Checklist Final:**
- [ ] Banco de dados criado e configurado
- [ ] Arquivos do frontend enviados para public_html
- [ ] Arquivos do backend enviados e configurados
- [ ] Variáveis de ambiente atualizadas
- [ ] Aplicação Node.js criada e rodando
- [ ] SSL configurado e ativo
- [ ] Testes básicos realizados
- [ ] Senha do admin alterada

🎉 **Parabéns! Sua aplicação está em produção!**