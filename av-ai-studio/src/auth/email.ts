/**
 * Отправка писем (verify / reset).
 * SMTP пока НЕ подключён (ждёт env: SMTP_HOST/PORT/USER/PASS).
 * До этого — лог в консоль, чтобы поток auth работал в dev без падения.
 */
type Mail = { to: string; subject: string; text: string };

export async function sendEmail(mail: Mail): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn(`[email] SMTP не настроен — письмо не отправлено: "${mail.subject}" → ${mail.to}`);
    console.warn(`[email] ссылка/текст: ${mail.text}`);
    return;
  }
  // TODO(P1/P4): реальная отправка через SMTP (nodemailer/Resend) после получения env.
  console.warn(`[email] SMTP задан, но отправка ещё не реализована (заглушка P1): ${mail.subject}`);
}
