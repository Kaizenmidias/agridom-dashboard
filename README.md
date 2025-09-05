# 🌾 Agridom Dashboard

Dashboard moderno e responsivo para gestão agrícola, desenvolvido com React, TypeScript e Supabase.

## 📋 Funcionalidades

- 🔐 **Autenticação Segura**: Login e registro com Supabase Auth
- 📊 **Dashboard Interativo**: Visualização de dados em tempo real
- 💼 **Gestão de Projetos**: Controle completo de projetos agrícolas
- 💰 **Controle de Despesas**: Gerenciamento financeiro integrado
- 📝 **Relatórios**: Sistema de relatórios e análises
- 👥 **Gestão de Usuários**: Controle de permissões e acessos
- 📱 **Design Responsivo**: Interface adaptável para todos os dispositivos
- 🎨 **UI Moderna**: Componentes baseados em Shadcn/UI
- ☁️ **Deploy Automático**: Hospedado no Vercel

## 🛠️ Tecnologias Utilizadas

- **React 18** - Biblioteca para interfaces de usuário
- **TypeScript** - Tipagem estática para JavaScript
- **Vite** - Build tool rápido e moderno
- **Tailwind CSS** - Framework CSS utilitário
- **Shadcn/UI** - Componentes de interface modernos
- **React Router** - Roteamento do lado do cliente
- **Supabase** - Backend-as-a-Service com PostgreSQL
- **Vercel** - Plataforma de deploy e hospedagem

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+ instalado
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com) (para deploy)
- Git instalado

### 1. Clone o Repositório
```bash
git clone <url-do-repositorio>
cd agridom-dashboard
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Supabase

1. Crie um novo projeto no Supabase
2. Obtenha a URL do projeto e a chave anônima
3. Configure as tabelas necessárias no banco de dados

### 4. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
VITE_API_BASE_URL=http://localhost:5173/api
VITE_AUTH_API_BASE_URL=http://localhost:5173/auth
```

## 🏃‍♂️ Executando o Projeto

### Desenvolvimento Local

```bash
npm run dev
```

Acesse a aplicação em: http://localhost:5173

### Deploy no Vercel

1. **Conecte seu repositório ao Vercel**
2. **Configure as variáveis de ambiente no Vercel:**
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
   VITE_API_BASE_URL=https://seu-dominio.vercel.app/api
   VITE_AUTH_API_BASE_URL=https://seu-dominio.vercel.app/auth
   ```
3. **Deploy automático** será realizado a cada push

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa linting do código

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
