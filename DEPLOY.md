# Guia de Deploy - Vercel + Supabase

Este guia explica como configurar e fazer o deploy do projeto na Vercel usando Supabase como banco de dados.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com)
- Conta na [Vercel](https://vercel.com)
- Node.js instalado localmente

## 🗄️ Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em "New Project"
3. Escolha sua organização
4. Defina:
   - **Name**: `agridom-dashboard`
   - **Database Password**: Uma senha forte (anote-a!)
   - **Region**: Escolha a região mais próxima (ex: South America)
5. Clique em "Create new project"

### 2. Configurar o Banco de Dados

1. Aguarde o projeto ser criado (pode levar alguns minutos)
2. No painel do Supabase, vá para **SQL Editor**
3. Copie todo o conteúdo do arquivo `database/setup-supabase.sql`
4. Cole no SQL Editor e execute
5. Verifique se todas as tabelas foram criadas na aba **Table Editor**

### 3. Obter Credenciais do Supabase

No painel do Supabase, vá para **Settings > Database**:

- **Host**: `db.xxx.supabase.co` (onde xxx é seu project ref)
- **Database name**: `postgres`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: A senha que você definiu na criação

Vá para **Settings > API** e anote:
- **Project URL**: `https://xxx.supabase.co`
- **anon public**: Sua chave pública
- **service_role**: Sua chave de serviço (mantenha secreta!)

## 🚀 Deploy na Vercel

### 1. Preparar o Repositório

1. Faça commit de todas as alterações:
```bash
git add .
git commit -m "Configuração para Supabase e Vercel"
git push
```

### 2. Conectar à Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em "New Project"
3. Importe seu repositório do GitHub
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (raiz do projeto)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install && cd server && npm install`

### 3. Configurar Variáveis de Ambiente

Na Vercel, vá para **Settings > Environment Variables** e adicione:

```env
# Banco de Dados Supabase
SUPABASE_DB_HOST=db.xxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=sua_senha_supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=sua_chave_publica
SUPABASE_SERVICE_ROLE_KEY=sua_chave_servico

# JWT
JWT_SECRET=uma_chave_secreta_muito_forte_aqui
JWT_EXPIRES_IN=7d

# Email (configure conforme seu provedor)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
FROM_EMAIL=noreply@seudominio.com

# Frontend
FRONTEND_URL=https://seu-projeto.vercel.app

# Servidor
PORT=3001
NODE_ENV=production
```

**⚠️ Importante**: Substitua `xxx` pelo seu project reference do Supabase e configure suas próprias credenciais.

### 4. Deploy

1. Clique em "Deploy"
2. Aguarde o build completar
3. Teste sua aplicação no URL fornecido pela Vercel

## 🔐 Configurações de Segurança

### Row Level Security (RLS)

O Supabase já está configurado com RLS habilitado. Para ajustar as políticas:

1. Vá para **Authentication > Policies** no Supabase
2. Ajuste as políticas conforme suas necessidades de segurança

### CORS

O backend já está configurado para aceitar requisições do seu domínio Vercel.

## 🧪 Testando a Aplicação

### Login Padrão
- **Email**: `admin@webdesign.com`
- **Senha**: `admin123`

**⚠️ IMPORTANTE**: Altere a senha padrão imediatamente após o primeiro login!

### Verificações

1. ✅ Login funciona
2. ✅ Dashboard carrega
3. ✅ CRUD de projetos funciona
4. ✅ CRUD de despesas funciona
5. ✅ CRUD de códigos funciona
6. ✅ CRUD de briefings funciona

## 🔧 Troubleshooting

### Erro de Conexão com Banco
- Verifique se as credenciais do Supabase estão corretas
- Confirme se o projeto Supabase está ativo
- Verifique os logs na Vercel (**Functions > View Function Logs**)

### Erro 500 na API
- Verifique os logs da função na Vercel
- Confirme se todas as variáveis de ambiente estão configuradas
- Teste a conexão com o banco localmente

### Build Falha
- Verifique se o comando de install está correto
- Confirme se todas as dependências estão no package.json
- Verifique os logs de build na Vercel

## 📱 Desenvolvimento Local com Supabase

Para desenvolver localmente usando Supabase:

1. Copie `.env.example` para `.env`
2. Configure as variáveis com suas credenciais Supabase
3. Execute:
```bash
# Frontend
npm run dev

# Backend (em outro terminal)
cd server
npm run dev
```

## 🔄 Atualizações

Para atualizar a aplicação:

1. Faça suas alterações
2. Commit e push para o repositório
3. A Vercel fará o redeploy automaticamente

Para atualizações do banco:

1. Execute os scripts SQL no Supabase SQL Editor
2. Teste localmente antes de aplicar em produção

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs na Vercel
2. Verifique os logs no Supabase
3. Consulte a documentação oficial:
   - [Vercel Docs](https://vercel.com/docs)
   - [Supabase Docs](https://supabase.com/docs)