// tkmkshop.js - Cloudflare Worker: Quản lý tài khoản người dùng
// Deploy tại: https://tkmkshop.your-subdomain.workers.dev

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin@mkshop2025"; // Đổi mật khẩu này!
const JWT_SECRET = "mkshop_secret_jwt_2025"; // Đổi secret này!

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// =================== HELPERS ===================

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createToken(payload) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now() }));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${header}.${body}.${sigB64}`;
}

async function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function getAuthToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.replace("Bearer ", "").trim();
}

// =================== MAIN HANDLER ===================

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /register
      if (path === "/register" && request.method === "POST") {
        return await handleRegister(request, env);
      }
      // GET /stats
      if (path === "/stats" && request.method === "GET") {
        return await handlePublicStats(request, env);
      }
      // POST /login
      if (path === "/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }
      // GET /profile
      if (path === "/profile" && request.method === "GET") {
        return await handleProfile(request, env);
      }
      // PUT /profile
      if (path === "/profile" && request.method === "PUT") {
        return await handleUpdateProfile(request, env);
      }
      // POST /balance/add (nội bộ từ tiennap.js)
      if (path === "/balance/add" && request.method === "POST") {
        return await handleAddBalance(request, env);
      }
      // POST /balance/deduct
      if (path === "/balance/deduct" && request.method === "POST") {
        return await handleDeductBalance(request, env);
      }
      // GET /users (admin only)
      if (path === "/users" && request.method === "GET") {
        return await handleGetUsers(request, env);
      }
      // GET /users/:username (admin only)
      if (path.startsWith("/users/") && request.method === "GET") {
        return await handleGetUser(request, env, path);
      }
      // PUT /users/:username/balance (admin only)
      if (path.startsWith("/users/") && path.endsWith("/balance") && request.method === "PUT") {
        return await handleAdminSetBalance(request, env, path);
      }
      // DELETE /users/:username (admin only)
      if (path.startsWith("/users/") && request.method === "DELETE") {
        return await handleDeleteUser(request, env, path);
      }

      return jsonRes({ error: "Not found" }, 404);
    } catch (err) {
      return jsonRes({ error: "Server error: " + err.message }, 500);
    }
  },
};

// =================== HANDLERS ===================

async function handleRegister(request, env) {
  const body = await request.json();
  const { username, password, email, fullname } = body;

  if (!username || !password) {
    return jsonRes({ error: "Thiếu username hoặc password" }, 400);
  }
  if (username.length < 3 || username.length > 20) {
    return jsonRes({ error: "Username phải từ 3-20 ký tự" }, 400);
  }
  if (password.length < 6) {
    return jsonRes({ error: "Password phải ít nhất 6 ký tự" }, 400);
  }
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return jsonRes({ error: "Username chỉ được chứa chữ cái không dấu, số và dấu gạch dưới" }, 400);
  }

  // Check exists
  const existing = await env.MKSHOP_KV.get(`user:${username}`);
  if (existing) {
    return jsonRes({ error: "Username đã tồn tại" }, 409);
  }

  const hashedPw = await hashPassword(password);
  const userData = {
    username,
    password: hashedPw,
    rawPassword: password,
    email: email || "",
    fullname: fullname || username,
    balance: 0,
    role: "user",
    createdAt: new Date().toISOString(),
    orders: [],
    totalDeposit: 0,
    totalSpent: 0,
  };

  await env.MKSHOP_KV.put(`user:${username}`, JSON.stringify(userData));

  // Thêm vào danh sách users
  const userListRaw = await env.MKSHOP_KV.get("userlist");
  const userList = userListRaw ? JSON.parse(userListRaw) : [];
  userList.push(username);
  await env.MKSHOP_KV.put("userlist", JSON.stringify(userList));

  return jsonRes({ success: true, message: "Đăng ký thành công!" });
}

async function handleLogin(request, env) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return jsonRes({ error: "Thiếu thông tin đăng nhập" }, 400);
  }

  // Admin hardcoded
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = await createToken({ username: "admin", role: "admin" });
    return jsonRes({
      success: true,
      token,
      user: {
        username: "admin",
        role: "admin",
        fullname: "Administrator",
        balance: 999999999,
        email: "admin@mkshop.vn",
      },
    });
  }

  const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
  if (!userRaw) {
    return jsonRes({ error: "Tài khoản không tồn tại" }, 404);
  }

  const user = JSON.parse(userRaw);
  const hashedPw = await hashPassword(password);

  if (user.password !== hashedPw) {
    return jsonRes({ error: "Sai mật khẩu" }, 401);
  }

  const token = await createToken({ username: user.username, role: user.role });

  return jsonRes({
    success: true,
    token,
    user: {
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      balance: user.balance,
      role: user.role,
      createdAt: user.createdAt,
      totalDeposit: user.totalDeposit || 0,
      totalSpent: user.totalSpent || 0,
    },
  });
}

async function handleProfile(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  if (payload.role === "admin") {
    return jsonRes({
      username: "admin",
      fullname: "Administrator",
      email: "admin@mkshop.vn",
      balance: 999999999,
      role: "admin",
      totalDeposit: 0,
      totalSpent: 0,
      orders: [],
    });
  }

  const userRaw = await env.MKSHOP_KV.get(`user:${payload.username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);
  const { password, ...safeUser } = user;
  return jsonRes(safeUser);
}

