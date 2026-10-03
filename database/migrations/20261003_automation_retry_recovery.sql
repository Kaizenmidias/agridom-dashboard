-- Kaizen CRM - persistent retry ceiling for automation jobs.
-- Additive only; existing rows retain their current max_attempts value.
USE kaizen_crm;

ALTER TABLE automation_jobs
  MODIFY COLUMN max_attempts INT UNSIGNED NOT NULL DEFAULT 8;
