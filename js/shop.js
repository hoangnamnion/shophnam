const SHOP_URL   = 'https://tkmkshop.caovannamutt.workers.dev';
const PAY_URL    = 'https://tiennap.caovannamutt.workers.dev';
const WORKER_URL = 'https://shopbanhang.caovannamutt.workers.dev/'; 

const PLANS = {
  basic:   { name:'Locket Gold — 3 Không', price:50000, key:'basic' },
  android: { name:'Locket Gold Android', price:69000, key:'android' },
  premium: { name:'Locket Gold — 4 Không', price:99000, key:'premium' },
  vip:     { name:'Locket Gold VIP — Video 15s', price:130000, key:'vip' }
};

let currentUser  = null;
let currentToken = null;
let selectedPlan = null;
let deviceId     = '';

// ── DEVICE ID ──
function initDevice() {
  let id = localStorage.getItem('locket_device_id');
  if (id && id.startsWith('dev-') && id.length > 20) { localStorage.removeItem('locket_device_id'); id = null; }
  if (!id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    const arr = crypto.getRandomValues(new Uint8Array(4));
    arr.forEach(b => suffix += chars[b % chars.length]);
    id = 'DEVGOLD_' + suffix;
    localStorage.setItem('locket_device_id', id);
  }
  deviceId = id;
}

// ── SESSION ──
function loadSession() {
  const saved = localStorage.getItem('mkshop_session');
  if (!saved) return;
  try { 
    const s = JSON.parse(saved); 
    currentToken = s.token; 
    currentUser = s.user; 
    renderUserBar(); 
    
    // Auto sync latest profile data
    fetch(SHOP_URL + '/profile', { headers: { Authorization: 'Bearer ' + currentToken } })
      .then(r => r.json())
      .then(d => {
        if (!d.error && currentUser) {
          currentUser.balance = d.balance || 0;
          currentUser.totalDeposit = d.totalDeposit || 0;
          currentUser.totalSpent = d.totalSpent || 0;
          saveSession(currentToken, currentUser);
        }
      }).catch(() => {});
  } catch {}
}
function saveSession(token, user) {
  currentToken = token; currentUser = user;
  localStorage.setItem('mkshop_session', JSON.stringify({ token, user }));
  renderUserBar();
}
function logout() {
  currentToken = null; currentUser = null;
  localStorage.removeItem('mkshop_session');
  document.getElementById('user-bar').style.display  = 'none';
  document.getElementById('guest-bar').style.display = 'flex';
  toast('Đã đăng xuất', 'ok');
}
function renderUserBar() {
  if (!currentUser) return;
  document.getElementById('guest-bar').style.display = 'none';
  document.getElementById('user-bar').style.display  = 'flex';
  document.getElementById('nav-balance').textContent  = '💰 ' + fmt(currentUser.balance || 0);
}
function fmt(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }

// ── OVERLAYS ──
function openAuth(tab) { openOverlay('auth-overlay'); switchTab(tab === 'register' ? 'register' : 'login'); }
function openDeposit() { if (!currentUser) { openAuth(); return; } openOverlay('dep-overlay'); loadPaymentInfo(); }
function openOverlay(id) { document.getElementById(id).classList.add('show'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('show'); }
function closeIfBg(e, id) { if (e.target.id === id) closeOverlay(id); }

// ── TABS ──
function switchTab(t) {
  document.getElementById('form-login').style.display    = t === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = t === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    t === 'login');
  document.getElementById('tab-register').classList.toggle('active', t === 'register');
  clearAlert('auth-alert');
}

// ── LOGIN ──
async function doLogin() {
  const u = document.getElementById('l-user').value.trim();
  const p = document.getElementById('l-pass').value.trim();
  if (!u || !p) { showAlert('auth-alert', 'Vui lòng điền đầy đủ', 'err'); return; }
  setLoading('btn-login', true);
  try {
    const r = await fetch(SHOP_URL + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const d = await r.json();
    if (d.success) {
      saveSession(d.token, d.user);
      closeOverlay('auth-overlay');
      toast('Chào mừng ' + (d.user.fullname || d.user.username) + '!', 'ok');
    } else { showAlert('auth-alert', d.error || 'Sai thông tin đăng nhập', 'err'); }
  } catch { showAlert('auth-alert', 'Lỗi kết nối', 'err'); }
  setLoading('btn-login', false, '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập');
}

// ── REGISTER ──
async function doRegister() {
  const u = document.getElementById('r-user').value.trim();
  const p = document.getElementById('r-pass').value.trim();
  const e = document.getElementById('r-email').value.trim();
  if (!u || !p) { showAlert('auth-alert', 'Vui lòng điền đầy đủ', 'err'); return; }
  setLoading('btn-register', true);
  try {
    const r = await fetch(SHOP_URL + '/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p, email: e })
    });
    const d = await r.json();
    if (d.success) {
      showAlert('auth-alert', 'Đăng ký thành công! Hãy đăng nhập.', 'ok');
      setTimeout(() => switchTab('login'), 1500);
    } else { showAlert('auth-alert', d.error || 'Lỗi đăng ký', 'err'); }
  } catch { showAlert('auth-alert', 'Lỗi kết nối', 'err'); }
  setLoading('btn-register', false, '<i class="fa-solid fa-user-plus"></i> Tạo tài khoản');
}

