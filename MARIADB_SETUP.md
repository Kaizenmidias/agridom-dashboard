# Configuração do MariaDB para Agri-Dom

Este guia explica como configurar o MariaDB para o sistema Agri-Dom.

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
VITE_DB_NAME=agri_dom
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
CREATE DATABASE IF NOT EXISTS agri_dom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agri_dom;
```

### 2. Executar o Script de Criação das Tabelas

Execute o arquivo `mariadb-tables.sql` no seu banco de dados:

```bash
# Via linha de comando
mysql -u root -p agri_dom < mariadb-tables.sql

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
- `parcels`
- `crops`

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

### Tabela `parcels`
- `id`: CHAR(36) - Chave primária (UUID)
- `name`: VARCHAR(255) - Nome da parcela
- `area`: DECIMAL(10,4) - Área em hectares
- `location`: VARCHAR(255) - Localização
- `soil_type`: VARCHAR(100) - Tipo de solo
- `project_id`: CHAR(36) - Referência ao projeto
- `user_id`: CHAR(36) - Referência ao usuário
- `coordinates`: TEXT - Coordenadas geográficas (JSON)
- `notes`: TEXT - Observações
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data de atualização

### Tabela `crops`
- `id`: CHAR(36) - Chave primária (UUID)
- `name`: VARCHAR(255) - Nome da cultura
- `variety`: VARCHAR(255) - Variedade
- `planting_date`: DATE - Data de plantio
- `expected_harvest_date`: DATE - Data esperada de colheita
- `actual_harvest_date`: DATE - Data real de colheita
- `status`: ENUM - Status (planned, planted, growing, harvested, failed)
- `parcel_id`: CHAR(36) - Referência à parcela
- `user_id`: CHAR(36) - Referência ao usuário
- `yield_expected`: DECIMAL(10,2) - Produção esperada
- `yield_actual`: DECIMAL(10,2) - Produção real
- `notes`: TEXT - Observações
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
- **Email**: admin@agridom.com
- **Senha**: 123456
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
- Email: admin@agridom.com
- Senha: 123456

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

#### Parcelas
- `useParcels(userId?, projectId?)` - Listar parcelas
- `useParcel(id)` - Buscar parcela por ID
- `useCreateParcel()` - Criar parcela
- `useUpdateParcel()` - Atualizar parcela
- `useDeleteParcel()` - Deletar parcela

#### Culturas
- `useCrops(parcelId?, userId?)` - Listar culturas
- `useCrop(id)` - Buscar cultura por ID
- `useCreateCrop()` - Criar cultura
- `useUpdateCrop()` - Atualizar cultura
- `useDeleteCrop()` - Deletar cultura

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
mysqldump -u root -p agri_dom > backup_agri_dom.sql
```

### Restore
```bash
mysql -u root -p agri_dom < backup_agri_dom.sql
```