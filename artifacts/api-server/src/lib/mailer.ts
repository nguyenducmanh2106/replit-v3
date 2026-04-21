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

function appBaseUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim() ?? process.env["REPLIT_DEV_DOMAIN"];
  if (domain) return `https://${domain}`;
  return process.env["APP_URL"] ?? "http://localhost:3000";
}

const BRAND_HEADER = `
  <tr>
    <td style="background:#378ADD;padding:28px 40px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;line-height:36px;text-align:center;">
          <span style="color:#fff;font-weight:bold;font-size:18px;">E</span>
        </div>
        <span style="color:#fff;font-size:22px;font-weight:700;vertical-align:middle;">EduPlatform</span>
      </div>
    </td>
  </tr>
`;
const BRAND_FOOTER = `
  <tr>
    <td style="padding:0 40px 28px;">
      <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
        <p style="margin:0;font-size:13px;color:#a0aec0;line-height:1.6;">&copy; 2026 EduPlatform. All rights reserved.</p>
      </div>
    </td>
  </tr>
`;
function wrapEmail(inner: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        ${BRAND_HEADER}
        ${inner}
        ${BRAND_FOOTER}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendPlacementSubmitConfirmEmail(opts: {
  to: string;
  studentName: string;
  testTitle: string;
  submittedAt: Date;
  answeredCount: number;
  totalCount: number;
  autoScore?: number | null;
  maxScore?: number | null;
  showScoreImmediately: boolean;
}) {
  const { to, studentName, testTitle, submittedAt, answeredCount, totalCount, autoScore, maxScore, showScoreImmediately } = opts;
  const scoreBlock = showScoreImmediately && autoScore != null ? `
    <div style="background:#f0f7ff;border:1px solid #bee3f8;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#2c5282;">Điểm trắc nghiệm tự động (chưa bao gồm phần tự luận)</p>
      <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#2c5282;">${autoScore}${maxScore != null ? ` / ${maxScore}` : ""} điểm</p>
    </div>
  ` : "";
  const inner = `
    <tr><td style="padding:36px 40px 20px;">
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a1a2e;">Bạn đã nộp bài thành công!</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
        Xin chào <strong>${studentName}</strong>,<br><br>
        Chúng tôi xác nhận bạn đã nộp bài test <strong>${testTitle}</strong> lúc
        <strong>${submittedAt.toLocaleString("vi-VN")}</strong>. Bạn đã trả lời ${answeredCount}/${totalCount} câu hỏi.
      </p>
      ${scoreBlock}
      <p style="margin:0;font-size:14px;color:#718096;line-height:1.6;">
        Kết quả chính thức (kèm nhận xét từ giáo viên) sẽ được gửi đến email của bạn sau khi chấm xong.
      </p>
    </td></tr>
  `;
  await transporter.sendMail({
    from: `"EduPlatform" <${GMAIL_USER}>`,
    to,
    subject: `${testTitle} — Bạn đã nộp bài thành công!`,
    html: wrapEmail(inner),
  });
}

export async function sendPlacementNewSubmissionEmail(opts: {
  to: string;
  teacherName?: string;
  studentName: string;
  studentEmail: string;
  testTitle: string;
  submissionId: number;
  pendingCount: number;
}) {
  const { to, teacherName, studentName, studentEmail, testTitle, submissionId, pendingCount } = opts;
  const gradeUrl = `${appBaseUrl()}/placement-tests/submissions/${submissionId}`;
  const inner = `
    <tr><td style="padding:36px 40px 20px;">
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a1a2e;">Có bài nộp mới</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.6;">
        ${teacherName ? `Xin chào <strong>${teacherName}</strong>,<br><br>` : ""}
        <strong>${studentName}</strong> (${studentEmail}) vừa nộp bài test <strong>${testTitle}</strong>.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${gradeUrl}" style="display:inline-block;padding:12px 28px;background:#378ADD;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Vào chấm bài</a>
      </div>
      <p style="margin:0;font-size:13px;color:#718096;">Hiện có <strong>${pendingCount}</strong> bài đang chờ chấm.</p>
    </td></tr>
  `;
  await transporter.sendMail({
    from: `"EduPlatform" <${GMAIL_USER}>`,
    to,
    subject: `${studentName} vừa nộp bài ${testTitle}`,
    html: wrapEmail(inner),
  });
}

export async function sendPlacementResultEmail(opts: {
  to: string;
  studentName: string;
  testTitle: string;
  totalScore: number;
  maxScore: number;
  passScore?: number | null;
  teacherComment?: string | null;
  reviewUrl?: string | null;
}) {
  const { to, studentName, testTitle, totalScore, maxScore, passScore, teacherComment, reviewUrl } = opts;
  const passed = passScore != null ? totalScore >= passScore : null;
  const passBadge = passed === true
    ? `<span style="display:inline-block;padding:4px 12px;background:#c6f6d5;color:#22543d;border-radius:20px;font-size:13px;font-weight:600;">Đạt</span>`
    : passed === false
    ? `<span style="display:inline-block;padding:4px 12px;background:#fed7d7;color:#742a2a;border-radius:20px;font-size:13px;font-weight:600;">Chưa đạt</span>`
    : "";
  const inner = `
    <tr><td style="padding:36px 40px 20px;">
      <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a1a2e;">Kết quả bài test của bạn</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.6;">
        Xin chào <strong>${studentName}</strong>,<br><br>
        Giáo viên đã chấm xong bài test <strong>${testTitle}</strong> của bạn.
      </p>
      <div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:13px;color:#718096;text-transform:uppercase;letter-spacing:0.05em;">Điểm của bạn</p>
        <p style="margin:8px 0 4px;font-size:36px;font-weight:700;color:#2c5282;">${totalScore} / ${maxScore}</p>
        ${passBadge}
      </div>
      ${teacherComment ? `
        <div style="background:#fffaf0;border-left:4px solid #ed8936;padding:14px 18px;margin:16px 0;border-radius:4px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#7b341e;">Nhận xét của giáo viên</p>
          <p style="margin:0;font-size:14px;color:#4a5568;line-height:1.6;white-space:pre-wrap;">${teacherComment.replace(/</g, "&lt;")}</p>
        </div>
      ` : ""}
      ${reviewUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 28px;background:#378ADD;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Xem lại bài làm của bạn</a>
        </div>
      ` : ""}
    </td></tr>
  `;
  await transporter.sendMail({
    from: `"EduPlatform" <${GMAIL_USER}>`,
    to,
    subject: `Kết quả bài test ${testTitle} của bạn`,
    html: wrapEmail(inner),
  });
}

export { appBaseUrl };

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
