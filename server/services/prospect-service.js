const { getPool } = require('../config/database');

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const textOrNull = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const normalizeWebsite = (value) => {
  const text = textOrNull(value);
  if (!text) return null;
  return text.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
};

const normalizeBusinessName = (value) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const executeWithResult = async (connection, sql, params = []) => {
  const [rows] = await connection.execute(sql, params);
  return {
    rows: Array.isArray(rows) ? rows : [],
    rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0,
    insertId: rows?.insertId,
    affectedRows: rows?.affectedRows,
  };
};

function getExecutor(options = {}) {
  if (options.connection) return (sql, params) => executeWithResult(options.connection, sql, params);
  if (options.query) return options.query;
  return async (sql, params) => {
    const result = await getPool().execute(sql, params);
    const [rows] = result;
    return { rows: Array.isArray(rows) ? rows : [], insertId: rows?.insertId, affectedRows: rows?.affectedRows };
  };
}

function isNormalizedPhoneDuplicate(error) {
  if (!error || (error.code !== 'ER_DUP_ENTRY' && error.errno !== 1062)) return false;
  const message = String(error.sqlMessage || error.message || '').toLowerCase();
  return message.includes('normalized_phone') || message.includes('uq_prospects_normalized_phone');
}

function buildInsertValues(input = {}) {
  const phone = textOrNull(input.phone);
  const normalizedPhone = onlyDigits(phone);
  return {
    phone,
    normalizedPhone: normalizedPhone || null,
    values: [
      input.ownerUserId,
      input.assignedUserId ?? null,
      textOrNull(input.businessName),
      normalizeBusinessName(input.businessName),
      textOrNull(input.category),
      textOrNull(input.address),
      textOrNull(input.city),
      textOrNull(input.state),
      phone,
      normalizedPhone || null,
      textOrNull(input.email),
      phone ? textOrNull(input.website) : textOrNull(input.website),
      normalizeWebsite(input.website),
      input.website ? 1 : 0,
      input.leadScore ?? 0,
      input.status || 'Novo',
      textOrNull(input.origin),
      input.analysisReport == null ? null : JSON.stringify(input.analysisReport),
    ],
  };
}

async function findProspect(execute, normalizedPhone) {
  const result = await execute(
    `SELECT * FROM prospects WHERE normalized_phone = ? LIMIT 1`,
    [normalizedPhone],
  );
  return result.rows?.[0] || null;
}

async function createOrFindProspect(input = {}, options = {}) {
  const execute = getExecutor(options);
  const { normalizedPhone, values } = buildInsertValues(input);

  if (!normalizedPhone) {
    return { prospect: null, created: false, duplicate: false, reason: 'missing_normalized_phone' };
  }

  const existing = await findProspect(execute, normalizedPhone);
  if (existing) return { prospect: existing, created: false, duplicate: true };

  try {
    const insert = await execute(
      `INSERT INTO prospects (
        owner_user_id, assigned_user_id, business_name, normalized_business_name, category, address, city, state,
        phone, normalized_phone, email, website, normalized_website, website_exists,
        lead_score, status, origin, analysis_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );
    const prospect = await execute('SELECT * FROM prospects WHERE id = ?', [insert.insertId]);
    return { prospect: prospect.rows?.[0] || { id: insert.insertId, normalized_phone: normalizedPhone }, created: true, duplicate: false };
  } catch (error) {
    if (!isNormalizedPhoneDuplicate(error)) throw error;
    const concurrent = await findProspect(execute, normalizedPhone);
    if (!concurrent) throw error;
    return { prospect: concurrent, created: false, duplicate: true };
  }
}

module.exports = {
  buildInsertValues,
  createOrFindProspect,
  isNormalizedPhoneDuplicate,
  normalizePhone: onlyDigits,
  normalizeWebsite,
};