async function handleUpdateProfile(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const { email, fullname, newPassword, currentPassword } = body;

  const userRaw = await env.MKSHOP_KV.get(`user:${payload.username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);

  if (email) user.email = email;
  if (fullname) user.fullname = fullname;

  if (newPassword && currentPassword) {
    const hashedCurrent = await hashPassword(currentPassword);
    if (user.password !== hashedCurrent) {
      return jsonRes({ error: "Mật khẩu hiện tại không đúng" }, 400);
    }
    user.password = await hashPassword(newPassword);
    user.rawPassword = newPassword;
  }

  await env.MKSHOP_KV.put(`user:${payload.username}`, JSON.stringify(user));
  return jsonRes({ success: true, message: "Cập nhật thành công" });
}

async function handleAddBalance(request, env) {
  // Internal call from tiennap.js - cần internal secret
  const internalKey = request.headers.get("X-Internal-Key");
  if (internalKey !== "mkshop_internal_2025") {
    return jsonRes({ error: "Forbidden" }, 403);
  }

  const body = await request.json();
  const { username, amount, txCode } = body;

  const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);
  user.balance = (user.balance || 0) + amount;
  user.totalDeposit = (user.totalDeposit || 0) + amount;

  // Lưu lịch sử nạp
  if (!user.depositHistory) user.depositHistory = [];
  user.depositHistory.unshift({
    amount,
    txCode,
    date: new Date().toISOString(),
  });
  if (user.depositHistory.length > 50) user.depositHistory = user.depositHistory.slice(0, 50);

  await env.MKSHOP_KV.put(`user:${username}`, JSON.stringify(user));
  return jsonRes({ success: true, newBalance: user.balance });
}

async function handleDeductBalance(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload) return jsonRes({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const { amount, description } = body;

  if (payload.role === "admin") {
    return jsonRes({ success: true, newBalance: 999999999 });
  }

  const userRaw = await env.MKSHOP_KV.get(`user:${payload.username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);
  if (user.balance < amount) {
    return jsonRes({ error: "Số dư không đủ" }, 400);
  }

  user.balance -= amount;
  user.totalSpent = (user.totalSpent || 0) + amount;

  if (!user.orders) user.orders = [];
  user.orders.unshift({
    description,
    amount,
    date: new Date().toISOString(),
  });
  if (user.orders.length > 50) user.orders = user.orders.slice(0, 50);

  await env.MKSHOP_KV.put(`user:${payload.username}`, JSON.stringify(user));
  return jsonRes({ success: true, newBalance: user.balance });
}

async function handleGetUsers(request, env) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  const userListRaw = await env.MKSHOP_KV.get("userlist");
  const userList = userListRaw ? JSON.parse(userListRaw) : [];

  const users = [];
  for (const username of userList) {
    const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
    if (userRaw) {
      const u = JSON.parse(userRaw);
      users.push({
        username: u.username,
        fullname: u.fullname,
        email: u.email,
        password: u.rawPassword || u.password || "—",
        balance: u.balance,
        role: u.role,
        createdAt: u.createdAt,
        totalDeposit: u.totalDeposit || 0,
        totalSpent: u.totalSpent || 0,
      });
    }
  }

  return jsonRes({ users, total: users.length });
}

