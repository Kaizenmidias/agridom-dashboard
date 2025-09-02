# 🚀 Guia Final de Deploy - WebDesign Dashboard

## ✅ Status Atual

**Preparação Completa!** Todos os arquivos necessários foram criados e configurados:

- ✅ Banco de dados MySQL configurado e importado
- ✅ Repositório GitHub sincronizado
- ✅ Script de deploy automático criado
- ✅ Webhook para automação configurado
- ✅ Variáveis de ambiente documentadas
- ✅ Guias detalhados de configuração

## 📋 Próximos Passos no cPanel

### 1. 🔧 Configurar Git Version Control

1. **Acesse o cPanel** do seu servidor
2. **Procure por "Git Version Control"**
3. **Clique em "Create"** e configure:
   - **Repository Path:** `/public_html/webdesign`
   - **Repository URL:** `https://github.com/Kaizenmidias/agridom-dashboard.git`
   - **Branch:** `main`
4. **Aguarde o clone** do repositório

### 2. 🟢 Configurar Node.js App

1. **Acesse "Node.js Apps"** no cPanel
2. **Clique em "Create App"**:
   - **Node.js Version:** `16.x` ou superior
   - **Application Mode:** `Production`
   - **Application Root:** `public_html/webdesign`
   - **Application URL:** `webdesign` (ou vazio para root)
   - **Application Startup File:** `server/server.js`

### 3. ⚙️ Configurar Variáveis de Ambiente

1. **No File Manager**, navegue até `/public_html/webdesign/server`
2. **Copie o arquivo `.env.production`** para `.env`
3. **Edite o arquivo `.env`** com suas configurações:

```env
# Suas configurações reais
DB_HOST=localhost
DB_USER=seu_usuario_cpanel_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=seu_banco_cpanel_mysql

# Gere uma chave JWT segura
JWT_SECRET=sua_chave_jwt_super_secreta

# Configure seu domínio
BASE_URL=https://seudominio.com
API_URL=https://seudominio.com/api
```

### 4. 📦 Instalar Dependências e Build

**No terminal da aplicação Node.js**, execute:

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

# Tornar script executável
chmod +x ../deploy.sh
```

### 5. 🧪 Testar a Aplicação

1. **Acesse:** `https://seudominio.com`
2. **Teste o login:**
   - **Email:** `admin@webdesign.com`
   - **Senha:** `admin123`
3. **Verifique a API:** `https://seudominio.com/api/health`

### 6. 🔄 Configurar Deploy Automático (Opcional)

1. **Copie `webhook.php`** para a raiz do domínio
2. **No GitHub**, vá em **Settings > Webhooks**
3. **Adicione webhook:**
   - **URL:** `https://seudominio.com/webhook.php`
   - **Content type:** `application/json`
   - **Secret:** (configure o mesmo valor no `.env`)
   - **Events:** `Just the push event`

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|----------|
| `deploy.sh` | Script de deploy automático |
| `webhook.php` | Webhook para automação |
| `.env.production` | Variáveis de ambiente |
| `CPANEL_GIT_SETUP.md` | Guia detalhado de configuração |
| `DEPLOY_CPANEL.md` | Documentação de deploy |
| `verificar-tabelas.sql` | Script de verificação do banco |

## 🔍 Troubleshooting

### Problemas Comuns

#### ❌ Erro 500 - Internal Server Error
```bash
# Verificar logs
tail -f ~/logs/nodejs_app_error.log
```

**Soluções:**
- Verificar se o `.env` existe e está configurado
- Conferir permissões dos arquivos
- Verificar se as dependências foram instaladas

#### ❌ Banco não conecta
- Verificar credenciais no `.env`
- Confirmar se o banco foi importado
- Testar conexão com `verificar-tabelas.sql`

#### ❌ Build falha
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build:prod
```

## 📞 Comandos Úteis

```bash
# Status do Git
git status

# Pull manual
git pull origin main

# Deploy manual
./deploy.sh

# Logs da aplicação
tail -f ~/logs/nodejs_app_error.log

# Reiniciar app
touch tmp/restart.txt

# Verificar processos
ps aux | grep node
```

## ✅ Checklist Final

- [ ] Git Repository configurado no cPanel
- [ ] Node.js App criada e rodando
- [ ] Arquivo `.env` configurado com dados reais
- [ ] Dependências instaladas (frontend e backend)
- [ ] Build do frontend realizado
- [ ] Arquivos copiados para public_html
- [ ] Script de deploy executável
- [ ] Aplicação acessível no browser
- [ ] Login funcionando
- [ ] API respondendo
- [ ] Webhook configurado (opcional)

## 🎯 Funcionalidades do Sistema

### 👤 Gestão de Usuários
- Login/logout seguro
- Recuperação de senha
- Perfis de usuário
- Controle de permissões

### 📊 Dashboard
- Visão geral de projetos
- Estatísticas de gastos
- Gráficos interativos
- Relatórios personalizados

### 💼 Gestão de Projetos
- Criação e edição de projetos
- Acompanhamento de status
- Gestão de prazos
- Histórico de atividades

### 💰 Controle Financeiro
- Registro de despesas
- Categorização de gastos
- Relatórios financeiros
- Controle de orçamento

### 📝 Sistema de Códigos
- Gestão de códigos de projeto
- Organização por categorias
- Busca e filtros
- Histórico de alterações

### 📋 Briefings
- Criação de briefings
- Templates personalizados
- Aprovação de clientes
- Versionamento

## 🔐 Segurança

- ✅ Autenticação JWT
- ✅ Senhas criptografadas
- ✅ Proteção CORS
- ✅ Rate limiting
- ✅ Validação de dados
- ✅ Logs de auditoria

## 🚀 Performance

- ✅ Build otimizado
- ✅ Compressão de assets
- ✅ Cache de API
- ✅ Lazy loading
- ✅ Otimização de imagens

---

## 🎉 Parabéns!

Seu **WebDesign Dashboard** está pronto para deploy! 

Siga os passos acima no cPanel e em poucos minutos você terá um sistema completo de gestão para sua agência de web design funcionando em produção.

**📧 Suporte:** Em caso de dúvidas, consulte os guias detalhados ou verifique os logs de erro.

**🔄 Atualizações:** Com o webhook configurado, toda alteração no GitHub será automaticamente deployada!

---

*Sistema desenvolvido para gestão completa de projetos de web design* 🎨