-- Manual MySQL 8.4 migration for safe prospecting provider counters.
-- Do not execute automatically. Apply only after reviewing the production schema.

ALTER TABLE prospecting_jobs
  ADD COLUMN provider_item_count INT UNSIGNED NULL DEFAULT NULL AFTER requested_quantity,
  ADD COLUMN rating_filtered_count INT UNSIGNED NULL DEFAULT NULL AFTER provider_item_count,
  ADD COLUMN candidate_count INT UNSIGNED NULL DEFAULT NULL AFTER rating_filtered_count;

-- Existing jobs intentionally remain NULL until they are processed again.
