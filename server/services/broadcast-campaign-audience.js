const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeCampaignEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeCampaignChannels(value) {
  const requested = Array.isArray(value) ? value : [value || 'whatsapp'];
  const channels = [...new Set(requested.map((item) => String(item).trim().toLowerCase()))].filter(Boolean);
  if (!channels.length || channels.some((channel) => !['whatsapp', 'email'].includes(channel))) throw new Error('INVALID_CAMPAIGN_CHANNELS');
  return channels.sort();
}

function channelValue(channels) {
  const normalized = normalizeCampaignChannels(channels);
  return normalized.length === 2 ? 'both' : normalized[0];
}

function eligibility(row) {
  const whatsappEligible = Boolean(String(row.normalized_phone || '').trim());
  const email = normalizeCampaignEmail(row.email);
  return { whatsappEligible, emailEligible: Boolean(email), email };
}

function summarizeAudience(rows) {
  const summary = { totalLeads: rows.length, withWhatsApp: 0, withEmail: 0, withBoth: 0, withoutAnyContact: 0 };
  for (const row of rows) {
    const result = eligibility(row);
    if (result.whatsappEligible) summary.withWhatsApp += 1;
    if (result.emailEligible) summary.withEmail += 1;
    if (result.whatsappEligible && result.emailEligible) summary.withBoth += 1;
    if (!result.whatsappEligible && !result.emailEligible) summary.withoutAnyContact += 1;
  }
  return summary;
}

module.exports = { EMAIL_PATTERN, normalizeCampaignEmail, normalizeCampaignChannels, channelValue, eligibility, summarizeAudience };
