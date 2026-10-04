import "server-only";

import type { EmailMessage } from "./email";

/*
 * Turkish transactional emails. Email clients ignore CSS variables and
 * stylesheets, so DESIGN.md colours are inlined here (the only place outside
 * globals.css that may hold raw values; not scanned by lint:tokens).
 */
const COLOR = {
  canvas: "#F4F7FC",
  paper: "#FFFFFF",
  heading: "#0B1736",
  body: "#475569",
  primary: "#1D4ED8",
  hairline: "#E3E8F2",
} as const;

const FONT = "Montserrat, 'Segoe UI', Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

interface Layout {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footnote: string;
}

function render({ to, subject, heading, paragraphs, action, footnote }: Layout): EmailMessage {
  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:${COLOR.canvas};font-family:${FONT};color:${COLOR.heading}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLOR.paper};border:1px solid ${COLOR.hairline};border-radius:24px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;letter-spacing:-0.02em;padding-bottom:24px">Recall</td></tr>
<tr><td style="font-size:22px;font-weight:600;letter-spacing:-0.03em;line-height:1.25;padding-bottom:16px">${escapeHtml(heading)}</td></tr>
${paragraphs.map((p) => `<tr><td style="font-size:15px;line-height:1.6;color:${COLOR.body};padding-bottom:12px">${escapeHtml(p)}</td></tr>`).join("\n")}
<tr><td style="padding:16px 0 24px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${COLOR.primary};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:999px">${escapeHtml(action.label)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:${COLOR.body};border-top:1px solid ${COLOR.hairline};padding-top:16px">${escapeHtml(footnote)}<br>Bağlantı çalışmazsa tarayıcınıza yapıştırın: ${escapeHtml(action.url)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    "",
    `${action.label}: ${action.url}`,
    "",
    footnote,
  ].join("\n");
  return { to, subject, html, text };
}

export function invitationEmail(input: {
  to: string;
  clinicName: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  expiresInDays: number;
}): EmailMessage {
  return render({
    to: input.to,
    subject: `${input.clinicName} sizi Recall paneline davet ediyor`,
    heading: `${input.clinicName} ekibine katılın`,
    paragraphs: [
      `${input.inviterName}, sizi ${input.clinicName} kliniğinin Recall paneline "${input.roleLabel}" olarak davet etti.`,
      "Daveti kabul ederek randevuları, aramaları ve geri arama listesini panelden takip edebilirsiniz.",
    ],
    action: { label: "Daveti kabul et", url: input.url },
    footnote: `Bu davet ${input.expiresInDays} gün geçerlidir. Sizinle ilgili değilse bu e-postayı yok sayabilirsiniz.`,
  });
}

/** Sent both for "forgot password" and to new accounts created by the Recall team. */
export function passwordEmail(input: {
  to: string;
  url: string;
  kind: "reset" | "setup";
  expiresInHours: number;
}): EmailMessage {
  const setup = input.kind === "setup";
  return render({
    to: input.to,
    subject: setup ? "Recall hesabınız hazır: parolanızı belirleyin" : "Recall parola sıfırlama",
    heading: setup ? "Parolanızı belirleyin" : "Parolanızı sıfırlayın",
    paragraphs: setup
      ? [
          "Kliniğiniz için bir Recall hesabı oluşturuldu.",
          "Panele giriş yapabilmek için aşağıdaki bağlantıdan parolanızı belirleyin.",
        ]
      : [
          "Hesabınız için parola sıfırlama talebi aldık.",
          "Yeni parolanızı aşağıdaki bağlantıdan belirleyebilirsiniz.",
        ],
    action: { label: setup ? "Parolamı belirle" : "Parolamı sıfırla", url: input.url },
    footnote: setup
      ? `Bağlantı ${input.expiresInHours} saat geçerlidir.`
      : `Bağlantı ${input.expiresInHours} saat geçerlidir. Bu talebi siz yapmadıysanız e-postayı yok sayın; parolanız değişmez.`,
  });
}
