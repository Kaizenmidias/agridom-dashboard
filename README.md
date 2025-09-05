# 🌾 AgriDom Dashboard

Um dashboard moderno e responsivo para gestão agrícola, desenvolvido com React, TypeScript e Node.js com Supabase.

## 📋 Funcionalidades

- 🔐 **Autenticação Segura**: Login e registro com JWT
- 🔄 **Recuperação de Senha**: Sistema de reset via email
- 📊 **Dashboard Interativo**: Visualização de dados em tempo real
- 💼 **Gestão de Projetos**: Controle completo de projetos de web design
- 💰 **Controle de Despesas**: Gerenciamento financeiro integrado
- 📝 **Briefings**: Sistema de briefings para clientes
- 💻 **Biblioteca de Códigos**: Armazenamento e organização de snippets
- 👥 **Gestão de Usuários**: Controle de permissões e acessos
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
- **Supabase** - Backend-as-a-Service com PostgreSQL
- **JWT** - Autenticação baseada em tokens
- **Bcrypt** - Criptografia de senhas
- **Nodemailer** - Envio de emails
- **Multer** - Upload de arquivos

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 22+ instalado
- Conta no Supabase
- Git instalado

### 1. Clone o Repositório
```bash
git clone <url-do-repositorio>
cd webdesign-dashboard
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
CREATE DATABASE webdesign_dashboard;
```

2. Execute o script de configuração:
```bash
mysql -u root -p webdesign_dashboard < database/setup-mysql.sql
```

### 4. Configurar Variáveis de Ambiente

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=WebDesign Dashboard
```

#### Backend (server/.env)
```env
NODE_ENV=development
PORT=3001

# Banco de Dados
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=webdesign_dashboard
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

- **Email**: admin@webdesign.com
- **Senha**: admin123

⚠️ **IMPORTANTE**: Altere a senha imediatamente após o primeiro login!

## 🚀 Deploy para Produção

Consulte os arquivos de documentação específicos:
- [DEPLOY_CPANEL.md](./DEPLOY_CPANEL.md) - Deploy em hospedagem compartilhada
- [GITHUB_CPANEL_DEPLOY.md](./GITHUB_CPANEL_DEPLOY.md) - Deploy automatizado via GitHub

## 📊 Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas principais:

### Autenticação e Usuários
- **users** - Dados dos usuários e permissões
- **password_reset_tokens** - Tokens para recuperação de senha
- **sessions** - Sessões ativas dos usuários
- **system_settings** - Configurações do sistema

### Gestão de Projetos
- **projects** - Projetos de web design
- **expenses** - Despesas associadas aos projetos
- **briefings** - Briefings dos clientes
- **codes** - Biblioteca de códigos e snippets

## 🔧 Funcionalidades Detalhadas

### 💼 Gestão de Projetos
- Criação e edição de projetos
- Controle de status (ativo, concluído, pausado, cancelado)
- Tipos de projeto (website, e-commerce, landing page, app, branding)
- Controle de valores e pagamentos
- Datas de entrega e conclusão

### 💰 Controle Financeiro
- Registro de despesas por categoria
- Despesas únicas e recorrentes
- Associação de despesas a projetos
- Relatórios financeiros

### 📝 Sistema de Briefings
- Criação de briefings para clientes
- Controle de status e prioridade
- Prazos e deadlines
- Histórico de briefings

### 💻 Biblioteca de Códigos
- Armazenamento de snippets HTML, CSS, JavaScript
- Organização por tipo de código
- Busca e filtragem
- Reutilização de códigos

### 👥 Gestão de Usuários
- Controle granular de permissões
- Acesso a diferentes módulos do sistema
- Perfis de usuário personalizáveis

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato através do email: suporte@webdesign.com

---

**WebDesign Dashboard** - Desenvolvido com ❤️ para empresas de web design modernas.
