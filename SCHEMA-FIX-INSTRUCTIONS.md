# 🔧 Correção de Schema do Supabase - Produção

## 📋 Problemas Identificados

✅ **Confirmado via script de diagnóstico:**

1. **Projects.user_id**: Tipo `integer` mas deveria ser `uuid`
   - Erro: `invalid input syntax for type integer: "707fd228-9a0c-4fb5-aa87-7ea78e607e4a"`

2. **Expenses.amount**: Coluna não existe (usa `value`)
   - Erro: `Could not find the 'amount' column of 'expenses' in the schema cache`

3. **HTTP 400**: Schema desalinhado entre frontend e backend

## 🚀 Soluções Disponíveis

### Opção 1: SQL Manual (Recomendado)

1. **Acesse o Supabase Dashboard** → SQL Editor
2. **Execute o script** `fix-production-schema.sql`:

```sql
-- 1. Corrigir projects.user_id para UUID
ALTER TABLE projects 
ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- 2. Garantir foreign key para usuários do Supabase Auth
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- 3. Criar coluna amount na tabela expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS amount numeric;

-- 4. Copiar dados de value para amount
UPDATE expenses SET amount = value WHERE amount IS NULL;

-- 5. Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';
```

### Opção 2: Script Automatizado

```bash
# Verificar problemas
node apply-schema-fixes.js

# Aplicar correções (se RPC estiver habilitado)
node execute-schema-fixes.js
```

## 🧪 Validação

### Antes das Correções:
```
❌ Erro ao criar projeto: invalid input syntax for type integer
❌ Erro ao criar despesa: Could not find the 'amount' column
```

### Após as Correções:
```
✅ Projeto criado com UUID com sucesso!
✅ Despesa criada com amount com sucesso!
```

## 📊 Schema Atual vs Esperado

### Tabela `projects`
| Coluna | Atual | Esperado | Status |
|--------|-------|----------|--------|
| user_id | `integer` | `uuid` | ❌ Precisa correção |
| id | `uuid` | `uuid` | ✅ OK |
| name | `text` | `text` | ✅ OK |

### Tabela `expenses`
| Coluna | Atual | Esperado | Status |
|--------|-------|----------|--------|
| amount | ❌ Não existe | `numeric` | ❌ Precisa criação |
| value | `numeric` | `numeric` | ✅ OK (manter) |
| id | `uuid` | `uuid` | ✅ OK |

## 🔍 Verificação Pós-Correção

1. **Execute novamente o diagnóstico:**
   ```bash
   node apply-schema-fixes.js
   ```

2. **Teste o dashboard:**
   - Criar novo projeto
   - Criar nova despesa
   - Verificar console do browser (sem erros)

3. **Verificar logs do Supabase:**
   - Dashboard → Logs
   - Sem erros de tipo/schema

## 🚨 Troubleshooting

### Se ainda houver erros:

1. **Cache não atualizado:**
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

2. **Verificar permissões RLS:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('projects', 'expenses');
   ```

3. **Verificar constraints:**
   ```sql
   SELECT constraint_name, table_name 
   FROM information_schema.table_constraints 
   WHERE table_name IN ('projects', 'expenses');
   ```

## 📝 Notas Importantes

- ⚠️ **Backup**: Faça backup antes de executar as alterações
- 🔄 **Downtime**: Alterações podem causar breve indisponibilidade
- 🧪 **Teste**: Valide em ambiente de desenvolvimento primeiro
- 📊 **Dados**: Comando `UPDATE` copia dados de `value` para `amount`

## ✅ Checklist Final

- [ ] Script SQL executado no Supabase Dashboard
- [ ] Schema recarregado (`NOTIFY pgrst, 'reload schema'`)
- [ ] Teste de criação de projeto (sem erro UUID)
- [ ] Teste de criação de despesa (sem erro amount)
- [ ] Dashboard funcionando sem erros 400
- [ ] Console do browser limpo (sem erros)

---

**🎯 Resultado Esperado:** Dashboard funcionando 100% sem erros de schema!