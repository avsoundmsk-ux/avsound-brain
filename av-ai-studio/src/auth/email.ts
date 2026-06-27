/**
 * Отправка писем (verify / reset).
 * SMTP пока НЕ подключён (ждёт env: SMTP_HOST/PORT/USER/PASS).
 * До этого — лог в консоль, чтобы поток auth работал в dev без падения.
 */
type Mail = { to: string; subject: string; text: string };

export async function sendEmail(mail: Mail): Promise<void> {
  if (!process.env.SMTP_HOST) {
    // SECURITY (C-4): НЕ логировать mail.text — содержит verify/reset токены (credential).
    // Только subject + to. Текст письма наружу не пишем.
    console.warn(`[email] SMTP не настроен — письмо не отправлено: "${mail.subject}" → ${mail.to}`);
    return;
  }
  // TODO(P1/P4): реальная отправка через SMTP (nodemailer/Resend) после получения env.
  console.warn(`[email] SMTP задан, но отправка ещё не реализована (заглушка P1): ${mail.subject}`);
}
