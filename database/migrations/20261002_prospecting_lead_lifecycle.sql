-- Manual MySQL 8.4 migration for Prospecting -> Leads lifecycle.
--
-- STEP 1: run server/scripts/preflight-prospecting-lead-lifecycle.js.
-- STEP 2: continue only when the preflight exits with code 0.
-- STEP 3: create a verified production database backup.
-- STEP 4: apply this file manually in the production database.
-- STEP 5: validate the new columns, foreign keys, and unique key after applying.
--
-- No automatic migration runner is expected to execute this file.

ALTER TABLE prospects
  ADD UNIQUE KEY uq_prospects_normalized_phone (normalized_phone);

ALTER TABLE prospecting_jobs
  ADD COLUMN destination_folder_id BIGINT UNSIGNED NULL AFTER created_by,
  ADD CONSTRAINT fk_prospecting_job_destination_folder
    FOREIGN KEY (destination_folder_id) REFERENCES lead_folders(id)
    ON DELETE SET NULL;

ALTER TABLE prospecting_results
  ADD COLUMN prospect_id BIGINT UNSIGNED NULL AFTER job_id,
  ADD CONSTRAINT fk_prospecting_result_prospect
    FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    ON DELETE SET NULL;

-- Manual rollback, to be reviewed and executed separately if required:
-- ALTER TABLE prospecting_results
--   DROP FOREIGN KEY fk_prospecting_result_prospect,
--   DROP COLUMN prospect_id;
-- ALTER TABLE prospecting_jobs
--   DROP FOREIGN KEY fk_prospecting_job_destination_folder,
--   DROP COLUMN destination_folder_id;
-- ALTER TABLE prospects
--   DROP INDEX uq_prospects_normalized_phone;
