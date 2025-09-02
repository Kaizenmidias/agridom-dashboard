# Configuração do MariaDB para WebDesign Dashboard

Este guia explica como configurar o MariaDB para o sistema de gestão de empresa de web design.

## Pré-requisitos

1. **MariaDB Server** instalado e em execução
   - Download: https://mariadb.org/download/
   - Versão recomendada: 10.6 ou superior

2. **Node.js** com as dependências instaladas:
   ```bash
   npm install mysql2 bcryptjs jsonwebtoken @types/bcryptjs @types/jsonwebtoken
   ```

## Configuração das Variáveis de Ambiente

Crie ou atualize o arquivo `.env.local` na raiz do projeto:

```env
# Configuração do MariaDB
VITE_DB_HOST=localhost
VITE_DB_PORT=3306
VITE_DB_NAME=webdesign_dashboard
VITE_DB_USER=root
VITE_DB_PASSWORD=sua_senha_aqui

# Configuração JWT
VITE_JWT_SECRET=sua_chave_secreta_jwt_aqui
VITE_JWT_EXPIRES_IN=7d

# Configuração da aplicação
VITE_API_URL=http://localhost:3001
```

## Passos para Configuração

### 1. Criar o Banco de Dados

Conecte-se ao MariaDB e execute:

```sql
CREATE DATABASE IF NOT EXISTS webdesign_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE webdesign_dashboard;
```

### 2. Executar o Script de Criação das Tabelas

Execute o arquivo `mariadb-tables.sql` no seu banco de dados:

```bash
# Via linha de comando
mysql -u root -p webdesign_dashboard < mariadb-tables.sql

# Ou via cliente MariaDB
source mariadb-tables.sql;
```

### 3. Verificar a Instalação

Após executar o script, verifique se as tabelas foram criadas:

```sql
SHOW TABLES;
```

Você deve ver as seguintes tabelas:
- `users`
- `projects`
- `expenses`
- `codes`
- `briefings`

## Estrutura das Tabelas

### Tabela `users`
- `id`: CHAR(36) - Chave primária (UUID)
- `email`: VARCHAR(255) - Email único do usuário
- `password_hash`: VARCHAR(255) - Hash da senha (bcrypt)
- `full_name`: VARCHAR(255) - Nome completo
- `avatar_url`: TEXT - URL do avatar
- `is_active`: BOOLEAN - Status ativo/inativo
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

### Tabela `projects`
- `id`: CHAR(36) - Chave primária (UUID)
- `name`: VARCHAR(255) - Nome do projeto
- `description`: TEXT - Descrição
- `user_id`: CHAR(36) - Referência ao usuário
- `status`: ENUM - Status (active, completed, paused)
- `budget`: DECIMAL(12,2) - Orçamento
- `start_date`: DATE - Data de início
- `end_date`: DATE - Data de fim
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

### Tabela `expenses`
- `id`: CHAR(36) - Chave primária (UUID)
- `description`: VARCHAR(255) - Descrição da despesa
- `amount`: DECIMAL(10,2) - Valor
- `category`: VARCHAR(100) - Categoria
- `date`: DATE - Data da despesa
- `project_id`: CHAR(36) - Referência ao projeto
- `user_id`: CHAR(36) - Referência ao usuário
- `receipt_url`: TEXT - URL do comprovante
- `notes`: TEXT - Observações
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

### Tabela `codes`
- `id`: CHAR(36) - Chave primária (UUID)
- `title`: VARCHAR(255) - Título do código
- `description`: TEXT - Descrição
- `code`: LONGTEXT - Código fonte
- `language`: VARCHAR(50) - Linguagem de programação
- `category`: VARCHAR(100) - Categoria
- `tags`: TEXT - Tags (JSON)
- `user_id`: CHAR(36) - Referência ao usuário
- `is_public`: BOOLEAN - Código público/privado
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

### Tabela `briefings`
- `id`: CHAR(36) - Chave primária (UUID)
- `title`: VARCHAR(255) - Título do briefing
- `client_name`: VARCHAR(255) - Nome do cliente
- `client_email`: VARCHAR(255) - Email do cliente
- `project_type`: VARCHAR(100) - Tipo de projeto
- `description`: TEXT - Descrição detalhada
- `requirements`: TEXT - Requisitos (JSON)
- `budget_range`: VARCHAR(50) - Faixa de orçamento
- `deadline`: DATE - Prazo
- `status`: ENUM - Status (pending, approved, rejected, in_progress)
- `user_id`: CHAR(36) - Referência ao usuário
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

