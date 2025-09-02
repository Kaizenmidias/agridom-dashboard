const fs = require('fs');
const path = require('path');

console.log('🚀 Preparando arquivos para deploy no cPanel...');

// Criar diretório de deploy
const deployDir = path.join(__dirname, '..', 'deploy-cpanel');
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// Criar diretório para frontend
const frontendDir = path.join(deployDir, 'public_html');
if (!fs.existsSync(frontendDir)) {
  fs.mkdirSync(frontendDir, { recursive: true });
}

// Criar diretório para backend
const backendDir = path.join(deployDir, 'backend');
if (!fs.existsSync(backendDir)) {
  fs.mkdirSync(backendDir, { recursive: true });
}

// Copiar arquivos do build do frontend
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  copyDirectory(distDir, frontendDir);
  console.log('✅ Arquivos do frontend copiados para public_html/');
} else {
  console.error('❌ Diretório dist não encontrado. Execute npm run build:prod primeiro.');
  process.exit(1);
}

// Copiar arquivos do servidor
const serverDir = path.join(__dirname, '..', 'server');
const serverFiles = [
  'server.js',
  'package.json',
  '.env.production',
  'routes',
  'middleware',
  'utils',
  'uploads'
];

serverFiles.forEach(file => {
  const sourcePath = path.join(serverDir, file);
  const destPath = path.join(backendDir, file);
  
  if (fs.existsSync(sourcePath)) {
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
    console.log(`✅ ${file} copiado para backend/`);
  } else {
    console.log(`⚠️  ${file} não encontrado, pulando...`);
  }
});

// Criar arquivo de instruções
const instructionsPath = path.join(deployDir, 'INSTRUCOES_DEPLOY.md');
const instructions = `# Instruções de Deploy para cPanel

## 1. Upload dos Arquivos

### Frontend (public_html/)
- Faça upload de todos os arquivos da pasta \`public_html/\` para o diretório \`public_html\` do seu cPanel
- Certifique-se de que o arquivo \`.htaccess\` foi enviado corretamente

### Backend (backend/)
- Faça upload de todos os arquivos da pasta \`backend/\` para um diretório \`backend\` no seu cPanel
- Pode ser dentro de \`public_html/backend\` ou em um diretório separado

## 2. Configuração do Banco de Dados

1. Acesse o MySQL Databases no cPanel
2. Crie um novo banco de dados
3. Crie um usuário e associe ao banco
4. Anote as credenciais para configurar no .env

## 3. Configuração das Variáveis de Ambiente

1. Edite o arquivo \`.env.production\` no diretório backend
2. Atualize as seguintes variáveis:
   - \`DB_HOST\`: geralmente \`localhost\`
   - \`DB_USER\`: usuário do MySQL criado
   - \`DB_PASSWORD\`: senha do usuário MySQL
   - \`DB_NAME\`: nome do banco criado
   - \`JWT_SECRET\`: gere uma chave secreta forte
   - \`EMAIL_*\`: configure com suas credenciais de email

## 4. Instalação das Dependências

1. Acesse o Terminal no cPanel (se disponível)
2. Navegue até o diretório backend
3. Execute: \`npm install --production\`

## 5. Configuração do Node.js

1. No cPanel, acesse "Node.js App"
2. Crie uma nova aplicação:
   - Node.js Version: 18.x ou superior
   - Application Mode: Production
   - Application Root: /backend
   - Application URL: seu domínio/backend
   - Application Startup File: server.js

## 6. Teste da Aplicação

1. Acesse seu domínio para testar o frontend
2. Teste as rotas da API: \`seudominio.com/backend/api/health\`
3. Verifique os logs no cPanel para identificar possíveis erros

## 7. Configurações Adicionais

- Certifique-se de que o SSL está ativado
- Configure redirects HTTP para HTTPS se necessário
- Verifique as permissões dos diretórios (755 para pastas, 644 para arquivos)

## Estrutura Final no Servidor:

\`\`\`
public_html/
├── index.html
├── assets/
├── .htaccess
└── backend/
    ├── server.js
    ├── package.json
    ├── .env.production
    ├── routes/
    ├── middleware/
    └── utils/
\`\`\`

## Troubleshooting

- Se o frontend não carregar: verifique o .htaccess
- Se a API não funcionar: verifique os logs do Node.js no cPanel
- Se houver erro de banco: verifique as credenciais no .env.production
- Para problemas de CORS: verifique a configuração CORS_ORIGIN
`;

fs.writeFileSync(instructionsPath, instructions);
console.log('✅ Instruções de deploy criadas em INSTRUCOES_DEPLOY.md');

// Criar arquivo .htaccess para o backend (se necessário)
const backendHtaccess = path.join(backendDir, '.htaccess');
const htaccessContent = `# Configuração para Node.js no cPanel
RewriteEngine On
RewriteRule ^(.*)$ server.js [L]
`;
fs.writeFileSync(backendHtaccess, htaccessContent);
console.log('✅ .htaccess do backend criado');

console.log('\n🎉 Preparação concluída!');
console.log('📁 Arquivos prontos em: deploy-cpanel/');
console.log('📖 Leia as instruções em: deploy-cpanel/INSTRUCOES_DEPLOY.md');

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}