// ── PAYMENT INFO ──
async function loadPaymentInfo() {
  clearAlert('dep-alert');
  try {
    const r = await fetch(PAY_URL + '/payment-info', { headers: { Authorization: 'Bearer ' + currentToken } });
    const d = await r.json();
    if (d.success) {
      document.getElementById('dep-bank').textContent = d.bankName || 'MB Bank';
      document.getElementById('dep-acc').textContent  = d.bankAccount || '';
      document.getElementById('dep-name').textContent = d.accountName || '';
      document.getElementById('dep-code').textContent = d.transferCode || '';
      document.getElementById('qr-img').src           = d.qrUrl || '';
    } else { showAlert('dep-alert', d.error || 'Không tải được thông tin', 'err'); }
  } catch { showAlert('dep-alert', 'Lỗi kết nối', 'err'); }
}

// ── CHECK PAYMENT ──
async function checkPayment() {
  setLoading('btn-check-pay', true);
  clearAlert('dep-alert');
  try {
    const r = await fetch(PAY_URL + '/check-payment', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + currentToken, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const d = await r.json();
    if (d.found) {
      toast('Nạp thành công ' + fmt(d.totalAdded) + '!', 'ok');
      // Dùng số dư server trả về để đảm bảo chính xác
      if (d.newBalance !== undefined) {
        currentUser.balance = d.newBalance;
      } else {
        currentUser.balance = (currentUser.balance || 0) + d.totalAdded;
      }
      saveSession(currentToken, currentUser);
      closeOverlay('dep-overlay');
    } else { showAlert('dep-alert', d.message || d.error || 'Chưa có giao dịch mới', 'err'); }
  } catch { showAlert('dep-alert', 'Lỗi kết nối', 'err'); }
  setLoading('btn-check-pay', false, '<i class="fa-solid fa-rotate"></i> Kiểm tra đã chuyển');
}

// ── BUY PLAN ──
function buyPlan(key) {
  if (!currentUser) { openAuth(); return; }
  selectedPlan = PLANS[key];
  
  let extraWarning = '';
  if (key === 'android') {
    extraWarning = `
      <div style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;color:#b91c1c;font-size:0.8rem;text-align:left">
        <strong><i class="fa-solid fa-triangle-exclamation"></i> LƯU Ý QUAN TRỌNG:</strong><br>
        Với gói Android, sau khi mua xong App sẽ bắt đăng nhập lại. Hãy chắc chắn rằng bạn <strong>NHỚ CHÍNH XÁC</strong> Tài khoản và Mật khẩu Locket của mình trước khi mua!
      </div>
    `;
  }

  document.getElementById('buy-info').innerHTML = `
    <div class="name">${selectedPlan.name}</div>
    <div class="price">${fmt(selectedPlan.price)}</div>
    <div style="font-size:.78rem;color:var(--muted);margin-top:4px">Vĩnh viễn · Bảo hành 1 năm</div>
    ${extraWarning}`;
  document.getElementById('buy-bal-display').textContent = fmt(currentUser.balance || 0);
  clearAlert('buy-alert');
  resetBuyModal();
  openOverlay('buy-overlay');
}

function resetBuyModal() {
  document.getElementById('buy-info').style.display = 'block';
  document.querySelector('.bal-display').style.display = 'flex';
  document.getElementById('locket-user').value = '';
  document.getElementById('step-check').style.display = 'block';
  document.getElementById('step-kick').style.display  = 'none';
  document.getElementById('kick-result-area').innerHTML = '';
  document.getElementById('kick-result-area').style.display = 'none';
  document.getElementById('btn-check-locket').disabled = false;
  document.getElementById('btn-check-locket').innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Kiểm tra tài khoản';
  clearAlert('buy-alert');
}

function autoExtractUser(el) {
  const val = el.value.trim();
  if (!val.includes('locket.cam/')) return;
  try {
    const url  = new URL(val.startsWith('http') ? val : 'https://' + val);
    let   path = url.pathname.replace('/', '').replace('@', '');
    if (path && !path.startsWith('invite')) { el.value = path; return; }
  } catch {}
  const m = val.match(/locket\.cam\/(@?[a-zA-Z0-9_.-]+)/);
  if (m && m[1] && !m[1].replace('@','').startsWith('invite')) el.value = m[1].replace('@','');
}

// ── PROFILE ──
async function openProfile() {
  if (!currentUser) return;
  openOverlay('profile-overlay');
  switchProfTab('orders');
  document.getElementById('profile-loading').style.display = 'block';
  document.getElementById('profile-content').style.display = 'none';

  try {
    const r = await fetch(SHOP_URL + '/profile', { headers: { Authorization: 'Bearer ' + currentToken } });
    const d = await r.json();
    if (!d.error) {
      document.getElementById('prof-fullname').textContent = d.fullname || d.username;
      document.getElementById('prof-username').textContent = d.username;
      document.getElementById('prof-bal').textContent   = fmt(d.balance || 0);
      document.getElementById('prof-dep').textContent   = fmt(d.totalDeposit || 0);
      document.getElementById('prof-spent').textContent = fmt(d.totalSpent || 0);

      if (currentUser) {
        currentUser.balance = d.balance || 0;
        currentUser.totalDeposit = d.totalDeposit || 0;
        currentUser.totalSpent = d.totalSpent || 0;
        saveSession(currentToken, currentUser);
      }

      const ordersHtml = (d.orders || []).map(o => `
        <div class="history-item">
          <div class="hi-info">
            <div class="hi-desc">${o.description || 'Giao dịch'}</div>
            <div class="hi-date">${new Date(o.date).toLocaleString('vi-VN')}</div>
          </div>
          <div class="hi-amount" style="color:#ef4444">- ${fmt(o.amount)}</div>
        </div>
      `).join('') || '<div style="text-align:center;color:var(--muted);font-size:.8rem;padding:10px">Chưa có giao dịch mua nào.</div>';
      document.getElementById('prof-orders-list').innerHTML = ordersHtml;

      const depsHtml = (d.depositHistory || []).map(dp => `
        <div class="history-item">
          <div class="hi-info">
            <div class="hi-desc">${dp.txCode || 'Nạp tiền'}</div>
            <div class="hi-date">${new Date(dp.date).toLocaleString('vi-VN')}</div>
          </div>
          <div class="hi-amount" style="color:#16a34a">+ ${fmt(dp.amount)}</div>
        </div>
      `).join('') || '<div style="text-align:center;color:var(--muted);font-size:.8rem;padding:10px">Chưa có giao dịch nạp nào.</div>';
      document.getElementById('prof-deposits-list').innerHTML = depsHtml;
    }
  } catch (e) {
    console.error(e);
  }

  document.getElementById('profile-loading').style.display = 'none';
  document.getElementById('profile-content').style.display = 'block';
}

function switchProfTab(tab) {
  document.getElementById('prof-orders-view').style.display   = tab === 'orders' ? 'block' : 'none';
  document.getElementById('prof-deposits-view').style.display = tab === 'deposits' ? 'block' : 'none';
  document.getElementById('tab-prof-orders').classList.toggle('active', tab === 'orders');
  document.getElementById('tab-prof-deposits').classList.toggle('active', tab === 'deposits');
}

// ── BƯỚC 1: CHECK tài khoản Locket ──
async function checkLocket() {
  const locketUser = document.getElementById('locket-user').value.trim();
  if (!locketUser) { showAlert('buy-alert', 'Vui lòng nhập username Locket', 'err'); return; }

  setLoading('btn-check-locket', true);
  clearAlert('buy-alert');

  try {
    const res  = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: locketUser, action: 'check', device_id: deviceId })
    });
    const data = await res.json();

    if (data.success) {
      const name   = data.name   || locketUser;
      const uname  = data.username || locketUser;
      const avatar = data.avatar  || '';

      document.getElementById('preview-name').textContent  = name;
      document.getElementById('preview-uname').textContent = uname;
      const avatarEl = document.getElementById('preview-avatar');
      if (avatar) { avatarEl.src = avatar; avatarEl.style.display = 'block'; }
      else { avatarEl.style.display = 'none'; }

      document.getElementById('step-check').style.display = 'none';
      document.getElementById('step-kick').style.display  = 'block';
      clearAlert('buy-alert');
    } else {
      showAlert('buy-alert', data.error || 'Không tìm thấy tài khoản Locket', 'err');
      setLoading('btn-check-locket', false, '<i class="fa-solid fa-magnifying-glass"></i> Kiểm tra tài khoản');
    }
  } catch(e) {
    showAlert('buy-alert', 'Lỗi kết nối: ' + e.message, 'err');
    setLoading('btn-check-locket', false, '<i class="fa-solid fa-magnifying-glass"></i> Kiểm tra tài khoản');
  }
}

