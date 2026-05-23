// tiennap.js - Cloudflare Worker: Xử lý nạp tiền qua SePay
// Deploy tại: https://shy-mode-c579.caovannamutt.workers.dev

const SEPAY_API_KEY  = "YOUR_SEPAY_API_KEY"; // Thay bằng API key SePay thật (lấy tại my.sepay.vn)
const SEPAY_ACCOUNT  = "338935";              // Số tài khoản MB Bank
const BANK_NAME      = "MB Bank";
const ACCOUNT_NAME   = "CAO VAN NAM";
const TKMKSHOP_URL   = "https://tkmkshop.caovannamutt.workers.dev"; // URL của tkmkshop.js
const INTERNAL_KEY   = "mkshop_internal_2025";
const JWT_SECRET     = "mkshop_secret_jwt_2025"; 

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Internal-Key",
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getAuthToken(request) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.substring(7);
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateTransferCode(username) {
  const suffix = username.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  return `MKSHOP${suffix}`;
}

// Hàm lấy KV namespace an toàn (hỗ trợ cả TIENNAP_KV, MKSHOP_KV và ORDERS)
function getKV(env) {
  return env.TIENNAP_KV || env.MKSHOP_KV || env.MKSHOP || env.ORDERS;
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

      // GET /public-transactions - Hiển thị lịch sử nạp ẩn danh cho trang chủ
      if (path === "/public-transactions" && request.method === "GET") {
        return await handlePublicTransactions(request, env);
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
  const kv = getKV(env);
  if (!kv) return jsonRes({ error: "Server error: KV namespace is not bound" }, 500);

  // Lưu mapping code → username để webhook tìm được user sau
  await kv.put(`code:${transferCode}`, payload.username, { expirationTtl: 86400 * 90 });

  // Tạo QR VietQR (MB Bank) - Chỉ lấy mã QR duy nhất không kèm viền/thông tin ngoài
  const qrUrl = `https://img.vietqr.io/image/MB-${SEPAY_ACCOUNT}-qr_only.jpg?amount=&addInfo=${transferCode}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  return jsonRes({
    success: true,
    bankAccount: SEPAY_ACCOUNT,
    bankName: BANK_NAME,
    accountName: ACCOUNT_NAME,
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
  const kv = getKV(env);
  if (!kv) return jsonRes({ error: "Server error: KV namespace is not bound" }, 500);

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
        const processed = await kv.get(`tx:${txId}`);
        if (!processed) {
          const amount = parseInt(tx.amount_in || tx.amount || 0);
          if (amount > 0) {
            totalNew += amount;
            newTxs.push({ txId, amount, date: tx.transaction_date });
            await kv.put(`tx:${txId}`, JSON.stringify({
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
      const histRaw = await kv.get(histKey);
      const hist = histRaw ? JSON.parse(histRaw) : [];
      for (const tx of newTxs) {
        hist.unshift({ ...tx, username: payload.username });
      }
      if (hist.length > 100) hist.splice(100);
      await kv.put(histKey, JSON.stringify(hist));

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
  try { body = await request.json(); } catch { return new Response("OK", { status: 200 }); }

  // SePay gửi: transferAmount, content/description, referenceCode, id
  const desc   = (body.content || body.description || body.transferDescription || "").toUpperCase();
  const amount = parseInt(body.transferAmount || body.amount || 0);
  const txId   = body.referenceCode || body.id || body.transactionId || Date.now().toString();

  // Chỉ xử lý giao dịch có tiền vào
  if (amount <= 0) return new Response("OK", { status: 200 });

  // Tìm mã MKSHOP trong nội dung chuyển khoản
  const match = desc.match(/MKSHOP([A-Z0-9]{1,6})/);
  if (!match) return new Response("OK", { status: 200 });

  const transferCode = "MKSHOP" + match[1];
  const kv = getKV(env);
  if (!kv) return new Response("OK", { status: 200 });

  // Chống trùng: kiểm tra txId đã xử lý chưa
  const already = await kv.get(`tx:${txId}`);
  if (already) return new Response("OK", { status: 200 });

  // Tìm username từ code mapping
  const username = await kv.get(`code:${transferCode}`);
  if (!username) {
    // Không tìm thấy → lưu pending để xử lý sau
    const pendingKey = `pending:${transferCode}`;
    const pendingRaw = await kv.get(pendingKey);
    const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
    pending.unshift({ txId, amount, date: new Date().toISOString(), transferCode });
    await kv.put(pendingKey, JSON.stringify(pending), { expirationTtl: 86400 * 7 });
    return new Response("OK", { status: 200 });
  }

  // Đánh dấu đã xử lý
  await kv.put(`tx:${txId}`, JSON.stringify({
    username, amount, processed: true, date: new Date().toISOString()
  }));

  // Cộng tiền vào tài khoản ngay lập tức
  await fetch(`${TKMKSHOP_URL}/balance/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
    body: JSON.stringify({ username, amount, txCode: transferCode }),
  });

  // Lưu lịch sử
  const histKey = `history:${username}`;
  const histRaw = await kv.get(histKey);
  const hist = histRaw ? JSON.parse(histRaw) : [];
  hist.unshift({ txId, amount, transferCode, username, date: new Date().toISOString() });
  if (hist.length > 100) hist.splice(100);
  await kv.put(histKey, JSON.stringify(hist));

  return new Response("OK", { status: 200 });
}

