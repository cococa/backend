type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

export function canSendEmail() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail(input: SendEmailInput) {
  if (!canSendEmail()) {
    return {
      sent: false as const,
      reason: 'EMAIL_NOT_CONFIGURED' as const
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  }).catch(() => null)

  if (!response?.ok) {
    return {
      sent: false as const,
      reason: 'EMAIL_SEND_FAILED' as const
    }
  }

  return {
    sent: true as const
  }
}
