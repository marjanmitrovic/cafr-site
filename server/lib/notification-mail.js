export async function sendNotification({ resend, provider, recipients, subject, html, text }) {
  if (provider === 'brevo') {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'info@ucfr.cz',
          name: process.env.BREVO_SENDER_NAME || 'UČFR',
        },
        to: recipients.map(email => ({ email })),
        subject, htmlContent: html, textContent: text || subject,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Brevo rejected the message (HTTP ' + response.status + ')');
    const { messageId } = await response.json();
    if (!messageId) throw new Error('Brevo did not return a message ID');
    return messageId;
  }

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'UČFR <onboarding@resend.dev>',
    to: recipients, subject, html, text: text || subject,
  });
  if (result?.error) throw new Error('Resend rejected the message');
  const messageId = result?.data?.id || result?.id;
  if (!messageId) throw new Error('Resend did not return a message ID');
  return messageId;
}
