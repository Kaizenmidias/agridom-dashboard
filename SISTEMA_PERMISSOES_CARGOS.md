# Sistema de Permissões Baseado em Cargos

Este documento descreve o novo sistema de permissões implementado no dashboard, que funciona baseado nos cargos dos usuários em vez de e-mails específicos.

## 📋 Visão Geral

O sistema agora funciona da seguinte forma:

### 🔑 **Administradores**
- **Cargos**: `administrador`, `admin`, `administrator`
- **Permissões**: Acesso total automático a todas as funcionalidades
- **Características**:
  - Não podem ter suas permissões limitadas
  - Podem gerenciar permissões de outros usuários
  - Acesso a interface de gerenciamento de permissões

### 👨‍💻 **Web Designers**
- **Cargos**: `web_designer`, `web designer`, `designer`
- **Permissões**: Configuráveis pelo administrador
- **Características**:
  - Permissões padrão limitadas
  - Administradores podem conceder/revogar permissões específicas
  - Permissões personalizadas são salvas no banco de dados

### 🆕 **Outros Cargos**
- Podem ser adicionados conforme necessário
- Permissões configuráveis através da tabela `role_definitions`

## 🗄️ Estrutura do Banco de Dados

### Novas Tabelas

#### `role_definitions`
```sql
CREATE TABLE role_definitions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    default_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `user_custom_permissions`
```sql
CREATE TABLE user_custom_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    permission_value BOOLEAN NOT NULL,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(user_id, permission_name)
);
```

### Nova Função

#### `get_user_permissions(user_id)`
Calcula as permissões finais de um usuário baseado em:
1. Definições do cargo
2. Permissões personalizadas
3. Status de administrador

## 🚀 Implementação

### 1. **Executar Scripts SQL**

```bash
# No Supabase SQL Editor, execute:
```

1. **Script principal**: `database/role_based_permissions.sql`
   - Cria tabelas e funções
   - Define cargos padrão
   - Migra dados existentes

### 2. **Backend (Node.js)**

#### Rotas Implementadas
- `GET /api/permissions/users` - Lista usuários não-admin
- `GET /api/permissions/user/:userId` - Permissões de usuário específico
- `PUT /api/permissions/user/:userId` - Atualizar permissões
- `GET /api/permissions/roles` - Definições de cargos
- `POST /api/permissions/roles` - Criar novo cargo
- `DELETE /api/permissions/user/:userId/custom/:permissionName` - Remover permissão específica

#### Middleware de Segurança
- Verificação de token JWT
- Validação de permissões de administrador
- Proteção contra modificação de admins

### 3. **Frontend (React/TypeScript)**

#### Componentes Criados
- `UserPermissionsManager` - Interface para gerenciar permissões
- APIs em `src/api/permissions.ts`

#### Atualizações
- `AuthContext` - Lógica de verificação de admin atualizada
- `AuthUser` interface - Novos campos adicionados
- Verificação de permissões baseada em `is_admin` e `role`

## 🔧 Permissões Disponíveis

### Acesso (Visualização)
- `can_access_dashboard` - Acessar página principal
- `can_access_projects` - Visualizar projetos
- `can_access_briefings` - Visualizar briefings
- `can_access_users` - Visualizar usuários
- `can_access_reports` - Visualizar relatórios
- `can_access_settings` - Acessar configurações

### Gerenciamento (Edição)
- `can_manage_users` - Criar/editar/excluir usuários
- `can_manage_projects` - Gerenciar projetos
- `can_manage_briefings` - Gerenciar briefings
- `can_manage_reports` - Gerenciar relatórios
- `can_manage_settings` - Alterar configurações

## 📱 Como Usar

### Para Administradores

1. **Acessar Gerenciamento de Permissões**
   - Login como administrador
   - Navegar para seção de usuários/permissões
   - Usar componente `UserPermissionsManager`

2. **Configurar Permissões de Web Designer**
   - Selecionar usuário da lista
   - Ativar/desativar permissões específicas
   - Salvar alterações

3. **Adicionar Novos Cargos**
   - Usar API `/api/permissions/roles`
   - Definir permissões padrão
   - Configurar se é cargo administrativo

### Para Desenvolvedores

#### Verificar Permissões no Frontend
```typescript
// Verificar se é admin
const isAdmin = user?.is_admin || 
  (user?.role && ['administrador', 'admin', 'administrator'].includes(user.role.toLowerCase()))

