const BRAZILIAN_AREA_CODES = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46',
  '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66',
  '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84',
  '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

function classifyBrazilianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if (![10, 11].includes(local.length) || !BRAZILIAN_AREA_CODES.has(local.slice(0, 2))) return null;
  return { normalized: `55${local}`, isMobile: local.length === 11 && local[2] === '9' };
}

function selectPreferredPhone(original, enriched) {
  const originalInfo = classifyBrazilianPhone(original);
  const enrichedInfo = classifyBrazilianPhone(enriched);
  if (originalInfo?.isMobile) return { value: String(original).trim(), ...originalInfo };
  if (enrichedInfo?.isMobile) return { value: String(enriched).trim(), ...enrichedInfo };
  if (originalInfo) return { value: String(original).trim(), ...originalInfo };
  if (enrichedInfo) return { value: String(enriched).trim(), ...enrichedInfo };
  return null;
}

module.exports = { classifyBrazilianPhone, selectPreferredPhone };
