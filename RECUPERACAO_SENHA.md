# 🔐 Sistema de Recuperação de Senha

A funcionalidade de recuperação de senha foi implementada com sucesso no sistema AgriDom.

## ✅ Funcionalidades Implementadas

### Backend
- ✅ Endpoint `/api/auth/forgot-password` para solicitar recuperação
- ✅ Endpoint `/api/auth/reset-password` para redefinir senha
- ✅ Sistema de tokens seguros com expiração (1 hora)
- ✅ Envio de emails com Nodemailer
- ✅ Validação de segurança (não revela se email existe)

### Frontend
- ✅ Botão "Esqueci minha senha" na tela de login
- ✅ Página de redefinição de senha (`/reset-password`)
- ✅ Validação de formulários
- ✅ Feedback visual para o usuário

### Banco de Dados
- ✅ Colunas `reset_token` e `reset_token_expiry` adicionadas à tabela `users`

## 🧪 Como Testar

### 1. Teste via Interface Web
1. Acesse: http://localhost:5173/login
2. Clique em "Esqueci minha senha"
3. Digite um email cadastrado (ex: admin@agridom.com)
4. Clique em "Enviar link de recuperação"
5. Verifique o console do servidor para o link de preview do email

### 2. Teste via API
```bash
# Solicitar recuperação
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agridom.com"}'

# Redefinir senha (substitua TOKEN pelo token recebido)
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_AQUI","newPassword":"novaSenha123"}'
```

### 3. Teste Automatizado
```bash
cd server
node test-forgot-password.cjs
```

## 📧 Configuração de Email

### Desenvolvimento
O sistema usa Ethereal Email para testes:
- Emails não são enviados realmente
- Links de preview são exibidos no console do servidor
- Configuração automática para desenvolvimento

### Produção
Para usar em produção, configure as variáveis no arquivo `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
FROM_EMAIL=noreply@seudominio.com
FRONTEND_URL=https://seudominio.com
```

## 🔒 Segurança

- Tokens são gerados com `crypto.randomBytes(32)`
- Tokens expiram em 1 hora
- Senhas são hasheadas com bcrypt
- Sistema não revela se email existe (proteção contra enumeração)
- Validação de entrada em todos os endpoints

## 📁 Arquivos Modificados/Criados

### Backend
- `server/routes/auth.js` - Novos endpoints
- `server/config/email.js` - Configuração de email
- `server/add-reset-fields.cjs` - Script para adicionar colunas
- `server/.env.example` - Exemplo de configuração

### Frontend
- `src/pages/LoginPage.tsx` - Botão e função de recuperação
- `src/pages/ResetPasswordPage.tsx` - Página de redefinição
- `src/App.tsx` - Nova rota

## 🚀 Status

✅ **IMPLEMENTAÇÃO COMPLETA**

Todas as funcionalidades foram implementadas e testadas com sucesso. O sistema está pronto para uso em desenvolvimento e pode ser facilmente configurado para produção.

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique se o servidor está rodando na porta 3001
2. Verifique se o frontend está rodando na porta 5173
3. Consulte os logs do servidor para detalhes de erro
4. Verifique a configuração do banco de dados