## Recursos Implementados

### Atualizações Automáticas
- Todas as tabelas possuem `updated_at` que é atualizado automaticamente via `ON UPDATE CURRENT_TIMESTAMP`

### Índices para Performance
- Índices em campos frequentemente consultados
- Índices compostos para queries complexas
- Índices em chaves estrangeiras

### Constraints e Relacionamentos
- Chaves estrangeiras com `ON DELETE CASCADE` ou `ON DELETE SET NULL`
- Constraints de integridade referencial
- Validações de ENUM para campos de status

### Usuário de Exemplo
O script cria um usuário de exemplo:
- **Email**: admin@webdesign.com
- **Senha**: admin123
- **Nome**: Administrador

## Testando a Integração

### 1. Verificar Conexão

O cliente MariaDB possui uma função para testar a conexão:

```typescript
import { checkConnection } from './src/lib/mariadb'

const testConnection = async () => {
  const result = await checkConnection()
  console.log('Conexão:', result)
}
```

### 2. Executar a Aplicação

```bash
npm run dev
```

### 3. Fazer Login

Use as credenciais do usuário de exemplo:
- Email: admin@webdesign.com
- Senha: admin123

## Hooks Disponíveis

### Hooks Genéricos
- `useMariaDBQuery<T>(sql, params)` - Executar queries
- `useMariaDBInsert<T>(tableName)` - Inserir dados
- `useMariaDBUpdate<T>(tableName)` - Atualizar dados
- `useMariaDBDelete(tableName)` - Deletar dados

### Hooks Específicos

#### Usuários
- `useUsers()` - Listar usuários
- `useUser(id)` - Buscar usuário por ID
- `useCreateUser()` - Criar usuário
- `useUpdateUser()` - Atualizar usuário
- `useDeleteUser()` - Deletar usuário

#### Projetos
- `useProjects(userId?)` - Listar projetos
- `useProject(id)` - Buscar projeto por ID
- `useCreateProject()` - Criar projeto
- `useUpdateProject()` - Atualizar projeto
- `useDeleteProject()` - Deletar projeto

#### Despesas
- `useExpenses(projectId?, userId?)` - Listar despesas
- `useExpense(id)` - Buscar despesa por ID
- `useCreateExpense()` - Criar despesa
- `useUpdateExpense()` - Atualizar despesa
- `useDeleteExpense()` - Deletar despesa

#### Códigos
- `useCodes(userId?, category?)` - Listar códigos
- `useCode(id)` - Buscar código por ID
- `useCreateCode()` - Criar código
- `useUpdateCode()` - Atualizar código
- `useDeleteCode()` - Deletar código

#### Briefings
- `useBriefings(userId?, status?)` - Listar briefings
- `useBriefing(id)` - Buscar briefing por ID
- `useCreateBriefing()` - Criar briefing
- `useUpdateBriefing()` - Atualizar briefing
- `useDeleteBriefing()` - Deletar briefing

#### Estatísticas
- `useStatistics(userId)` - Buscar estatísticas do usuário

## Diferenças do PostgreSQL

### Principais Mudanças
1. **UUIDs**: Uso de `CHAR(36)` com `UUID()` em vez de `uuid-ossp`
2. **Sintaxe de Placeholders**: `?` em vez de `$1, $2, ...`
3. **Auto-increment**: `AUTO_INCREMENT` em vez de `SERIAL`
4. **Timestamps**: `ON UPDATE CURRENT_TIMESTAMP` em vez de triggers
5. **ENUM**: Suporte nativo para tipos ENUM
6. **Charset**: Configuração explícita de `utf8mb4`

### Vantagens do MariaDB
- Performance otimizada para aplicações web
- Melhor compatibilidade com MySQL
- Recursos avançados de replicação
- Suporte nativo para JSON (versões recentes)
- Menor uso de memória

## Troubleshooting

### Erro de Conexão
- Verifique se o MariaDB está rodando
- Confirme as credenciais no `.env.local`
- Teste a conexão via linha de comando

### Erro de Charset
- Certifique-se de usar `utf8mb4`
- Configure o cliente para usar o charset correto

### Performance
- Monitore os índices criados
- Use `EXPLAIN` para analisar queries
- Configure adequadamente o `my.cnf`

## Backup e Restore

### Backup
```bash
mysqldump -u root -p webdesign_dashboard > backup_webdesign_dashboard.sql
```

### Restore
```bash
mysql -u root -p webdesign_dashboard < backup_webdesign_dashboard.sql
```