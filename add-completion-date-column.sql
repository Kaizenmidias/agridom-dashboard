-- Script para adicionar campo completion_date na tabela projects
-- Este campo registrará quando o projeto foi concluído

ALTER TABLE projects 
ADD COLUMN completion_date TIMESTAMP NULL 
COMMENT 'Data de conclusão do projeto - usado para calcular faturamento de valores pendentes';

-- Atualizar projetos já concluídos para usar a data de atualização como completion_date
UPDATE projects 
SET completion_date = updated_at 
WHERE status = 'completed' AND completion_date IS NULL;