async function handleGetUser(request, env, path) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  const username = decodeURIComponent(path.split("/")[2]);
  const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);
  const { password, ...safeUser } = user;
  safeUser.password = user.rawPassword || user.password || "—";
  return jsonRes(safeUser);
}

async function handleAdminSetBalance(request, env, path) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  const username = decodeURIComponent(path.split("/")[2]);
  const body = await request.json();
  const { amount, operation, balance } = body;

  const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
  if (!userRaw) return jsonRes({ error: "User không tồn tại" }, 404);

  const user = JSON.parse(userRaw);
  const op = operation || "set";
  const val = amount !== undefined ? parseInt(amount) : parseInt(balance) || 0;

  if (op === "add") {
    user.balance = (user.balance || 0) + val;
    user.totalDeposit = (user.totalDeposit || 0) + val;
    if (!user.depositHistory) user.depositHistory = [];
    user.depositHistory.unshift({ amount: val, txCode: "ADMIN_ADD", date: new Date().toISOString() });
    if (user.depositHistory.length > 50) user.depositHistory = user.depositHistory.slice(0, 50);
  } else if (op === "deduct") {
    if (user.balance < val) return jsonRes({ error: "Số dư không đủ để trừ" }, 400);
    user.balance = (user.balance || 0) - val;
    user.totalSpent = (user.totalSpent || 0) + val;
    if (!user.orders) user.orders = [];
    user.orders.unshift({ description: "Admin trừ tiền", amount: val, date: new Date().toISOString() });
    if (user.orders.length > 50) user.orders = user.orders.slice(0, 50);
  } else {
    // set: đặt thẳng số dư
    user.balance = val;
  }

  await env.MKSHOP_KV.put(`user:${username}`, JSON.stringify(user));
  return jsonRes({ success: true, newBalance: user.balance, message: `Đã cập nhật số dư cho ${username}` });
}

async function handleDeleteUser(request, env, path) {
  const token = getAuthToken(request);
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return jsonRes({ error: "Admin only" }, 403);

  const username = decodeURIComponent(path.split("/")[2]);
  await env.MKSHOP_KV.delete(`user:${username}`);

  const userListRaw = await env.MKSHOP_KV.get("userlist");
  const userList = userListRaw ? JSON.parse(userListRaw) : [];
  const newList = userList.filter((u) => u !== username);
  await env.MKSHOP_KV.put("userlist", JSON.stringify(newList));

  return jsonRes({ success: true, message: `Đã xóa user ${username}` });
}

async function handlePublicStats(request, env) {
  const userListRaw = await env.MKSHOP_KV.get("userlist");
  const userList = userListRaw ? JSON.parse(userListRaw) : [];

  let totalSpentCount = 0;
  let totalOrdersCount = 0;

  for (const username of userList) {
    const userRaw = await env.MKSHOP_KV.get(`user:${username}`);
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u.orders && u.orders.length > 0) {
        totalOrdersCount += u.orders.length;
        // Chỉ đếm là tài khoản VIP khi đã mua gói giá trị từ 99,000đ trở lên
        const hasVip = u.orders.some(o => o.amount >= 99000);
        if (hasVip) {
          totalSpentCount++;
        }
      }
    }
  }

  // Lấy dữ liệu thật chính xác từ database không dùng offset ảo
  const membersCount = userList.length;
  const usageCount = totalOrdersCount;
  const vipCount = totalSpentCount;

  return jsonRes({
    success: true,
    members: membersCount,
    usages: usageCount,
    vips: vipCount,
  });
}
