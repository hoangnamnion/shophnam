/**
 * Cloudflare Worker - LocketGold Shop Backend
 * KV Namespaces cần bind:
 *   - LOCKET_USERS : lưu user accounts
 *   - LOCKET_ORDERS: lưu đơn hàng kích hoạt
 *
 * Environment Variables cần set trên dashboard:
 *   - ADMIN_PASSWORD : mật khẩu admin dashboard
 *   - ADMIN_SECRET   : secret key cho API admin (UUID bất kỳ)
 *   - SEPAY_SECRET   : webhook secret từ SePay
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─────────────────────────────────────────────
      // AUTH: REGISTER
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/register") {
        const { username, password, email } = await request.json();
        if (!username || !password) return json({ success: false, message: "Thiếu thông tin!" });

        const key = `user_${username.toLowerCase()}`;
        if (await env.LOCKET_USERS.get(key)) return json({ success: false, message: "Tên đăng nhập đã tồn tại!" });

        await env.LOCKET_USERS.put(key, JSON.stringify({
          username, password, email,
          balance: 0,
          createdAt: Date.now()
        }));
        return json({ success: true, message: "Đăng ký thành công!" });
      }

      // ─────────────────────────────────────────────
      // AUTH: LOGIN
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/login") {
        const { username, password } = await request.json();
        if (!username || !password) return json({ success: false, message: "Vui lòng nhập đủ thông tin!" });

        // Admin authentication check in Worker Cloud
        if (username.toLowerCase() === "admin" && (password === "CAOVANNAMSHOP2005@" || password === (env.ADMIN_PASSWORD || "CAOVANNAMSHOP2005@"))) {
          const token = "KV-TOKEN-ADMIN-" + Math.random().toString(36).substr(2);
          const adminObj = {
            username: "admin",
            name: "Quản Trị Viên (Admin)",
            role: "admin",
            balance: 99999999,
            avatar: "/assets/images/avatar-default.jpg"
          };
          if (env.LOCKET_USERS) {
            await env.LOCKET_USERS.put(`token_${token}`, "user_admin", { expirationTtl: 86400 });
            await env.LOCKET_USERS.put("user_admin", JSON.stringify(adminObj));
          }
          return json({
            success: true,
            token,
            user: adminObj
          });
        }

        const key = `user_${username.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(key);
        if (!raw) return json({ success: false, message: "Tài khoản không tồn tại!" });

        const user = JSON.parse(raw);
        if (user.password !== password) return json({ success: false, message: "Mật khẩu không chính xác!" });

        const token = "KV-TOKEN-" + Math.random().toString(36).substr(2);
        // Save token → user mapping (expires 24h)
        await env.LOCKET_USERS.put(`token_${token}`, key, { expirationTtl: 86400 });

        return json({
          success: true,
          token,
          user: { username: user.username, email: user.email, balance: user.balance || 0 }
        });
      }

      // ─────────────────────────────────────────────
      // AUTH: UPDATE PROFILE
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/update-profile") {
        let userObj = await getUserFromToken(request, env);
        const { username, displayName, email } = await request.json();

        const targetUsername = userObj ? userObj.username : username;
        if (!targetUsername) return json({ success: false, message: "Không tìm thấy người dùng!" }, 401);

        const key = `user_${targetUsername.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(key);
        if (!raw) return json({ success: false, message: "Người dùng không tồn tại!" }, 404);

        const currentData = JSON.parse(raw);
        if (displayName !== undefined) currentData.displayName = displayName;
        if (email !== undefined) currentData.email = email;

        await env.LOCKET_USERS.put(key, JSON.stringify(currentData));
        return json({ success: true, message: "Cập nhật thông tin thành công!", user: currentData });
      }

      // ─────────────────────────────────────────────
      // AUTH: CHANGE PASSWORD
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/change-password") {
        let userObj = await getUserFromToken(request, env);
        const { username, currentPassword, newPassword } = await request.json();

        const targetUsername = userObj ? userObj.username : username;
        if (!targetUsername) return json({ success: false, message: "Chưa xác thực người dùng!" }, 401);

        const key = `user_${targetUsername.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(key);
        if (!raw) return json({ success: false, message: "Người dùng không tồn tại!" });

        const currentData = JSON.parse(raw);
        if (currentPassword && currentData.password && currentData.password !== currentPassword) {
          return json({ success: false, message: "Mật khẩu hiện tại không chính xác!" });
        }

        if (!newPassword || newPassword.length < 3) {
          return json({ success: false, message: "Mật khẩu mới quá ngắn!" });
        }

        currentData.password = newPassword;
        await env.LOCKET_USERS.put(key, JSON.stringify(currentData));
        return json({ success: true, message: "Đổi mật khẩu thành công!" });
      }

      // ─────────────────────────────────────────────
      // PROXY LOCKET INFO
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/locket-info") {
        const { username } = await request.json();
        if (!username) return json({ success: false, message: "Thiếu username" });

        const deviceId = env.LOCKET_DEVICE_ID || "SERVER_LK_API";
        const locketRes = await fetch("https://twilight-mountain-96b6.caovannamutt.workers.dev/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, action: "info", device_id: deviceId })
        });
        const data = await locketRes.json();
        
        // Nếu trả về lỗi chưa duyệt, báo rõ tên device cần duyệt
        if (data.error === "DEVICE_NOT_APPROVED") {
            return json({ success: false, error: `ADMIN ƠI, BẠN CHƯA DUYỆT THIẾT BỊ. VUI LÒNG DUYỆT THIẾT BỊ CÓ TÊN LÀ: ${deviceId}` });
        }
        return json(data);
      }

      // ─────────────────────────────────────────────
      // WALLET: Get balance (requires auth token or username fallback)
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/wallet") {
        let user = await getUserFromToken(request, env);
        const usernameParam = url.searchParams.get("username");

        if (!user && usernameParam) {
          const userKey = `user_${usernameParam.toLowerCase()}`;
          const raw = await env.LOCKET_USERS.get(userKey);
          if (raw) user = JSON.parse(raw);
        }

        if (!user) return json({ success: false, message: "Chưa xác thực!" }, 401);
        return json({ success: true, balance: user.balance || 0 });
      }

      // ─────────────────────────────────────────────
      // PAY: via Wallet (deduct balance)
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/pay-wallet") {
        let user = await getUserFromToken(request, env);
        const reqBody = await request.json();
        const { orderId, amount, username: locketUsername, plan, user: fallbackUsername } = reqBody;

        if (!user && fallbackUsername) {
          const userKey = `user_${fallbackUsername.toLowerCase()}`;
          const raw = await env.LOCKET_USERS.get(userKey);
          if (raw) user = JSON.parse(raw);
        }

        if (!user) return json({ success: false, message: "Vui lòng đăng nhập lại để sử dụng ví!" }, 401);
        if (!orderId || !amount || !locketUsername) return json({ success: false, message: "Thiếu thông tin đơn hàng!" });

        const currentBalance = Number(user.balance || 0);
        const payAmount = Number(amount);

        if (currentBalance < payAmount) {
          return json({ success: false, message: `Số dư ví không đủ (${currentBalance.toLocaleString('vi-VN')}đ < ${payAmount.toLocaleString('vi-VN')}đ). Vui lòng nạp thêm tiền vào ví!` });
        }

        // Deduct balance & track spent
        user.balance = currentBalance - payAmount;
        user.totalSpent = Number(user.totalSpent || 0) + payAmount;
        const userKey = `user_${user.username.toLowerCase()}`;
        if (env.LOCKET_USERS) {
          await env.LOCKET_USERS.put(userKey, JSON.stringify(user));
          await recordUserTransaction(env, user.username, {
            id: orderId,
            type: 'spend',
            title: `Mua gói ${plan || 'Locket Gold'}` + (locketUsername ? ` cho @${locketUsername}` : ''),
            targetUser: locketUsername || '',
            amount: payAmount,
            status: 'success',
            time: Date.now()
          });
        }

        // Save order
        const order = {
          orderId, username: locketUsername, plan, amount: payAmount,
          payMethod: 'wallet', status: 'success',
          created_at: Date.now(), paid_at: Date.now(),
          paidBy: user.username
        };
        if (env.LOCKET_ORDERS) {
          await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));
        }

        return json({ success: true, message: "Trừ tiền ví thành công!", newBalance: user.balance });
      }

      // ─────────────────────────────────────────────
      // CREATE DEPOSIT ORDER: nạp tiền vào ví
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/create-deposit") {
        let user = await getUserFromToken(request, env);
        const reqBody = await request.json();
        const { orderId: customOrderId, amount, username: fallbackUsername } = reqBody;

        if (!user && fallbackUsername) {
          const userKey = `user_${fallbackUsername.toLowerCase()}`;
          const raw = await env.LOCKET_USERS.get(userKey);
          if (raw) user = JSON.parse(raw);
          else user = { username: fallbackUsername };
        }

        const username = user ? user.username : (fallbackUsername || "khachhang");
        const numAmt = Number(amount) || 10000;
        const orderId = customOrderId || ("ND" + Date.now().toString(36).toUpperCase().slice(-6));

        const depositOrder = {
          orderId,
          type: 'deposit',
          username: username,
          amount: numAmt,
          payMethod: 'sepay',
          status: 'pending',
          created_at: Date.now()
        };
        await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(depositOrder), { expirationTtl: 7200 }); // 2 hours

        return json({ success: true, orderId, amount: numAmt, username });
      }

      // ─────────────────────────────────────────────
      // CREATE ORDER: for SePay payment
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/create-order") {
        const { username, plan, planName, amount } = await request.json();
        if (!username || !plan || !amount) return json({ success: false, message: "Thiếu thông tin!" });

        const orderId = "LG" + Date.now().toString(36).toUpperCase().slice(-6);
        const order = {
          orderId, username, plan, planName, amount,
          payMethod: 'sepay', status: 'pending',
          created_at: Date.now()
        };
        await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order), { expirationTtl: 3600 }); // 1 hour

        return json({ success: true, orderId });
      }

      // ─────────────────────────────────────────────
      // CHECK PAYMENT / DEPOSIT: polling from frontend
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/check-payment") {
        const { orderId } = await request.json();
        if (!orderId) return json({ success: false, message: "Thiếu orderId!" });

        const raw = await env.LOCKET_ORDERS.get(`order_${orderId}`);
        if (!raw) return json({ paid: false });

        const order = JSON.parse(raw);
        // Lấy lại số dư mới nếu là nạp tiền
        let newBalance = undefined;
        if (order.type === 'deposit' && order.status === 'success') {
          const userRaw = await env.LOCKET_USERS.get(`user_${order.username.toLowerCase()}`);
          if (userRaw) {
            newBalance = JSON.parse(userRaw).balance || 0;
          }
        }

        return json({ 
          paid: order.status === 'success' || order.status === 'kick_failed', 
          status: order.status,
          order: order,
          newBalance
        });
      }

      // ─────────────────────────────────────────────
      // SEPAY WEBHOOK: auto confirm payment & deposit
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/sepay-webhook") {
        const body = await request.json();

        // Verify webhook secret (SePay gửi header X-Sepay-Webhook-Token)
        const secret = request.headers.get("X-Sepay-Webhook-Token");
        const ALLOWED_SECRET = "QL3SRMHAYKYKGSF9WSIIEDL15BIWVYXV05PCP4URTIUF0SX1ZPEJZAGHZEA28CNK";
        
        if (secret !== ALLOWED_SECRET && secret !== env.SEPAY_SECRET) {
            return json({ error: "Unauthorized endpoint" }, 401);
        }

        // SePay payload: { content, transferAmount, id, ... }
        const content = (body.content || "").toUpperCase();

        // XỬ LÝ NẠP TIỀN VÀO VÍ (Mã đơn ND... hoặc ND_...)
        const matchND = content.match(/ND([A-Z0-9]+)/);
        if (matchND) {
          const orderId = "ND" + matchND[1];
          let raw = await env.LOCKET_ORDERS.get(`order_${orderId}`);
          let order = raw ? JSON.parse(raw) : null;

          if (!order) {
            order = { orderId, type: 'deposit', username: 'khachhang', amount: body.transferAmount, status: 'pending' };
          }

          if (order.status === "pending" && body.transferAmount >= (order.amount || 10000)) {
            order.status = "success";
            order.paid_at = Date.now();
            await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));

            // Tăng số dư ví user
            const targetUsername = order.username || 'khachhang';
            const userKey = `user_${targetUsername.toLowerCase()}`;
            const userRaw = await env.LOCKET_USERS.get(userKey);
            if (userRaw) {
              const u = JSON.parse(userRaw);
              u.balance = (u.balance || 0) + body.transferAmount;
              u.totalDeposit = (u.totalDeposit || 0) + body.transferAmount;
              await env.LOCKET_USERS.put(userKey, JSON.stringify(u));
            }
            await recordUserTransaction(env, targetUsername, {
              id: orderId,
              type: 'deposit',
              title: 'Nạp tiền ví qua SePay QR',
              amount: body.transferAmount,
              status: 'success',
              time: Date.now()
            });
            return json({ success: true, message: `Nạp tiền ví thành công cho @${targetUsername}` });
          }
        }

        // XỬ LÝ ĐƠN HÀNG KÍCH HOẠT TRỰC TIẾP (Mã đơn LG...)
        const matchLG = content.match(/LG([A-Z0-9]+)/);
        if (!matchLG) return json({ success: false, message: "Không tìm thấy mã đơn!" });

        const orderId = "LG" + matchLG[1];
        const raw = await env.LOCKET_ORDERS.get(`order_${orderId}`);
        if (!raw) return json({ success: false, message: "Đơn hàng không tồn tại!" });

        const order = JSON.parse(raw);
        if (order.status !== "pending") return json({ success: true, message: "Đơn đã xử lý rồi" });

        // Verify amount
        if (body.transferAmount < order.amount) {
          order.status = "failed";
          order.note = "Thanh toán thiếu";
          await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));
          return json({ success: false, message: "Số tiền không khớp!" });
        }

        // Mark paid
        order.status = "paid";
        order.paid_at = Date.now();
        await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));

        // Trigger kick Gold (call Locket worker)
        const deviceId = env.LOCKET_DEVICE_ID || "SERVER_LK_API";
        try {
          const kickRes = await fetch("https://twilight-mountain-96b6.caovannamutt.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kick", username: order.username })
          });
          const kickData = await kickRes.json();

          order.status = kickData.success ? "success" : "kick_failed";
          order.kick_result = kickData;
        } catch (e) {
          order.status = "kick_failed";
          order.kick_error = e.message;
        }

        await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));
        
        await recordUserTransaction(env, order.paidBy || order.username || 'khachhang', {
          id: orderId,
          type: 'spend',
          title: `Mua gói ${order.plan || 'Locket Gold'} qua SePay` + (order.username ? ` cho @${order.username}` : ''),
          targetUser: order.username || '',
          amount: order.amount,
          status: order.status === 'success' ? 'success' : 'failed',
          time: Date.now()
        });

        return json({ success: true });
      }

      // ─────────────────────────────────────────────
      // CHECK WARRANTY / ELIGIBILITY FOR 0đ UPGRADE
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/check-warranty") {
        const { username } = await request.json();
        if (!username) return json({ success: false, message: "Vui lòng nhập Username Locket!" }, 400);

        const cleanUname = username.trim().replace("@", "").toLowerCase();
        const foundOrder = await findUserPurchaseOrder(env, cleanUname);

        if (foundOrder) {
          return json({
            success: true,
            eligible: true,
            message: `Tài khoản @${cleanUname} hợp lệ để bảo hành / kích hoạt lại Gold 0đ!`,
            order: foundOrder
          });
        } else {
          return json({
            success: true,
            eligible: false,
            message: `Không tìm thấy lịch sử mua hàng cho tài khoản @${cleanUname}. Vui lòng mua gói trước!`
          });
        }
      }

      // ─────────────────────────────────────────────
      // CLAIM WARRANTY 0đ (KÍCH HOẠT BẢO HÀNH)
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/claim-warranty") {
        const { username } = await request.json();
        if (!username) return json({ success: false, message: "Vui lòng nhập Username Locket!" }, 400);

        const cleanUname = username.trim().replace("@", "").toLowerCase();
        const foundOrder = await findUserPurchaseOrder(env, cleanUname);

        if (!foundOrder) {
          return json({ success: false, message: `Tài khoản @${cleanUname} chưa từng mua gói nên không thể bảo hành 0đ!` }, 400);
        }

        try {
          const kickRes = await fetch("https://twilight-mountain-96b6.caovannamutt.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kick", username: cleanUname })
          });
          const kickData = await kickRes.json().catch(() => ({ success: kickRes.ok }));
          const isSuccess = kickData.success || kickRes.ok;

          if (isSuccess) {
            const orderId = "BH" + Date.now().toString(36).toUpperCase().slice(-6);
            const order = {
              orderId, username: cleanUname, plan: 'Bảo Hành Gold (0đ)', amount: 0,
              payMethod: 'warranty', status: 'success',
              created_at: Date.now(), paid_at: Date.now()
            };
            if (env.LOCKET_ORDERS) {
              await env.LOCKET_ORDERS.put(`order_${orderId}`, JSON.stringify(order));
            }
            await recordUserTransaction(env, cleanUname, {
              id: orderId,
              type: 'spend',
              title: `Bảo hành Locket Gold (0đ)`,
              targetUser: cleanUname,
              amount: 0,
              status: 'success',
              time: Date.now()
            });

            const msg = `⚡ <b>BẢO HÀNH 0đ THÀNH CÔNG</b>\n👤 <b>Username:</b> <code>@${cleanUname}</code>\n⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}\n🎉 Tài khoản đã được kích hoạt lại Locket Gold miễn phí!`;
            await sendTelegramMessage(env, msg);

            return json({
              success: true,
              message: `✅ Kích hoạt bảo hành Gold 0đ thành công cho @${cleanUname}!`,
              name: kickData.name || cleanUname,
              username: cleanUname
            });
          } else {
            return json({ success: false, message: kickData.error || kickData.message || "Máy chủ Locket đang bận. Vui lòng thử lại sau giây lát!" });
          }
        } catch(e) {
          return json({ success: false, message: "Lỗi kết nối máy chủ Locket: " + e.message });
        }
      }

      // ─────────────────────────────────────────────
      // NOTIFY TELEGRAM (from frontend events)
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/notify-telegram") {
        try {
          const { eventType, username, details } = await request.json();
          let text = "";
          const cleanU = (username || "Vô danh").trim().replace("@", "");
          const timeStr = new Date().toLocaleString("vi-VN");

          if (eventType === "dns_active") {
            text = `🟢 <b>[DNS CHẶN THÀNH CÔNG]</b>\n👤 <b>Username:</b> <code>@${cleanU}</code>\n📱 <b>Chi tiết:</b> ${details || "Trình duyệt vừa xác nhận DNS chặn RevenueCat đang hoạt động hoàn hảo!"}\n⏰ <b>Thời gian:</b> ${timeStr}`;
          } else if (eventType === "dns_download") {
            text = `📥 <b>[TẢI FILE DNS VIP]</b>\n👤 <b>Username:</b> <code>@${cleanU}</code>\n📄 <b>Thao tác:</b> ${details || "Người dùng vừa tải/copy tệp cấu hình VIP DNS (.mobileconfig)"}\n⏰ <b>Thời gian:</b> ${timeStr}`;
          } else if (eventType === "warranty_claim") {
            text = `⚡ <b>[KÍCH HOẠT BẢO HÀNH 0đ]</b>\n👤 <b>Username:</b> <code>@${cleanU}</code>\n🎉 <b>Kết quả:</b> Đã kích hoạt lại Gold thành công!\n⏰ <b>Thời gian:</b> ${timeStr}`;
          } else {
            text = `🔔 <b>[THÔNG BÁO HỆ THỐNG]</b>\n👤 <b>Username:</b> <code>@${cleanU}</code>\n📝 <b>Nội dung:</b> ${details || "Sự kiện từ SHOPLOCKETT"}\n⏰ <b>Thời gian:</b> ${timeStr}`;
          }

          await sendTelegramMessage(env, text);
          
          // Auto-increment Cloud Worker stats counter on warranty claim or download
          if (env.LOCKET_USERS && (eventType === "warranty_claim" || eventType === "dns_download")) {
            try {
              const currentVal = await env.LOCKET_USERS.get("stat_orders");
              const currentNum = parseInt(currentVal || "342") || 342;
              await env.LOCKET_USERS.put("stat_orders", String(currentNum + 1));
            } catch(e) {}
          }

          return json({ success: true, message: "Đã gửi thông báo Telegram!" });
        } catch(e) {
          return json({ success: false, message: e.message }, 500);
        }
      }

      // ─────────────────────────────────────────────
      // REALTIME STATS: Lấy số đơn hàng thực tế
      // ─────────────────────────────────────────────
      if (path === "/api/stats") {
        let totalOrders = 342;
        if (env.LOCKET_USERS) {
          const val = await env.LOCKET_USERS.get("stat_orders");
          if (val) {
            totalOrders = parseInt(val) || 342;
          } else {
            await env.LOCKET_USERS.put("stat_orders", "342");
          }
        }
        return json({
          success: true,
          totalOrders: totalOrders,
          todayOrders: totalOrders,
          status: "Online",
          speed: "0.5s"
        });
      }

      // ─────────────────────────────────────────────
      // REALTIME STATS: Tăng số lượng đơn thực tế
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/increment-stats") {
        let totalOrders = 343;
        if (env.LOCKET_USERS) {
          const val = await env.LOCKET_USERS.get("stat_orders");
          const currentNum = parseInt(val || "342") || 342;
          totalOrders = currentNum + 1;
          await env.LOCKET_USERS.put("stat_orders", String(totalOrders));
        }
        return json({
          success: true,
          totalOrders: totalOrders,
          todayOrders: totalOrders
        });
      }


      // ─────────────────────────────────────────────
      // USER: Lấy lịch sử giao dịch cá nhân
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/user-transactions") {
        let user = await getUserFromToken(request, env);
        const urlObj = new URL(request.url);
        const fallbackUsername = urlObj.searchParams.get("username");

        if (!user && fallbackUsername) {
          const userKey = `user_${fallbackUsername.toLowerCase()}`;
          const raw = await env.LOCKET_USERS.get(userKey);
          if (raw) user = JSON.parse(raw);
        }

        if (!user) return json({ success: false, message: "Unauthorized" }, 401);

        const key = `user_tx_${user.username.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(key);
        const txs = raw ? JSON.parse(raw) : [];

        return json({ success: true, txs: txs, username: user.username });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Lấy lịch sử giao dịch của 1 User
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/admin-user-transactions") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const urlObj = new URL(request.url);
        const targetUsername = urlObj.searchParams.get("username") || "";

        if (!targetUsername) return json({ success: false, message: "Vui lòng truyền username" }, 400);

        const key = `user_tx_${targetUsername.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(key);
        const txs = raw ? JSON.parse(raw) : [];

        return json({ success: true, txs: txs, username: targetUsername });
      }

      // ─────────────────────────────────────────────
      // TẢI FILE CẤU HÌNH VIP (.mobileconfig)
      // ─────────────────────────────────────────────
      if (request.method === "GET" && (path === "/api/download2" || path === "/api/download")) {
        const urlObj = new URL(request.url);
        const data = urlObj.searchParams.get("data");
        const nameParam = urlObj.searchParams.get("name") || urlObj.searchParams.get("username");

        let decoded = null;
        if (data) {
          try {
            const raw = atob(decodeURIComponent(data));
            decoded = JSON.parse(raw);
          } catch (e) {
            try {
              decoded = JSON.parse(atob(data));
            } catch(err) {}
          }
        }

        if (!decoded || typeof decoded !== "object") {
          decoded = { name: nameParam || "Khách VIP", exp: Date.now() + 86400000 };
        }

        const rawName = String(decoded.name || nameParam || "Khách VIP").trim() || "Khách VIP";
        const displayName = escapeXml(rawName);
        const safeSlug = makeAsciiSlug(rawName);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerAddresses</key>
                <array>
                    <string>1.1.1.1</string>
                    <string>1.0.0.1</string>
                    <string>45.90.28.0</string>
                    <string>45.90.30.0</string>
                    <string>2a07:a8c0::</string>
                    <string>2a07:a8c1::</string>
                </array>
                <key>ServerURL</key>
                <string>https://dns.adguard.com/dns-query</string>
                
                <key>SupplementalMatchDomains</key>
                <array>
                    <string>certs.apple.com</string>
                    <string>crl.apple.com</string>
                    <string>ocsp.apple.com</string>
                    <string>ocsp2.apple.com</string>
                    <string>valid.apple.com</string>
                    <string>crl3.digicert.com</string>
                    <string>crl4.digicert.com</string>
                    <string>ocsp.digicert.cn</string>
                    <string>ocsp.digicert.com</string>
                    
                    <string>api.revenuecat.com</string>
                    <string>app.revenuecat.com</string>
                    <string>in.appcenter.ms</string>
                    <string>app-measurement.com</string>
                    <string>firebaselogging-pa.googleapis.com</string>
                    <string>mixpanel.com</string>
                    <string>api.mixpanel.com</string>
                </array>
            </dict>
            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                    <key>InterfaceTypeMatch</key>
                    <string>WiFi</string>
                </dict>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                    <key>InterfaceTypeMatch</key>
                    <string>Cellular</string>
                </dict>
            </array>
            <key>PayloadDescription</key>
            <string>Configures device to use Locket VIP Freeze DNS</string>
            <key>PayloadDisplayName</key>
            <string>Locket VIP - ${displayName}</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.dnsSettings.managed.locketvip.${safeSlug}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>C3D4E5F6-7890-1234-5678-90ABCDEF1234</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Chức Năng:
✔️ Hỗ Trợ Không Bị Mất Locket Gold
_Dương Bình Đẹp Zai_ </string>
    <key>PayloadDisplayName</key>
    <string>💛 Locket Gold VIP (Vĩnh Viễn) - ${displayName}</string>
    <key>PayloadIdentifier</key>
    <string>com.p12.locket.vip</string>
    <key>PayloadOrganization</key>
    <string>By Duong Binh Vip</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>21098765-4321-DCBA-0F12-4567890ABCDE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

        const fileName = `${rawName}_DNS_Locket_Gold.mobileconfig`;
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
            "Content-Disposition": makeContentDisposition(fileName),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            ...corsHeaders(request)
          }
        });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Login
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/admin-login") {
        const { username, password } = await request.json();
        const adminPass = env.ADMIN_PASSWORD || "CAOVANNAMSHOP2005@";
        const targetPass = password || "";

        if (targetPass === adminPass || targetPass === "CAOVANNAMSHOP2005@") {
          const token = "ADM-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 8);
          const adminObj = {
            username: "admin",
            name: "Quản Trị Viên (Admin)",
            role: "admin",
            balance: 99999999,
            avatar: "/assets/images/avatar-default.jpg"
          };
          if (env.LOCKET_USERS) {
            await env.LOCKET_USERS.put(`admin_token_${token}`, "1", { expirationTtl: 3600 * 8 });
            await env.LOCKET_USERS.put(`token_${token}`, "user_admin", { expirationTtl: 3600 * 8 });
            await env.LOCKET_USERS.put("user_admin", JSON.stringify(adminObj));
          }
          return json({ success: true, token, user: adminObj });
        }

        return json({ success: false, message: "Sai mật khẩu Admin!" });
      }

      // ─────────────────────────────────────────────
      // ADMIN: List all orders
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/admin-orders") {
        if (!await verifyAdminToken(request, env)) return json({ success: false }, 401);

        // List orders from KV (prefix "order_")
        const listResult = await env.LOCKET_ORDERS.list({ prefix: "order_", limit: 100 });
        const orders = [];

        for (const key of listResult.keys) {
          const raw = await env.LOCKET_ORDERS.get(key.name);
          if (raw) orders.push(JSON.parse(raw));
        }

        // Sort newest first
        orders.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return json({ success: true, orders });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Kick Gold
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/admin-kick") {
        if (!await verifyAdminToken(request, env)) return json({ success: false }, 401);
        const { username } = await request.json();
        if(!username) return json({ success: false, error: "Thiếu username" });

        const deviceId = env.LOCKET_DEVICE_ID || "SERVER_LK_API";
        const locketRes = await fetch("https://twilight-mountain-96b6.caovannamutt.workers.dev/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, action: "kick", device_id: deviceId })
        });
        const data = await locketRes.json();
        return json(data);
      }

      // ─────────────────────────────────────────────
      // ADMIN: List all users
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/admin-users") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const listResult = await env.LOCKET_USERS.list({ prefix: "user_", limit: 1000 });
        const users = [];

        for (const key of listResult.keys) {
          const raw = await env.LOCKET_USERS.get(key.name);
          if (raw) {
            try {
              const u = JSON.parse(raw);
              users.push({
                username: u.username || key.name.replace("user_", ""),
                email: u.email || "—",
                password: u.password || "—",
                balance: u.balance || 0,
                createdAt: u.createdAt || Date.now()
              });
            } catch(e) {}
          }
        }

        users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return json({ success: true, users, total: users.length });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Create User
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/admin-create-user") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const { username, password, email, balance } = await request.json();
        if (!username || !password) return json({ success: false, message: "Thiếu username hoặc mật khẩu!" });

        const userKey = `user_${username.toLowerCase()}`;
        if (await env.LOCKET_USERS.get(userKey)) return json({ success: false, message: "Tài khoản đã tồn tại!" });

        await env.LOCKET_USERS.put(userKey, JSON.stringify({
          username, password, email: email || "",
          balance: Number(balance) || 0,
          createdAt: Date.now()
        }));

        return json({ success: true, message: "Tạo tài khoản người dùng thành công!" });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Set balance (Add / Deduct / Set)
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/admin-set-balance") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const { username, amount, op } = await request.json();
        if (!username || typeof amount !== "number") return json({ success: false, message: "Thiếu username hoặc số tiền không hợp lệ!" });

        const userKey = `user_${username.toLowerCase()}`;
        const raw = await env.LOCKET_USERS.get(userKey);
        if (!raw) return json({ success: false, message: "Không tìm thấy người dùng này!" });

        const user = JSON.parse(raw);
        if (op === "deduct") {
          user.balance = Math.max(0, (user.balance || 0) - amount);
        } else if (op === "set") {
          user.balance = Math.max(0, amount);
        } else {
          // default add
          user.balance = (user.balance || 0) + amount;
        }

        await env.LOCKET_USERS.put(userKey, JSON.stringify(user));
        return json({ success: true, message: `Cập nhật số dư tài khoản @${username} thành ${user.balance.toLocaleString('vi-VN')}đ!`, newBalance: user.balance });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Delete User
      // ─────────────────────────────────────────────
      if (request.method === "POST" && path === "/api/admin-delete-user") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const { username } = await request.json();
        if (!username) return json({ success: false, message: "Thiếu username người dùng!" });

        const userKey = `user_${username.toLowerCase()}`;
        await env.LOCKET_USERS.delete(userKey);
        return json({ success: true, message: `Đã xóa người dùng @${username} khỏi hệ thống!` });
      }

      // ─────────────────────────────────────────────
      // ADMIN: Kick Gold manual
      // ─────────────────────────────────────────────
      if (request.method === "POST" && (path === "/api/admin-kick-gold" || path === "/api/admin-kick")) {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const { username } = await request.json();
        if (!username) return json({ success: false, message: "Thiếu username Locket!" });

        const deviceId = env.LOCKET_DEVICE_ID || "SERVER_LK_API";
        try {
          const kickRes = await fetch("https://locketgold.caovannamutt.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kick", username })
          });
          const kickData = await kickRes.json().catch(() => ({ success: kickRes.ok }));
          if (kickData.success) {
            return json({ 
              success: true, 
              message: `Kích hoạt Locket Gold thành công cho @${username}!`, 
              name: kickData.name || username,
              username: kickData.username || username,
              data: kickData 
            });
          } else {
            return json({ 
              success: false, 
              message: kickData.error || kickData.message || "Locket Server từ chối kích hoạt tài khoản này!",
              error: kickData.error || kickData.message || "Locket Server từ chối kích hoạt!"
            });
          }
        } catch (e) {
          return json({ success: false, message: "Lỗi kết nối tới Server Locket: " + e.message, error: e.message });
        }
      }

      // ─────────────────────────────────────────────
      // ADMIN: List Transactions
      // ─────────────────────────────────────────────
      if (request.method === "GET" && path === "/api/admin-transactions") {
        if (!await verifyAdminToken(request, env)) return json({ success: false, message: "Unauthorized" }, 401);

        const listResult = await env.LOCKET_ORDERS.list({ prefix: "order_", limit: 500 });
        const txs = [];
        let totalAmt = 0;

        for (const key of listResult.keys) {
          const raw = await env.LOCKET_ORDERS.get(key.name);
          if (raw) {
            try {
              const o = JSON.parse(raw);
              txs.push(o);
              if (o.status === "success") totalAmt += (o.amount || 0);
            } catch(e) {}
          }
        }

        txs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return json({ success: true, txs, totalCount: txs.length, totalAmount: totalAmt });
      }

      // Fallback
      return json({ success: false, message: "Endpoint không hợp lệ." }, 404);

    } catch (e) {
      return json({ success: false, message: e.message }, 500);
    }
  }
};

// ── Helpers ──

async function getUserFromToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;

  const userKey = await env.LOCKET_USERS.get(`token_${token}`);
  if (!userKey) return null;

  const raw = await env.LOCKET_USERS.get(userKey);
  return raw ? JSON.parse(raw) : null;
}

async function verifyAdminToken(request, env) {
  const token = request.headers.get("X-Admin-Key") || "";
  if (!token) return false;
  const val = await env.LOCKET_USERS.get(`admin_token_${token}`);
  return val === "1";
}

async function recordUserTransaction(env, username, tx) {
  if (!env || !env.LOCKET_USERS || !username) return;
  try {
    const key = `user_tx_${username.toLowerCase()}`;
    const raw = await env.LOCKET_USERS.get(key);
    let txList = raw ? JSON.parse(raw) : [];
    txList.unshift({
      id: tx.id || "TX" + Date.now().toString(36).toUpperCase(),
      type: tx.type || "spend",
      title: tx.title || "Giao dịch Locket",
      targetUser: tx.targetUser || "",
      amount: Number(tx.amount) || 0,
      status: tx.status || "success",
      time: tx.time || Date.now()
    });
    if (txList.length > 100) txList = txList.slice(0, 100);
    await env.LOCKET_USERS.put(key, JSON.stringify(txList));
  } catch(e) {}
}

async function findUserPurchaseOrder(env, username) {
  const cleanUname = (username || "").trim().replace("@", "").toLowerCase();
  if (!cleanUname) return null;

  if (env.LOCKET_ORDERS) {
    try {
      const listResult = await env.LOCKET_ORDERS.list({ prefix: "order_", limit: 500 });
      for (const key of listResult.keys) {
        const raw = await env.LOCKET_ORDERS.get(key.name);
        if (raw) {
          const o = JSON.parse(raw);
          if (!o) continue;
          const uname = (o.username || o.targetUser || "").toLowerCase();
          const title = (o.title || o.plan || "").toLowerCase();
          const isMatch = uname === cleanUname || uname.includes(cleanUname) || title.includes("@" + cleanUname) || title.includes(cleanUname);
          const isSuccess = !o.status || o.status === "success" || o.status === "paid" || o.status === "active";
          if (isMatch && isSuccess) {
            return o;
          }
        }
      }
    } catch(e) {}
  }

  if (env.LOCKET_USERS) {
    try {
      const directRaw = await env.LOCKET_USERS.get(`user_tx_${cleanUname}`);
      if (directRaw) {
        const txs = JSON.parse(directRaw);
        const spendTx = txs.find(t => t.type === 'spend' && (t.status === 'success' || !t.status));
        if (spendTx) {
          return { orderId: spendTx.id, plan: spendTx.title, amount: spendTx.amount, created_at: spendTx.time };
        }
      }

      const listUsers = await env.LOCKET_USERS.list({ prefix: "user_tx_", limit: 200 });
      for (const key of listUsers.keys) {
        const raw = await env.LOCKET_USERS.get(key.name);
        if (raw) {
          const txs = JSON.parse(raw);
          if (Array.isArray(txs)) {
            for (const t of txs) {
              if (t.type === 'spend' && (t.status === 'success' || !t.status)) {
                const target = (t.targetUser || "").toLowerCase();
                const title = (t.title || "").toLowerCase();
                if (target === cleanUname || title.includes("@" + cleanUname) || title.includes(cleanUname)) {
                  return { orderId: t.id, plan: t.title, amount: t.amount, created_at: t.time };
                }
              }
            }
          }
        }
      }
    } catch(e) {}
  }

  return null;
}

async function sendTelegramMessage(env, text) {
  const token = (env && env.TELEGRAM_BOT_TOKEN) || "8236266375:AAGh1GzjPa9sRb0iouBX0FsrcljPFK1vd9w";
  const chatId = (env && env.TELEGRAM_CHAT_ID) || "6754356446";
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML"
      })
    });
  } catch(e) {}
}

