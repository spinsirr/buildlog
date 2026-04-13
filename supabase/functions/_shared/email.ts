const FROM_EMAIL = "BuildLog <notifications@buildlog.ink>"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getAppUrl(): string {
  return Deno.env.get("APP_URL") ?? Deno.env.get("NEXT_PUBLIC_APP_URL") ??
    "https://buildlog.ink"
}

export async function sendNotificationEmail({
  to,
  subject,
  message,
  link,
}: {
  to: string
  subject: string
  message: string
  link?: string | null
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  if (!apiKey) return

  const appUrl = getAppUrl()
  const linkHtml = link
    ? `<p style="margin-top:16px"><a href="${appUrl}${link}" style="color:#818cf8;text-decoration:underline">View in BuildLog</a></p>`
    : ""

  const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#e4e4e7;background:#09090b;border-radius:8px">
        <h2 style="margin:0 0 16px;font-size:16px;color:#fafafa">BuildLog</h2>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa">${escapeHtml(message)}</p>
        ${linkHtml}
        <hr style="margin:24px 0;border:none;border-top:1px solid #27272a" />
        <p style="margin:0;font-size:11px;color:#52525b">You can disable email notifications in your <a href="${appUrl}/settings" style="color:#818cf8">settings</a>.</p>
      </div>
    `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error: ${res.status} ${body}`)
  }
}
