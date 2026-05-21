// tiennap.js - Cloudflare Worker: Xử lý nạp tiền qua SePay
// Deploy tại: https://tiennap.your-subdomain.workers.dev

const SEPAY_API_KEY = "YOUR_SEPAY_API_KEY"; // Thay bằng API key SePay thật
const SEPAY_ACCOUNT = "YOUR_BANK_ACCOUNT"; // Số tài khoản ngân hàng
const TKMKSHOP_URL = "https://tkmkshop.caovannamutt.workers.dev/"; // URL của tkmkshop.js
const INTERNAL_KEY = "mkshop_internal_2025";
const JWT_SECRET = "mkshop_secret_jwt_2025"; // Phải giống tkmkshop.js

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

async function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

function getAuthToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.replace("Bearer ", "").trim();
}

// Tạo mã chuyển khoản theo username
function generateTransferCode(username) {
  const suffix = username.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  return `MKSHOP${suffix}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /payment-info - Lấy thông tin thanh toán (QR, STK, nội dung CK)
      if (path === "/payment-info" && request.method === "GET") {
        return await handlePaymentInfo(request, env);
      }

      // POST /check-payment - Check thủ công giao dịch
      if (path === "/check-payment" && request.method === "POST") {
        return await handleCheckPayment(request, env);
      }

      // POST /webhook - SePay webhook tự động gọi khi có tiền vào
      if (path === "/webhook" && request.method === "POST") {
        return await handleWebhook(request, env);
      }

      // GET /history - Lịch sử nạp tiền của user
      if (path === "/history" && request.method === "GET") {
        return await handleHistory(request, env);
      }

      // GET /transactions - Admin: xem tất cả giao dịch
      if (path === "/transactions" && request.method === "GET") {
        return await handleAllTransactions(request, env);
      }

      return jsonRes({ error: "Not found" }, 404);
    } catch (err) {
      return jsonRes({ error: "Server error: " + err.message }, 500);
    }
  },
};

// =================== HANDLERS ===================

async function handlePaymentInfo(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const transferCode = generateTransferCode(payload.username);

  // Tạo QR SePay
  const qrUrl = `https://qr.sepay.vn/img?acc=${SEPAY_ACCOUNT}&bank=MB&amount=&des=${transferCode}&template=compact`;

  return jsonRes({
    success: true,
    bankAccount: SEPAY_ACCOUNT,
    bankName: "MB Bank",
    accountName: "MKSHOP LOCKET GOLD",
    transferCode,
    qrUrl,
    note: `Nội dung chuyển khoản: ${transferCode}`,
    minAmount: 10000,
  });
}

async function handleCheckPayment(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const transferCode = generateTransferCode(payload.username);

  // Gọi SePay API để kiểm tra giao dịch
  try {
    const sePayRes = await fetch(
      `https://my.sepay.vn/userapi/transactions/list?account_number=${SEPAY_ACCOUNT}&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${SEPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!sePayRes.ok) {
      return jsonRes({ error: "Không thể kết nối SePay" }, 502);
    }

    const sePayData = await sePayRes.json();
    const transactions = sePayData.transactions || sePayData.data || [];

    // Tìm giao dịch chưa xử lý khớp với mã người dùng
    let totalNew = 0;
    const newTxs = [];

    for (const tx of transactions) {
      const desc = (tx.transaction_content || tx.description || "").toUpperCase();
      if (desc.includes(transferCode)) {
        const txId = tx.id || tx.reference_number;
        // Kiểm tra đã xử lý chưa
        const processed = await env.TIENNAP_KV.get(`tx:${txId}`);
        if (!processed) {
          const amount = parseInt(tx.amount_in || tx.amount || 0);
          if (amount > 0) {
            totalNew += amount;
            newTxs.push({ txId, amount, date: tx.transaction_date });
            await env.TIENNAP_KV.put(`tx:${txId}`, JSON.stringify({
              username: payload.username,
              amount,
              processed: true,
              date: new Date().toISOString(),
            }));
          }
        }
      }
    }

    if (totalNew > 0) {
      // Cộng tiền vào tài khoản qua tkmkshop
      await fetch(`${TKMKSHOP_URL}/balance/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": INTERNAL_KEY,
        },
        body: JSON.stringify({
          username: payload.username,
          amount: totalNew,
          txCode: transferCode,
        }),
      });

      // Lưu lịch sử
      const histKey = `history:${payload.username}`;
      const histRaw = await env.TIENNAP_KV.get(histKey);
      const hist = histRaw ? JSON.parse(histRaw) : [];
      for (const tx of newTxs) {
        hist.unshift({ ...tx, username: payload.username });
      }
      if (hist.length > 100) hist.splice(100);
      await env.TIENNAP_KV.put(histKey, JSON.stringify(hist));

      return jsonRes({
        success: true,
        found: true,
        totalAdded: totalNew,
        transactions: newTxs,
        message: `Đã nạp thành công ${totalNew.toLocaleString("vi-VN")}đ vào tài khoản!`,
      });
    }

    return jsonRes({
      success: true,
      found: false,
      message: "Chưa tìm thấy giao dịch mới. Vui lòng chuyển khoản đúng nội dung và thử lại.",
    });
  } catch (err) {
    return jsonRes({ error: "Lỗi kiểm tra: " + err.message }, 500);
  }
}

async function handleWebhook(request, env) {
  // SePay tự động POST khi có giao dịch mới
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const desc = (body.content || body.description || "").toUpperCase();
  const amount = parseInt(body.transferAmount || body.amount || 0);
  const txId = body.referenceCode || body.id || Date.now().toString();

  // Tìm username từ mã chuyển khoản
  // Mã = MKSHOP + 6 ký tự username đầu
  const match = desc.match(/MKSHOP([A-Z0-9]{1,6})/);
  if (!match || amount <= 0) {
    return new Response("OK", { status: 200 });
  }

  const codePrefix = match[1];

  // Tìm user khớp
  const userListRaw = await env.TIENNAP_KV.get("userlist_cache");
  // Nếu không có cache, gọi tkmkshop để lấy danh sách
  // (hoặc lưu mapping riêng)
  // Webhook sẽ lưu pending, user tự check sau
  const pendingKey = `pending:${codePrefix}`;
  const pendingRaw = await env.TIENNAP_KV.get(pendingKey);
  const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
  pending.unshift({ txId, amount, date: new Date().toISOString(), codePrefix });
  await env.TIENNAP_KV.put(pendingKey, JSON.stringify(pending));

  return new Response("OK", { status: 200 });
}

async function handleHistory(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const histKey = `history:${payload.username}`;
  const histRaw = await env.TIENNAP_KV.get(histKey);
  const history = histRaw ? JSON.parse(histRaw) : [];

  return jsonRes({ success: true, history });
}

async function handleAllTransactions(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  // Lấy tất cả keys có prefix "history:"
  const list = await env.TIENNAP_KV.list({ prefix: "history:" });
  const all = [];
  for (const key of list.keys) {
    const raw = await env.TIENNAP_KV.get(key.name);
    if (raw) {
      const txs = JSON.parse(raw);
      all.push(...txs);
    }
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  return jsonRes({ success: true, transactions: all, total: all.length });
}