// ── BƯỚC 2: KICK GOLD sau khi đã check ──
async function kickGoldNow() {
  if (!selectedPlan || !currentUser) return;
  const locketUser = document.getElementById('preview-uname').textContent.trim();
  if (!locketUser) return;

  const bal = currentUser.balance || 0;
  if (currentUser.role !== 'admin' && bal < selectedPlan.price) {
    showAlert('buy-alert', 'Số dư không đủ. Cần nạp thêm ' + fmt(selectedPlan.price - bal), 'err');
    return;
  }

  setLoading('btn-kick-gold', true);
  clearAlert('buy-alert');

  // Trừ số dư
  try {
    const r = await fetch(SHOP_URL + '/balance/deduct', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + currentToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: selectedPlan.price, description: selectedPlan.name + ' for @' + locketUser })
    });
    const d = await r.json();
    if (!d.success) {
      showAlert('buy-alert', d.error || 'Thanh toán thất bại', 'err');
      setLoading('btn-kick-gold', false, '<i class="fa-solid fa-bolt"></i> Thanh toán &amp; Kick Gold Ngay');
      return;
    }
    currentUser.balance = d.newBalance;
    saveSession(currentToken, currentUser);
  } catch {
    showAlert('buy-alert', 'Lỗi kết nối khi thanh toán', 'err');
    setLoading('btn-kick-gold', false, '<i class="fa-solid fa-bolt"></i> Thanh toán &amp; Kick Gold Ngay');
    return;
  }

  // Kick Gold
  showAlert('buy-alert', '⚡ Đang kick Gold cho @' + locketUser + '...', 'ok');
  try {
    const res  = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: locketUser, device_id: deviceId })
    });
    const data = await res.json();
    const area = document.getElementById('kick-result-area');
    area.style.display = 'block';

    if (data.success) {
      const name   = data.name    || locketUser;
      const uname  = data.username || locketUser;
      const avatar = data.avatar || document.getElementById('preview-avatar').src;
      
      document.getElementById('buy-info').style.display = 'none';
      document.querySelector('.bal-display').style.display = 'none';
      document.getElementById('step-kick').style.display = 'none';
      
      area.innerHTML = `
        <div style="background:#22c55e14;border:1px solid #22c55e33;border-radius:16px;padding:30px 20px;text-align:center">
          <div style="font-size:3.5rem;margin-bottom:10px;line-height:1">🎉</div>
          <div style="color:#16a34a;font-weight:900;font-size:1.3rem;margin-bottom:6px">Thanh Toán & Kick Gold Thành Công!</div>
          <div style="color:var(--muted);font-size:.9rem;margin-bottom:20px">Gói <strong>${selectedPlan.name}</strong></div>
          
          ${avatar ? `<img src="${avatar}" style="width:76px;height:76px;border-radius:50%;border:3px solid #10b981;margin:0 auto 10px;object-fit:cover;box-shadow:0 8px 16px rgba(16,185,129,0.2)">` : ''}
          <div style="color:#15803d;font-size:1.15rem;font-weight:800;margin-bottom:2px">${name}</div>
          <div style="color:#16a34a;font-size:.85rem;margin-bottom:16px">@${uname}</div>
          
          <div style="margin-bottom:24px;display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#d97706;padding:8px 20px;border-radius:30px;font-size:.85rem;font-weight:800">
            <i class="fa-solid fa-star"></i> ĐÃ CÓ GOLD VĨNH VIỄN
          </div>
          
          ${(selectedPlan.price === 50000 || selectedPlan.price === 130000 || selectedPlan.price === 99000) ? '<div style="margin-bottom:16px;"><a href="https://zalo.me/0378787154" target="_blank" class="btn btn-ind btn-full btn-lg" style="justify-content:center;font-weight:800;background:linear-gradient(135deg,#3B82F6,#2563EB);margin-bottom:10px;text-decoration:none;color:#fff;"><i class="fa-solid fa-download"></i> Liên hệ Admin nhận Cấu hình</a><a href="https://zalo.me/0378787154" target="_blank" class="btn btn-ind btn-full btn-lg" style="justify-content:center;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#0284c7);text-decoration:none;color:#fff;"><img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" style="width:20px;height:20px;margin-right:8px;filter:brightness(0) invert(1);"> Zalo: 0378787154</a></div>' : ''}

          <button class="btn btn-ind btn-full btn-lg" onclick="closeOverlay('buy-overlay')" style="justify-content:center;font-weight:800;background:linear-gradient(135deg,#10b981,#059669)">
            Hoàn tất
          </button>
        </div>`;
      clearAlert('buy-alert');
    } else {
      // Hoàn tiền tự động
      area.innerHTML = `
        <div style="background:#ef444414;border:1px solid #ef444433;border-radius:16px;padding:16px;text-align:center">
          <div style="color:#f87171;font-weight:800;margin-bottom:4px">❌ Kick Thất Bại</div>
          <div style="color:#f87171;font-size:.82rem">${data.error || 'Không xác định'}</div>
          <div style="color:#94a3b8;font-size:.78rem;margin-top:6px">Tiền đã được hoàn lại vào tài khoản.</div>
        </div>`;
      try {
        await fetch(SHOP_URL + '/balance/add', {
          method: 'POST',
          headers: { 'X-Internal-Key': 'mkshop_internal_2025', 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser.username, amount: selectedPlan.price, txCode: 'REFUND' })
        });
        currentUser.balance = (currentUser.balance || 0) + selectedPlan.price;
        saveSession(currentToken, currentUser);
      } catch {}
      clearAlert('buy-alert');
      setLoading('btn-kick-gold', false, '<i class="fa-solid fa-bolt"></i> Thử lại');
    }
  } catch(e) {
    document.getElementById('kick-result-area').innerHTML = `
      <div style="background:#ef444414;border:1px solid #ef444433;border-radius:14px;padding:14px;text-align:center;color:#f87171;font-size:.83rem">❌ Lỗi kết nối: ${e.message}</div>`;
    setLoading('btn-kick-gold', false, '<i class="fa-solid fa-bolt"></i> Thử lại');
  }
}

