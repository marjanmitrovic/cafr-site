const REQUIRED_REGISTRATION_ADMIN_EMAILS = Object.freeze([
  'marapleskac@gmail.com',
  'unierozhodcich@gmail.com',
]);

function normalizedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const notificationEmails = [...new Set([
  ...normalizedEmails(process.env.ADMIN_NOTIFY_EMAIL),
  ...normalizedEmails(process.env.ADMIN_EMAIL),
  ...REQUIRED_REGISTRATION_ADMIN_EMAILS,
])];

process.env.ADMIN_NOTIFY_EMAIL = notificationEmails.join(',');
process.env.ASSOCIATION_ICO = '24417513';
