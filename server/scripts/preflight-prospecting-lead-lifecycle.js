#!/usr/bin/env node

const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env'),
});

const { closeConnection, getPool } = require('../config/database');

function classifyPreflight({ duplicates = [], emptyCount = 0 } = {}) {
  const duplicateGroups = Array.isArray(duplicates) ? duplicates.length : 0;
  const emptyNormalizedPhone = Number(emptyCount) || 0;
  const safe = duplicateGroups === 0 && emptyNormalizedPhone === 0;

  return {
    safe,
    duplicateGroups,
    emptyNormalizedPhone,
  };
}

async function run() {
  const connection = await getPool().getConnection();

  try {
    const [duplicates] = await connection.execute(`
      SELECT normalized_phone, COUNT(*) AS total, GROUP_CONCAT(id ORDER BY id) AS prospect_ids
      FROM prospects
      WHERE normalized_phone IS NOT NULL AND TRIM(normalized_phone) <> ''
      GROUP BY normalized_phone
      HAVING COUNT(*) > 1
      ORDER BY total DESC, normalized_phone
    `);
    const [emptyRows] = await connection.execute(`
      SELECT COUNT(*) AS empty_normalized_phone
      FROM prospects
      WHERE normalized_phone = ''
    `);

    const result = classifyPreflight({
      duplicates,
      emptyCount: emptyRows[0]?.empty_normalized_phone,
    });

    if (!result.safe) {
      console.error(
        `PREFLIGHT UNSAFE: ${result.duplicateGroups} grupo(s) duplicado(s) e ` +
        `${result.emptyNormalizedPhone} telefone(s) normalizado(s) vazio(s).`,
      );
      return false;
    }

    console.log('PREFLIGHT SAFE: nenhum duplicado e nenhum telefone normalizado vazio encontrado.');
    return true;
  } finally {
    connection.release();
    await closeConnection();
  }
}

if (require.main === module) {
  run()
    .then((safe) => {
      process.exitCode = safe ? 0 : 1;
    })
    .catch((error) => {
      console.error(`PREFLIGHT ERROR: ${error.code || 'DATABASE_ERROR'}`);
      process.exitCode = 1;
    });
}

module.exports = { classifyPreflight, run };
