export async function sendMagicLink(env, { to, link }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject: 'Sign in to news',
      text:
        `Click the link below to sign in. It expires in 10 minutes.\n\n` +
        `${link}\n\n` +
        `If you didn't request this, ignore this email.`,
      html:
        `<p>Click the link below to sign in. It expires in 10 minutes.</p>` +
        `<p><a href="${link}">${link}</a></p>` +
        `<p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}
