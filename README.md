# 🌱 AgriDom Dashboard

Um dashboard moderno e responsivo para gestão agrícola, desenvolvido com React, TypeScript e Node.js.

## 📋 Funcionalidades

- 🔐 **Autenticação Segura**: Login e registro com JWT
- 🔄 **Recuperação de Senha**: Sistema de reset via email
- 📊 **Dashboard Interativo**: Visualização de dados em tempo real
- 📱 **Design Responsivo**: Interface adaptável para todos os dispositivos
- 🎨 **UI Moderna**: Componentes baseados em Shadcn/UI
- 🔒 **Segurança**: Proteção CORS, validação de dados e criptografia

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - Biblioteca para interfaces de usuário
- **TypeScript** - Tipagem estática para JavaScript
- **Vite** - Build tool rápido e moderno
- **Tailwind CSS** - Framework CSS utilitário
- **Shadcn/UI** - Componentes de interface modernos
- **React Router** - Roteamento do lado do cliente
- **Axios** - Cliente HTTP para requisições
- **React Query** - Gerenciamento de estado do servidor

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web minimalista
- **MySQL** - Banco de dados relacional
- **JWT** - Autenticação baseada em tokens
- **Bcrypt** - Criptografia de senhas
- **Nodemailer** - Envio de emails
- **Multer** - Upload de arquivos

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 16+ instalado
- MySQL 8+ instalado
- Git instalado

### 1. Clone o Repositório
```bash
git clone <url-do-repositorio>
cd agri-dom-dashboard
```

### 2. Instalar Dependências

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd server
npm install
```

### 3. Configurar Banco de Dados

1. Crie um banco MySQL:
```sql
CREATE DATABASE agri_dom;
```

2. Execute o script de configuração:
```bash
mysql -u root -p agri_dom < database/setup-mysql.sql
```

### 4. Configurar Variáveis de Ambiente

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=AgriDom Dashboard
```

#### Backend (server/.env)
```env
NODE_ENV=development
PORT=3001

# Banco de Dados
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=agri_dom
DB_PORT=3306

# JWT
JWT_SECRET=sua_chave_secreta_muito_forte
JWT_EXPIRES_IN=24h

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
```

## 🏃‍♂️ Executando o Projeto

### Desenvolvimento

1. **Iniciar o Backend**:
```bash
cd server
npm run dev
```

2. **Iniciar o Frontend** (em outro terminal):
```bash
npm run dev
```

3. **Acessar a Aplicação**:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3001/api

### Produção

Para deploy em produção, consulte o arquivo [DEPLOY_CPANEL.md](./DEPLOY_CPANEL.md) com instruções completas para hospedagem compartilhada.

## 📝 Scripts Disponíveis

### Frontend
- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run build:prod` - Build otimizado para produção
- `npm run build:cpanel` - Prepara arquivos para deploy no cPanel
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa linting do código

### Backend
- `npm run dev` - Inicia servidor com nodemon
- `npm start` - Inicia servidor de produção

## 🔐 Credenciais Padrão

Após a instalação, use estas credenciais para o primeiro acesso:

- **Email**: admin@agridom.com
- **Senha**: admin123

⚠️ **IMPORTANTE**: Altere a senha imediatamente após o primeiro login!

## 🚀 Deploy para Produção

### Opção 1: Deploy Manual

```bash
# Build otimizado para produção
npm run build:prod

# Preparar arquivos para cPanel
npm run build:cpanel
```

1. Execute `npm run build:cpanel`
2. Faça upload da pasta `deploy-cpanel/` para seu servidor
3. Siga as instruções em `DEPLOY_CPANEL.md`

### Opção 2: Deploy Automático via GitHub

```bash
# Inicializar repositório Git (Windows)
init-git.bat

# Ou manualmente:
git init
git add .
git commit -m "Initial commit: AgriDom Dashboard"
git branch -M main
```

1. Crie um repositório no [GitHub](https://github.com/new)
2. Conecte o repositório local:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/agridom-dashboard.git
   git push -u origin main
   ```
3. Configure deploy automático seguindo `GITHUB_CPANEL_DEPLOY.md`

### Deploy no cPanel

Este projeto está pronto para deploy em hospedagem compartilhada com cPanel. Os arquivos prontos estarão na pasta `deploy-cpanel/` após executar o build.

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**:
   - Verifique se o MySQL está rodando
   - Confirme as credenciais no `.env`

2. **Erro de CORS**:
   - Verifique se as URLs estão corretas no `.env`
   - Confirme se o backend está rodando

3. **Build falha**:
   - Execute `npm install` novamente
   - Instale dependências: `npm install --save-dev terser`

## 📄 Licença

Este projeto está sob a licença MIT.

---

**Desenvolvido com ❤️ para a comunidade agrícola**
