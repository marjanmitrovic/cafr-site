import test from 'node:test';
import assert from 'node:assert/strict';
import { sendNotification } from '../server/lib/notification-mail.js';

const mail = { recipients: ['member@example.invalid'], subject: 'test', text: 'fixture', html: '<p>fixture</p>' };

test('Resend returns a receipt only for an accepted message', async () => {
  const send = response => sendNotification({ ...mail, provider: 'resend', resend: { emails: { send: async () => response } } });
  await assert.rejects(send({ error: { message: 'denied' } }));
  await assert.rejects(send({ data: {} }));
  assert.equal(await send({ data: { id: 'fixture-receipt' } }), 'fixture-receipt');
});

test('Brevo notifications require a successful status and message ID', async t => {
  let result = Response.json({ messageId: 'fixture-receipt' }, { status: 201 });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.deepEqual(JSON.parse(options.body).to, [{ email: 'member@example.invalid' }]);
    return result;
  });
  const send = () => sendNotification({ ...mail, provider: 'brevo' });
  assert.equal(await send(), 'fixture-receipt');
  result = Response.json({}, { status: 201 });
  await assert.rejects(send());
  result = Response.json({ message: 'synthetic' }, { status: 401 });
  await assert.rejects(send());
});
