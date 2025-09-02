# Configuração Específica para cPanel - Kaizen Mídias

## Informações do Servidor

### Domínio
- **URL Principal**: `dashboard.kaizenmidias.com`
- **URL da API**: `dashboard.kaizenmidias.com/api`

### Banco de Dados MySQL
- **Nome do Banco**: `kaizenagencia_agridom_prod`
- **Usuário**: `kaizenagencia_agridom_user`
- **Host**: `localhost`
- **Porta**: `3306`
- **Senha**: *(definir no cPanel)*

## Passos de Configuração no cPanel

### 1. Configurar Node.js App
```
Node.js Version: 18.x ou superior
Application Root: /public_html/dashboard
Application URL: dashboard.kaizenmidias.com
Startup File: server/server.js
```

### 2. Variáveis de Ambiente
Copie o conteúdo dos arquivos `.env.production` (raiz e server/) para as variáveis de ambiente do Node.js App no cPanel.

**Variáveis Principais:**
```
DB_HOST=localhost
DB_NAME=kaizenagencia_agridom_prod
DB_USER=kaizenagencia_agridom_user
DB_PASSWORD=[sua_senha_mysql]
JWT_SECRET=[gerar_chave_segura]
BASE_URL=https://dashboard.kaizenmidias.com
API_URL=https://dashboard.kaizenmidias.com/api
NODE_ENV=production
```

### 3. Configurar Git Repository
```
Repository URL: https://github.com/Kaizenmidias/agridom-dashboard.git
Repository Path: /public_html/dashboard
Branch: main
```

### 4. Configurar Webhook (Opcional)
- Upload do arquivo `webhook.php` para `/public_html/`
- URL do Webhook: `https://dashboard.kaizenmidias.com/webhook.php`
- Secret: *(definir no GitHub e no webhook.php)*

## Comandos de Deploy

### Deploy Manual
```bash
# No terminal do cPanel
cd /public_html/dashboard
git pull origin main
npm install
npm run build
cp -r dist/* ../
npm --prefix server install
```

### Deploy Automático
```bash
# Executar o script de deploy
chmod +x deploy.sh
./deploy.sh
```

## Estrutura de Arquivos no Servidor
```
/public_html/
├── index.html (frontend build)
├── assets/ (frontend assets)
├── api/ -> dashboard/server/ (symlink ou proxy)
├── dashboard/ (repositório Git)
│   ├── server/ (backend Node.js)
│   ├── dist/ (frontend build)
│   └── deploy.sh
└── webhook.php (opcional)
```

## Verificações Pós-Deploy

1. **Frontend**: `https://dashboard.kaizenmidias.com`
2. **API Health**: `https://dashboard.kaizenmidias.com/api/health`
3. **Login**: Usar credenciais padrão ou criar usuário admin

## Troubleshooting

### Erro de Conexão com Banco
- Verificar se o banco `kaizenagencia_agridom_prod` existe
- Verificar se o usuário `kaizenagencia_agridom_user` tem permissões
- Executar script `database/setup-mysql.sql`

### Erro 500 na API
- Verificar logs do Node.js App no cPanel
- Verificar variáveis de ambiente
- Verificar se todas as dependências foram instaladas

### Problemas de CORS
- Verificar `CORS_ORIGIN` nas variáveis de ambiente
- Verificar se o domínio está correto

## Contatos
- **Desenvolvedor**: Lucas
- **Empresa**: Kaizen Mídias
- **Repositório**: https://github.com/Kaizenmidias/agridom-dashboard