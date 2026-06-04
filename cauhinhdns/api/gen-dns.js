// ── INTERNAL ENDPOINT: Tạo link DNS Giữ Gold ──
// Chỉ được gọi từ shop.js với X-Internal-Key đúng
// KHÔNG expose endpoint này ra ngoài

const INTERNAL_KEY = 'dns_gen_secret_2025_xK9mN';
const DEFAULT_TTL  = 60; // phút

export default function handler(req, res) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method không hợp lệ' });
  }

  // Xác thực secret key
  const key = req.headers['x-internal-key'];
  if (!key || key !== INTERNAL_KEY) {
    return res.status(403).json({ error: 'Không có quyền truy cập' });
  }

  const { name, ttlMinutes, plan } = req.body || {};

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Thiếu tên người dùng' });
  }

  // Chỉ tạo link cho gói iOS (không phải android)
  if (plan === 'android') {
    return res.status(400).json({ error: 'Gói Android không cần cấu hình DNS' });
  }

  const safeMinutes = Math.max(1, Math.floor(Number(ttlMinutes) || DEFAULT_TTL));

  const payload = {
    name       : cleanName,
    ttlMinutes : safeMinutes,
    exp        : Date.now() + safeMinutes * 60 * 1000,
  };

  const encoded  = Buffer.from(JSON.stringify(payload)).toString('base64');

  // Tự lấy domain từ request — hoạt động đúng trên bất kỳ domain nào được deploy
  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const host    = req.headers['host'];
  const baseUrl = `${proto}://${host}`;
  const link    = `${baseUrl}/download2.html?data=${encodeURIComponent(encoded)}`;

  return res.status(200).json({ success: true, link, expiresIn: safeMinutes });
}
