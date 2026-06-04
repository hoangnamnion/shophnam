// warranty.js - Cloudflare Worker: Bảo hành Locket Gold
// Deploy tại: https://warranty.your-subdomain.workers.dev
// KV Binding cần: WARRANTY_KV
//
// Endpoints:
//   POST /record          — Lưu bảo hành sau khi kick thành công
//   GET  /check           — Kiểm tra bảo hành (có free re-upgrade không)
//   GET  /list            — Admin: xem toàn bộ bảo hành
//   GET  /list/:username  — Admin: xem bảo hành của 1 Locket user cụ thể

// ── Cấu hình ──
const INTERNAL_KEY = "mkshop_internal_2025"; // Phải khớp với tkmkshop.js
const ADMIN_SECRET = "warranty_admin_2025";   // Dùng cho endpoint /list (admin)

// Các gói hợp lệ
const VALID_PLANS = ["basic", "android", "premium", "vip"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Key, X-Admin-Key",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ── MAIN ──
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /record — Lưu bảo hành
      if (path === "/record" && request.method === "POST") {
        return await handleRecord(request, env);
      }

      // GET /check?locket_username=xxx&plan=xxx — Kiểm tra bảo hành
      if (path === "/check" && request.method === "GET") {
        return await handleCheck(request, env, url);
      }

      // GET /list — Toàn bộ bảo hành (admin)
      if (path === "/list" && request.method === "GET") {
        return await handleList(request, env);
      }

      // GET /list/:locket_username — Bảo hành của 1 user cụ thể (admin)
      if (path.startsWith("/list/") && request.method === "GET") {
        const locketUser = decodeURIComponent(path.replace("/list/", "").trim());
        return await handleListOne(request, env, locketUser);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Server error: " + err.message }, 500);
    }
  },
};

// =================== HANDLERS ===================

/**
 * POST /record
 * Body: { locket_username, plan, mkshop_username }
 * Header: X-Internal-Key: mkshop_internal_2025
 *
 * Lưu warranty vào KV:
 *   warranty:{locket_username}:{plan} → { ... meta }
 *   index:{locket_username}           → [ plan1, plan2, ... ]  (để tra nhanh)
 */
async function handleRecord(request, env) {
  // Chỉ worker nội bộ (shop.js) được gọi
  const key = request.headers.get("X-Internal-Key");
  if (key !== INTERNAL_KEY) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const { locket_username, plan, mkshop_username } = body;

  if (!locket_username || !plan) {
    return json({ error: "Thiếu locket_username hoặc plan" }, 400);
  }
  if (!VALID_PLANS.includes(plan)) {
    return json({ error: "Gói không hợp lệ: " + plan }, 400);
  }

  const kv = env.WARRANTY_KV;
  if (!kv) return json({ error: "WARRANTY_KV chưa được bind" }, 500);

  const now       = new Date().toISOString();
  const entryKey  = `warranty:${locket_username.toLowerCase()}:${plan}`;

  // Đọc bản ghi cũ nếu có (để lưu lịch sử)
  const existing = await kv.get(entryKey, "json").catch(() => null);

  const entry = {
    locket_username : locket_username.toLowerCase(),
    plan,
    mkshop_username : mkshop_username || "unknown",
    first_at        : existing?.first_at || now,   // lần đầu nâng cấp
    last_at         : now,                          // lần cuối nâng cấp
    count           : (existing?.count || 0) + 1,  // số lần đã nâng
  };

  // Lưu bảo hành
  await kv.put(entryKey, JSON.stringify(entry));

  // Cập nhật index theo locket_username
  const indexKey = `index:${locket_username.toLowerCase()}`;
  const indexRaw = await kv.get(indexKey);
  const index    = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(plan)) index.push(plan);
  await kv.put(indexKey, JSON.stringify(index));

  // Cập nhật danh sách toàn cầu (để /list admin dùng)
  const globalKey = "global:locket_users";
  const globalRaw = await kv.get(globalKey);
  const global_   = globalRaw ? JSON.parse(globalRaw) : [];
  if (!global_.includes(locket_username.toLowerCase())) {
    global_.push(locket_username.toLowerCase());
    await kv.put(globalKey, JSON.stringify(global_));
  }

  return json({
    success  : true,
    message  : `Đã lưu bảo hành gói ${plan} cho @${locket_username}`,
    entry,
    is_new   : entry.count === 1,
  });
}

