// Zambian phone numbers are stored in one form: +260XXXXXXXXX.
// Accounts made before this rule (or by scripts) may hold 0XXXXXXXXX,
// so lookups match both forms.

const PHONE_RE = /^(\+260|0)(9[5-7]|7[6-9])\d{7}$/;

// "0977 123 456", "260977123456" or "+260977123456" → "+260977123456"
const normalizePhone = (phone) => {
  const raw = String(phone || '').trim().replace(/[\s()-]/g, '');
  if (/^260\d{9}$/.test(raw)) return `+${raw}`;
  if (/^0\d{9}$/.test(raw)) return `+260${raw.slice(1)}`;
  return raw;
};

const isValidPhone = (phone) => PHONE_RE.test(normalizePhone(phone));

// Both stored forms of one number, for queries: { phone: { $in: phoneVariants(p) } }
const phoneVariants = (phone) => {
  const intl = normalizePhone(phone);
  return /^\+260\d{9}$/.test(intl) ? [intl, `0${intl.slice(4)}`] : [intl];
};

module.exports = { PHONE_RE, normalizePhone, isValidPhone, phoneVariants };
