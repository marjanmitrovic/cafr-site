const REQUIRED_ADMIN_EMAILS = Object.freeze([
  'marjan.posao@gmail.com',
  'marapleskac@gmail.com',
  'unierozhodcich@gmail.com',
]);

function normalizedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmails = [...new Set([
  ...normalizedEmails(process.env.ADMIN_NOTIFY_EMAIL),
  ...normalizedEmails(process.env.ADMIN_EMAIL),
  ...REQUIRED_ADMIN_EMAILS,
])];

process.env.ADMIN_NOTIFY_EMAIL = adminEmails.join(',');
process.env.ADMIN_EMAIL = adminEmails.join(',');
process.env.ASSOCIATION_ICO = '24417513';
