import type { Config } from '../env'

export type Mail = { to: string | string[]; subject: string; html: string; text?: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Minimal HTML email body; every value passed through `esc`. */
export const mailLayout = (title: string, lines: string[], link?: { href: string; label: string }) =>
  `<div style="font-family:Arial,sans-serif;font-size:14px"><h3>${esc(title)}</h3>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}${
    link ? `<p><a href="${esc(link.href)}">${esc(link.label)}</a></p>` : ''}<p style="color:#888;font-size:12px">KPIN — automated message</p></div>`

/**
 * Send via Resend's HTTP API (free tier: 3,000 mails/month) — HTTP works on Vercel and Workers alike.
 * Without RESEND_API_KEY it logs instead of sending, so local dev and tests never mail anyone.
 */
export async function sendMail(cfg: Config, m: Mail): Promise<{ ok: boolean; error?: string }> {
  if (!cfg.RESEND_API_KEY) {
    console.log(JSON.stringify({ mail: { to: m.to, subject: m.subject } }))
    return { ok: true }
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: cfg.MAIL_FROM ?? 'KPIN <onboarding@resend.dev>', to: m.to, subject: m.subject, html: m.html, text: m.text }),
  })
  return r.ok ? { ok: true } : { ok: false, error: `${r.status} ${(await r.text()).slice(0, 300)}` }
}