/**
 * GET /check?locket_username=xxx&plan=xxx
 * Header: X-Internal-Key: mkshop_internal_2025
 *
 * Trả về: { has_warranty: true/false, entry: {...} }
 */
async function handleCheck(request, env, url) {
  const key = request.headers.get("X-Internal-Key");
  if (key !== INTERNAL_KEY) {
    return json({ error: "Forbidden" }, 403);
  }

  const locket_username = (url.searchParams.get("locket_username") || "").toLowerCase().trim();
  const plan            = (url.searchParams.get("plan") || "").toLowerCase().trim();

  if (!locket_username || !plan) {
    return json({ error: "Thiếu locket_username hoặc plan" }, 400);
  }

  const kv = env.WARRANTY_KV;
  if (!kv) return json({ error: "WARRANTY_KV chưa được bind" }, 500);

  const entryKey = `warranty:${locket_username}:${plan}`;
  const entry    = await kv.get(entryKey, "json").catch(() => null);

  if (entry) {
    return json({
      has_warranty   : true,
      locket_username,
      plan,
      first_at       : entry.first_at,
      last_at        : entry.last_at,
      count          : entry.count,
      mkshop_username: entry.mkshop_username,
      message        : `✅ @${locket_username} có bảo hành gói ${plan} — nâng cấp miễn phí!`,
    });
  }

  return json({
    has_warranty   : false,
    locket_username,
    plan,
    message        : `@${locket_username} chưa có bảo hành gói ${plan}`,
  });
}

/**
 * GET /list
 * Header: X-Admin-Key: warranty_admin_2025
 *
 * Trả về toàn bộ danh sách bảo hành
 */
async function handleList(request, env) {
  const adminKey = request.headers.get("X-Admin-Key");
  if (adminKey !== ADMIN_SECRET) {
    return json({ error: "Admin only" }, 403);
  }

  const kv = env.WARRANTY_KV;
  if (!kv) return json({ error: "WARRANTY_KV chưa được bind" }, 500);

  const globalRaw = await kv.get("global:locket_users");
  const users     = globalRaw ? JSON.parse(globalRaw) : [];

  const result = [];
  for (const luser of users) {
    const indexRaw = await kv.get(`index:${luser}`);
    const plans    = indexRaw ? JSON.parse(indexRaw) : [];
    const entries  = [];
    for (const plan of plans) {
      const entry = await kv.get(`warranty:${luser}:${plan}`, "json").catch(() => null);
      if (entry) entries.push(entry);
    }
    result.push({ locket_username: luser, plans, entries });
  }

  return json({ success: true, total: result.length, data: result });
}

/**
 * GET /list/:locket_username
 * Header: X-Admin-Key: warranty_admin_2025
 */
async function handleListOne(request, env, locketUser) {
  const adminKey = request.headers.get("X-Admin-Key");
  if (adminKey !== ADMIN_SECRET) {
    return json({ error: "Admin only" }, 403);
  }

  const kv = env.WARRANTY_KV;
  if (!kv) return json({ error: "WARRANTY_KV chưa được bind" }, 500);

  const indexRaw = await kv.get(`index:${locketUser.toLowerCase()}`);
  const plans    = indexRaw ? JSON.parse(indexRaw) : [];

  if (!plans.length) {
    return json({ has_warranty: false, locket_username: locketUser, plans: [] });
  }

  const entries = [];
  for (const plan of plans) {
    const entry = await kv.get(`warranty:${locketUser.toLowerCase()}:${plan}`, "json").catch(() => null);
    if (entry) entries.push(entry);
  }

  return json({ success: true, has_warranty: true, locket_username: locketUser, plans, entries });
}