// ── HELPERS ──
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3200);
}
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'alert show alert-' + type;
}
function clearAlert(id) { document.getElementById(id).className = 'alert'; }
function setLoading(id, loading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.innerHTML = '<span class="spin"></span> Đang xử lý...';
  else if (label) btn.innerHTML = label;
}
function setBtn(id, show) {
  const btn = document.getElementById(id);
  if (btn) btn.style.display = show ? 'flex' : 'none';
}
function copyText(elId) {
  const val = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(val).then(() => toast('Đã sao chép!', 'ok'));
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('auth-overlay').classList.contains('show')) {
    const isLogin = document.getElementById('form-login').style.display !== 'none';
    if (isLogin) doLogin(); else doRegister();
  }
});

initDevice();
loadSession();

// ── SYSTEM ANNOUNCEMENT ──
function checkAnn() {
  const dismissUntil = localStorage.getItem('sys_ann_dismissed');
  if (dismissUntil) {
    if (Date.now() < parseInt(dismissUntil)) return;
  }
  document.getElementById('sys-ann-overlay').style.display = 'flex';
}
function closeAnn() {
  document.getElementById('sys-ann-overlay').style.display = 'none';
}
function closeAnn24h() {
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem('sys_ann_dismissed', tomorrow.toString());
  document.getElementById('sys-ann-overlay').style.display = 'none';
}
checkAnn();

async function loadPublicStats() {
  try {
    const r = await fetch(SHOP_URL + '/stats');
    const d = await r.json();
    if (d.success) {
      document.getElementById('stat-members').textContent = Number(d.members).toLocaleString('en-US');
      document.getElementById('stat-usages').textContent  = Number(d.usages).toLocaleString('en-US');
      document.getElementById('stat-vips').textContent    = Number(d.vips).toLocaleString('en-US');
    }
  } catch {}
}
loadPublicStats();

async function loadPublicTransactions() {
  try {
    const r = await fetch(PAY_URL + '/public-transactions');
    const d = await r.json();
    if (d.success && d.transactions) {
      const feed = document.getElementById('deposit-history-feed');
      feed.innerHTML = d.transactions.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg);border-radius:12px;padding:10px 14px">
          <div>
            <div style="font-size:.82rem;font-weight:800;color:var(--txt)">${t.username}</div>
            <div style="font-size:.7rem;color:var(--muted)">${t.time}</div>
          </div>
          <div style="font-size:.85rem;font-weight:900;color:#16a34a">+ ${Number(t.amount).toLocaleString('en-US')}đ</div>
        </div>
      `).join('');
    }
  } catch {}
}
loadPublicTransactions();