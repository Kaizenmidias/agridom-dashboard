# Financial MySQL test environment

These instructions target an already installed MySQL instance on the test VPS. They do not use Docker and must not be executed against production.

## Prepare the isolated database

Run as a MySQL administrator only on the test VPS. Use a unique password supplied out of band; the example is a placeholder and must not be reused:

```sql
CREATE DATABASE kaizen_financial_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kaizen_financial_test'@'127.0.0.1' IDENTIFIED BY '<TEST_ONLY_PASSWORD>';
GRANT ALL PRIVILEGES ON kaizen_financial_test.* TO 'kaizen_financial_test'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Confirm the selected database is exactly `kaizen_financial_test` before loading files. Load the schema and migrations into the exclusive database:

```bash
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=kaizen_financial_test --password --database=kaizen_financial_test < database/schema.mysql.sql
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=kaizen_financial_test --password --database=kaizen_financial_test < database/migrations/20261012_project_financial_events.sql
mysql --protocol=TCP --host=127.0.0.1 --port=3306 --user=kaizen_financial_test --password --database=kaizen_financial_test < database/migrations/20261012_project_financial_baselines.sql
```

Run the real integration suite only after the isolated MySQL instance and both migrations are ready:

PowerShell:

```powershell
$env:KAIZEN_FINANCIAL_TEST_DB = '1'
$env:KAIZEN_FINANCIAL_TEST_HOST = '127.0.0.1'
$env:KAIZEN_FINANCIAL_TEST_PORT = '3306'
$env:KAIZEN_FINANCIAL_TEST_DATABASE = 'kaizen_financial_test'
$env:KAIZEN_FINANCIAL_TEST_USER = 'kaizen_financial_test'
$env:KAIZEN_FINANCIAL_TEST_PASSWORD = 'kaizen_financial_test'
node --test server/tests/project-financial-mysql.integration.test.js
```

Bash:

```bash
KAIZEN_FINANCIAL_TEST_DB=1 KAIZEN_FINANCIAL_TEST_HOST=127.0.0.1 KAIZEN_FINANCIAL_TEST_PORT=3306 KAIZEN_FINANCIAL_TEST_DATABASE=kaizen_financial_test KAIZEN_FINANCIAL_TEST_USER=kaizen_financial_test KAIZEN_FINANCIAL_TEST_PASSWORD='<TEST_ONLY_PASSWORD>' node --test server/tests/project-financial-mysql.integration.test.js
```

The suite refuses any database other than `kaizen_financial_test`, any host other than `127.0.0.1`, and the production user `root`. It cleans only its dedicated test user and projects.

The commands above are preparation instructions only. They were not executed by Codex.

The test process uses `127.0.0.1:3306` by default, database `kaizen_financial_test`, and test-only credentials through a temporary process environment, never by editing production `.env` files.

## Required behavioral scenarios

- initial payment and partial payment;
- legacy baseline and first post-legacy event;
- incremental completion;
- repeated completion;
- identical and conflicting idempotency keys;
- payment after zero balance;
- payment/completion concurrency;
- rollback after event failure;
- October/November and December/January competence;
- project and Dashboard indicator consistency;
- cancelled projects;
- no duplicate events.

The repository also has static/mocked financial tests. The integration suite above refuses to run unless the database name and host match this isolated environment.

## Cleanup

Run only on the isolated test VPS, after the tests finish. This removes only the test database and test user:

```sql
DROP DATABASE kaizen_financial_test;
DROP USER 'kaizen_financial_test'@'127.0.0.1';
```

These commands are destructive for the disposable test environment and were not executed.
