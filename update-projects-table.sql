-- Script para atualizar a estrutura da tabela projects
USE dashboard;

-- Remover colunas antigas que não são mais necessárias
ALTER TABLE projects 
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS total_area,
DROP COLUMN IF EXISTS budget,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date;

-- Adicionar novas colunas
ALTER TABLE projects 
ADD COLUMN client VARCHAR(255) AFTER name,
ADD COLUMN project_type VARCHAR(100) AFTER client,
ADD COLUMN project_value DECIMAL(12, 2) AFTER description,
ADD COLUMN paid_value DECIMAL(12, 2) DEFAULT 0 AFTER project_value,
ADD COLUMN delivery_date DATE AFTER paid_value;

-- Atualizar enum do status para incluir 'cancelled'
ALTER TABLE projects 
MODIFY COLUMN status ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active';