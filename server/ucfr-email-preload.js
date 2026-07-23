import { Resend } from 'resend';

const ADMIN_EMAILS = Object.freeze([
  'marjan.posao@gmail.com',
  'marapleskac@gmail.com',
]);

const replacements = [
  ['ČESKÁ ASOCIACE FOTBALOVÝCH ROZHODČÍCH', 'UNIE ČESKÝCH FOTBALOVÝCH ROZHODČÍCH'],
  ['Česká asociace fotbalových rozhodčích', 'Unie českých fotbalových rozhodčích'],
  ['Czech Association of Football Referees', 'Union of Czech Football Referees'],
  ['ČAFR', 'UČFR'],
];

function replaceBrand(value) {
  if (value === undefined || value === null) return value;
  return replacements.reduce(
    (result, [from, to]) => String(result).split(from).join(to),
    value,
  );
}

function normalizeRecipients(value) {
  const source = Array.isArray(value) ? value : [value];
  return source
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

process.env.ADMIN_NOTIFY_EMAIL = ADMIN_EMAILS[0];
process.env.ADMIN_EMAIL = ADMIN_EMAILS[0];

const probe = new Resend('re_ucfr_preload_probe');
const emailsPrototype = Object.getPrototypeOf(probe.emails);

if (emailsPrototype && !emailsPrototype.__ucfrAdminRecipientsPatched) {
  const originalSend = emailsPrototype.send;

  Object.defineProperty(emailsPrototype, '__ucfrAdminRecipientsPatched', {
    value: true,
    enumerable: false,
    configurable: false,
  });

  emailsPrototype.send = function sendWithUcfrBrand(payload, options) {
    const recipients = new Map(
      normalizeRecipients(payload?.to).map((email) => [email.toLowerCase(), email]),
    );

    if (recipients.has(ADMIN_EMAILS[0]) || recipients.has(ADMIN_EMAILS[1])) {
      for (const email of ADMIN_EMAILS) recipients.set(email, email);
    }

    const patchedPayload = {
      ...payload,
      to: [...recipients.values()],
      subject: replaceBrand(payload?.subject),
      html: replaceBrand(payload?.html),
      text: replaceBrand(payload?.text),
    };

    return originalSend.call(this, patchedPayload, options);
  };
}
