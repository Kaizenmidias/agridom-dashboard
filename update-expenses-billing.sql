-- Adicionar campos para tipo de cobrança e recorrência na tabela expenses

ALTER TABLE expenses 
ADD COLUMN billing_type ENUM('unica', 'semanal', 'mensal', 'anual') DEFAULT 'unica' AFTER notes,
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE AFTER billing_type,
ADD COLUMN recurring_day_of_week TINYINT NULL COMMENT 'Dia da semana para cobrança semanal (0=Domingo, 1=Segunda, etc.)' AFTER is_recurring,
ADD COLUMN recurring_end_date DATE NULL COMMENT 'Data final para recorrência (opcional)' AFTER recurring_day_of_week,
ADD COLUMN original_expense_id CHAR(36) NULL COMMENT 'ID da despesa original para despesas recorrentes' AFTER recurring_end_date;

-- Adicionar índices para melhor performance
CREATE INDEX idx_expenses_billing_type ON expenses(billing_type);
CREATE INDEX idx_expenses_recurring ON expenses(is_recurring);
CREATE INDEX idx_expenses_recurring_day ON expenses(recurring_day_of_week);
CREATE INDEX idx_expenses_original_id ON expenses(original_expense_id);

-- Adicionar foreign key para despesa original
ALTER TABLE expenses 
ADD CONSTRAINT fk_expenses_original 
FOREIGN KEY (original_expense_id) REFERENCES expenses(id) ON DELETE SET NULL;