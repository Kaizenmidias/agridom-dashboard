const { encryptSecret } = require('./integration-crypto');

async function createOAuthState(pool, { userId, stateHash, codeVerifier, expiresAt, intent = 'initial', baseConnectionId = null, baseConnectionUpdatedAt = null, scopeKey = 'default' }) {
  const envelope = codeVerifier ? encryptSecret({ codeVerifier }) : null;
  const connection = await pool.getConnection();
  const lockName = `kaizen:gmail:oauth:${scopeKey}`;
  let locked = false;
  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) {
      const error = new Error('Outra autorizacao Gmail esta sendo iniciada para este escopo.');
      error.code = 'GMAIL_OAUTH_LOCK_TIMEOUT';
      throw error;
    }
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE gmail_oauth_states
       SET pending_scope_key = NULL, consumed_at = COALESCE(consumed_at, UTC_TIMESTAMP())
       WHERE scope_key = ? AND pending_scope_key = ? AND expires_at <= UTC_TIMESTAMP() AND consumed_at IS NULL`,
      [scopeKey, scopeKey],
    );
    const [pending] = await connection.execute(
      `SELECT id FROM gmail_oauth_states
       WHERE scope_key = ? AND pending_scope_key = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
       LIMIT 1 FOR UPDATE`,
      [scopeKey, scopeKey],
    );
    if (pending[0]) {
      await connection.rollback();
      const error = new Error('Ja existe uma autorizacao Gmail pendente para este escopo.');
      error.code = 'GMAIL_OAUTH_ALREADY_PENDING';
      throw error;
    }
    await connection.execute(
      `INSERT INTO gmail_oauth_states
        (scope_key, pending_scope_key, state_hash, initiated_by_user_id, intent, base_connection_id, base_connection_updated_at,
         code_verifier_ciphertext, code_verifier_iv, code_verifier_auth_tag, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scopeKey, scopeKey, stateHash, userId, intent, baseConnectionId, baseConnectionUpdatedAt, envelope?.ciphertext || null, envelope?.iv || null, envelope?.authTag || null, expiresAt],
    );
    await connection.commit();
  } catch (error) { await connection.rollback().catch(() => {}); throw error; } finally {
    if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    connection.release();
  }
}

async function consumeOAuthState(pool, stateHash) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE gmail_oauth_states
       SET consumed_at = UTC_TIMESTAMP(), pending_scope_key = NULL
       WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [stateHash],
    );
    if (Number(result.affectedRows) !== 1) {
      await connection.rollback();
      const error = new Error('Tentativa OAuth invalida, expirada ou ja consumida.');
      error.code = 'GMAIL_OAUTH_STATE_INVALID';
      throw error;
    }
    const [rows] = await connection.execute('SELECT * FROM gmail_oauth_states WHERE state_hash = ? LIMIT 1', [stateHash]);
    await connection.commit();
    return rows[0] || null;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function saveConnectedConnection(pool, { userId, identity, refreshToken, scopes, pendingState }) {
  const envelope = encryptSecret({ refreshToken });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.execute(
      `SELECT * FROM gmail_connections
       WHERE scope_key = 'default' AND current_scope_key = scope_key
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    );
    const current = currentRows[0] || null;
    if (pendingState?.intent === 'reconnect' && (!current || Number(current.id) !== Number(pendingState.base_connection_id) || String(current.updated_at) !== String(pendingState.base_connection_updated_at))) {
      const error = new Error('A autorizacao Gmail ficou obsoleta porque a conexao mudou.');
      error.code = 'GMAIL_OAUTH_STALE';
      throw error;
    }
    if (pendingState?.intent === 'initial' && current) {
      const error = new Error('A conexao Gmail ja foi estabelecida por outra autorizacao.');
      error.code = 'GMAIL_OAUTH_STALE';
      throw error;
    }
    await connection.execute(
      `UPDATE gmail_connections
       SET status = 'disconnected', current_scope_key = NULL, disconnected_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP
       WHERE scope_key = 'default' AND current_scope_key = scope_key`,
    );
    await connection.execute(
      `INSERT INTO gmail_connections
       (scope_key, provider, google_account_id, email_address, display_name, status,
        refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag,
        scopes_granted, connected_by_user_id, connected_at, current_scope_key)
       VALUES ('default', 'google_gmail', ?, ?, ?, 'connected', ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'default')`,
      [identity.sub, identity.email, identity.name || null, envelope.ciphertext, envelope.iv, envelope.authTag, JSON.stringify(scopes), userId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function getCurrentConnection(pool) {
  const [rows] = await pool.execute(
    `SELECT * FROM gmail_connections
     WHERE scope_key = 'default' AND current_scope_key = scope_key
     ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] || null;
}

async function disconnectCurrentConnection(pool) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM gmail_connections WHERE scope_key = 'default' AND current_scope_key = scope_key ORDER BY id DESC LIMIT 1 FOR UPDATE`);
    const current = rows[0] || null;
    if (!current) { await connection.commit(); return null; }
    await connection.execute(
      `UPDATE gmail_connections
     SET status = 'disconnected', current_scope_key = NULL,
         refresh_token_ciphertext = NULL, refresh_token_iv = NULL, refresh_token_auth_tag = NULL,
         disconnected_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP
     WHERE scope_key = 'default' AND current_scope_key = scope_key`,
    );
    await connection.commit();
    return current;
  } catch (error) { await connection.rollback().catch(() => {}); throw error; } finally { connection.release(); }
}

module.exports = { createOAuthState, consumeOAuthState, saveConnectedConnection, getCurrentConnection, disconnectCurrentConnection };
