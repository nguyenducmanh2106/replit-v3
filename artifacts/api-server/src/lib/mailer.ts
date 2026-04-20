import nodemailer from "nodemailer";

const GMAIL_USER = process.env["GMAIL_USER"] ?? "nguyenducmanh2106@gmail.com";
const GMAIL_APP_PASSWORD = process.env["GMAIL_APP_PASSWORD"];

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(opts: {
  to: string;
  verificationUrl: string;
  name?: string;
}) {
  const { to, verificationUrl, name } = opts;
  await transporter.sendMail({
    from: `"EduPlatform" <${GMAIL_USER}>`,
    to,
    subject: "Xác thực tài khoản EduPlatform của bạn",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#378ADD;padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;line-height:40px;text-align:center;">
                  <span style="color:#fff;font-weight:bold;font-size:20px;">E</span>
                </div>
                <span style="color:#fff;font-size:24px;font-weight:700;vertical-align:middle;">EduPlatform</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1a1a2e;">Xác thực địa chỉ email</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#4a5568;line-height:1.6;">
                Xin chào${name ? ` <strong>${name}</strong>` : ""},<br><br>
                Cảm ơn bạn đã đăng ký tài khoản EduPlatform! Vui lòng nhấn nút bên dưới để xác thực địa chỉ email và kích hoạt tài khoản của bạn.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verificationUrl}" style="display:inline-block;padding:14px 36px;background:#378ADD;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                  Xác thực tài khoản
                </a>
              </div>
              <p style="margin:0;font-size:14px;color:#718096;line-height:1.6;">
                Hoặc sao chép đường link sau vào trình duyệt:<br>
                <a href="${verificationUrl}" style="color:#378ADD;word-break:break-all;">${verificationUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
                <p style="margin:0;font-size:13px;color:#a0aec0;line-height:1.6;">
                  Link xác thực này có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.<br><br>
                  &copy; 2026 EduPlatform. All rights reserved.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  name?: string;
}) {
  const { to, resetUrl, name } = opts;
  await transporter.sendMail({
    from: `"EduPlatform" <${GMAIL_USER}>`,
    to,
    subject: "Đặt lại mật khẩu EduPlatform",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#378ADD;padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;line-height:40px;text-align:center;">
                  <span style="color:#fff;font-weight:bold;font-size:20px;">E</span>
                </div>
                <span style="color:#fff;font-size:24px;font-weight:700;vertical-align:middle;">EduPlatform</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1a1a2e;">Đặt lại mật khẩu</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#4a5568;line-height:1.6;">
                Xin chào${name ? ` <strong>${name}</strong>` : ""},<br><br>
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tiếp tục.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#378ADD;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">
                  Đặt lại mật khẩu
                </a>
              </div>
              <p style="margin:0;font-size:14px;color:#718096;line-height:1.6;">
                Link này có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
                <p style="margin:0;font-size:13px;color:#a0aec0;">&copy; 2026 EduPlatform. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}