// Verificar permissão específica
const canManageUsers = user?.can_manage_users || false
```

#### Verificar Permissões no Backend
```javascript
// Usar função SQL
const permissions = await query(
  'SELECT get_user_permissions($1) as permissions',
  [userId]
)
```

## 🔄 Migração de Dados

O script `role_based_permissions.sql` automaticamente:

1. **Normaliza cargos existentes**
   ```sql
   UPDATE users SET role = 'administrador' 
   WHERE LOWER(role) IN ('admin', 'administrador', 'administrator');
   ```

2. **Aplica permissões baseadas em cargos**
   - Administradores: todas as permissões
   - Web Designers: permissões padrão limitadas
   - Outros: permissões mínimas

3. **Cria trigger automático**
   - Atualiza permissões quando cargo muda
   - Mantém consistência dos dados

## 🛡️ Segurança

### Proteções Implementadas
- Administradores não podem ter permissões limitadas
- Apenas administradores podem gerenciar permissões
- Validação de tokens JWT em todas as rotas
- Logs de alterações de permissões
- Proteção contra escalação de privilégios

### Auditoria
- Todas as alterações são registradas
- Campo `granted_by` identifica quem concedeu a permissão
- Timestamps de criação e modificação
- Notas opcionais para justificar alterações

## 🧪 Testes

### Cenários de Teste

1. **Administrador**
   - ✅ Acesso total automático
   - ✅ Pode gerenciar permissões de outros
   - ✅ Não pode ter permissões limitadas

2. **Web Designer**
   - ✅ Permissões padrão limitadas
   - ✅ Administrador pode conceder/revogar permissões
   - ✅ Permissões personalizadas são salvas

3. **Usuário Comum**
   - ✅ Permissões mínimas por padrão
   - ✅ Pode receber permissões específicas

### Comandos de Teste
```sql
-- Verificar permissões de um usuário
SELECT get_user_permissions(1);

-- Listar usuários e permissões
SELECT 
  u.name, u.role, 
  get_user_permissions(u.id) as permissions
FROM users u;
```

## 📚 Próximos Passos

1. **Integrar com Interface**
   - Adicionar componente `UserPermissionsManager` ao dashboard
   - Criar menu de administração

2. **Expandir Funcionalidades**
   - Interface para criar novos cargos
   - Histórico de alterações de permissões
   - Notificações de mudanças

3. **Otimizações**
   - Cache de permissões
   - Bulk operations para múltiplos usuários
   - Importação/exportação de configurações

## 🆘 Solução de Problemas

### Problemas Comuns

1. **Usuário sem permissões**
   ```sql
   -- Verificar cargo do usuário
   SELECT id, name, email, role FROM users WHERE email = 'usuario@exemplo.com';
   
   -- Forçar recálculo de permissões
   UPDATE users SET role = role WHERE id = [USER_ID];
   ```

2. **Permissões não atualizando**
   - Verificar se função `get_user_permissions` existe
   - Executar trigger manualmente
   - Limpar cache do frontend (localStorage)

3. **Erro de acesso negado**
   - Verificar se usuário é realmente administrador
   - Validar token JWT
   - Verificar logs do servidor

### Logs Úteis
```bash
# Backend
tail -f server/logs/permissions.log

# Frontend (Console do navegador)
console.log('User permissions:', user)
```

---

**Implementado em**: Janeiro 2025  
**Versão**: 1.0  
**Compatibilidade**: Supabase PostgreSQL, Node.js, React TypeScript