async function handleHistory(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const kv = getKV(env);
  if (!kv) return jsonRes({ error: "Server error: KV namespace is not bound" }, 500);

  const histKey = `history:${payload.username}`;
  const histRaw = await kv.get(histKey);
  const history = histRaw ? JSON.parse(histRaw) : [];

  return jsonRes({ success: true, history });
}

async function handleAllTransactions(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  const kv = getKV(env);
  if (!kv) return jsonRes({ error: "Server error: KV namespace is not bound" }, 500);

  // Lấy tất cả keys có prefix "history:"
  const list = await kv.list({ prefix: "history:" });
  const all = [];
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      const txs = JSON.parse(raw);
      all.push(...txs);
    }
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  return jsonRes({ success: true, transactions: all, total: all.length });
}

async function handlePublicTransactions(request, env) {
  const kv = getKV(env);
  if (!kv) return jsonRes({ error: "Server error: KV namespace is not bound" }, 500);

  const list = await kv.list({ prefix: "history:" });
  const all = [];
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      const txs = JSON.parse(raw);
      all.push(...txs);
    }
  }

  // Sắp xếp giảm dần theo thời gian nạp gần nhất
  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Lấy tối đa 10 giao dịch gần nhất
  const recent = all.slice(0, 10).map(t => {
    let masked = "Khách Hàng";
    if (t.username) {
      const u = t.username;
      if (u.length <= 2) {
        masked = u + "***";
      } else {
        masked = u.substring(0, 2) + "***" + u.substring(u.length - 2);
      }
    }
    
    const diffMs = Date.now() - new Date(t.date).getTime();
    let timeStr = "Vừa xong";
    if (diffMs > 0) {
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60000);
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) {
        timeStr = `${diffDays} ngày trước`;
      } else if (diffHours > 0) {
        timeStr = `${diffHours} giờ trước`;
      } else if (diffMins > 0) {
        timeStr = `${diffMins} phút trước`;
      }
    }

    return {
      username: masked,
      amount: t.amount,
      time: timeStr
    };
  });

  // Nếu chưa có giao dịch thật nào, tự động dùng danh sách gốc siêu uy tín làm nền tảng
  if (recent.length === 0) {
    recent.push(
      { username: "Ng***ng", amount: 149000, time: "8 giờ trước" },
      { username: "tr***23", amount: 99000, time: "9 giờ trước" },
      { username: "NT***k5", amount: 109000, time: "9 giờ trước" },
      { username: "Ng***12", amount: 99000, time: "9 giờ trước" },
      { username: "Hu***ga", amount: 109000, time: "12 giờ trước" },
      { username: "Du***an", amount: 109000, time: "12 giờ trước" },
      { username: "Ch***hi", amount: 149000, time: "13 giờ trước" }
    );
  }

  return jsonRes({ success: true, transactions: recent });
}
