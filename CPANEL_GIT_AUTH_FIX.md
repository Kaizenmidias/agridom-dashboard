# 🔧 Resolver Erro de Autenticação Git no cPanel

## ❌ Erro Encontrado

```
Erro: (XID rc3tq8) "/usr/local/cpanel/3rdparty/bin/git" relatou o código de erro "128" quando foi encerrado: 
fatal: could not read Username for 'https://github.com': No such device or address
```

## 🔍 Causa do Problema

O cPanel não consegue autenticar no GitHub porque:
1. Não há credenciais configuradas
2. O repositório é privado e precisa de autenticação
3. O cPanel não tem acesso ao GitHub via HTTPS sem credenciais

## ✅ Soluções

### Solução 1: Usar Repositório Público (Recomendado)

1. **No GitHub**, vá para o repositório:
   `https://github.com/Kaizenmidias/agridom-dashboard`

2. **Clique em Settings** (Configurações)

3. **Role até "Danger Zone"** (Zona de Perigo)

4. **Clique em "Change repository visibility"**

5. **Selecione "Make public"** e confirme

6. **No cPanel**, tente novamente o Git Version Control

### Solução 2: Usar Token de Acesso Pessoal

#### 2.1 Criar Token no GitHub

1. **Acesse:** https://github.com/settings/tokens
2. **Clique em "Generate new token (classic)"**
3. **Configure:**
   - **Note:** `cPanel Deploy Token`
   - **Expiration:** `No expiration` (ou 1 ano)
   - **Scopes:** Marque `repo` (acesso completo ao repositório)
4. **Clique em "Generate token"**
5. **COPIE O TOKEN** (você só verá uma vez!)

#### 2.2 Usar Token no cPanel

**Método A: URL com Token**

No cPanel Git Version Control, use esta URL:
```
https://SEU_TOKEN_AQUI@github.com/Kaizenmidias/agridom-dashboard.git
```

**Substitua `SEU_TOKEN_AQUI` pelo token copiado.**

**Método B: Configurar Credenciais via SSH**

1. **No cPanel Terminal**, execute:
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
git config --global credential.helper store
```

2. **Clone manualmente:**
```bash
cd /home/$(whoami)/public_html
git clone https://github.com/Kaizenmidias/agridom-dashboard.git webdesign
```

3. **Quando solicitar credenciais:**
   - **Username:** Seu username do GitHub
   - **Password:** O token gerado (não sua senha!)

### Solução 3: Deploy Manual (Alternativa)

Se as soluções acima não funcionarem:

#### 3.1 Download do Código

1. **Acesse:** https://github.com/Kaizenmidias/agridom-dashboard
2. **Clique em "Code" > "Download ZIP"**
3. **Extraia o arquivo** no seu computador

#### 3.2 Upload via File Manager

1. **No cPanel File Manager**, navegue até `public_html`
2. **Crie pasta:** `webdesign`
3. **Faça upload** de todos os arquivos extraídos
4. **Configure permissões** dos arquivos (755 para pastas, 644 para arquivos)

#### 3.3 Configurar Deploy Manual

**Crie um script `update.sh`:**

```bash
#!/bin/bash
# Script de atualização manual

echo "🔄 Atualizando WebDesign Dashboard..."

# Backup
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf ~/backups/webdesign_$DATE.tar.gz /home/$(whoami)/public_html/webdesign

echo "📦 Instalando dependências..."
cd /home/$(whoami)/public_html/webdesign
npm install

echo "🏗️ Fazendo build..."
npm run build:prod

echo "📂 Copiando arquivos..."
cp -r dist/* ../

echo "🔧 Configurando backend..."
cd server
npm install --production

echo "🔄 Reiniciando aplicação..."
touch tmp/restart.txt

echo "✅ Atualização concluída!"
```

## 🚀 Passo a Passo Recomendado

### Opção A: Repositório Público (Mais Fácil)

1. ✅ Tornar repositório público no GitHub
2. ✅ Configurar Git Version Control no cPanel
3. ✅ Seguir o guia normal de deploy

### Opção B: Repositório Privado com Token

1. ✅ Gerar token de acesso no GitHub
2. ✅ Usar URL com token no cPanel
3. ✅ Configurar deploy automático

### Opção C: Deploy Manual

1. ✅ Download do código via ZIP
2. ✅ Upload via File Manager
3. ✅ Configuração manual no servidor

## 🔍 Verificar Solução

Após aplicar qualquer solução:

1. **Teste o Git Version Control** no cPanel
2. **Verifique se os arquivos** foram clonados
3. **Execute os comandos** de instalação
4. **Teste a aplicação** no browser

## 📞 Troubleshooting Adicional

### Se ainda der erro:

1. **Verifique a conectividade:**
```bash
ping github.com
```

2. **Teste o Git manualmente:**
```bash
git ls-remote https://github.com/Kaizenmidias/agridom-dashboard.git
```

3. **Verifique as configurações do cPanel:**
   - Git Version Control está habilitado?
   - Há restrições de firewall?
   - O servidor tem acesso à internet?

### Contato com Suporte

Se nenhuma solução funcionar:
1. **Entre em contato** com o suporte do seu provedor cPanel
2. **Informe o erro específico** e as tentativas realizadas
3. **Solicite habilitação** do Git Version Control

---

## ✅ Resumo das Soluções

| Solução | Dificuldade | Recomendação |
|---------|-------------|-------------|
| Repositório Público | ⭐ Fácil | ✅ Melhor opção |
| Token de Acesso | ⭐⭐ Médio | ✅ Boa alternativa |
| Deploy Manual | ⭐⭐⭐ Difícil | ⚠️ Última opção |

**🎯 Recomendação:** Comece pela **Solução 1** (repositório público) por ser mais simples e eficaz para a maioria dos casos.