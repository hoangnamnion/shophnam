const SHOP_URL   = 'https://tkmkshop.caovannamutt.workers.dev';
const PAY_URL    = 'https://shy-mode-c579.caovannamutt.workers.dev';
const WORKER_URL = 'https://shopbanhang.caovannamutt.workers.dev/'; 

const PLANS = {
  basic:   { name:'Locket Gold — 3 Không', price:50000, key:'basic' },
  premium: { name:'Locket Gold — 4 Không', price:99000, key:'premium' }
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
async function loadSession() {
  const saved = localStorage.getItem('mkshop_session');
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    currentToken = s.token;
    currentUser = s.user;
    renderUserBar();

    // Fetch fresh profile from backend to get updated balance immediately
    const r = await fetch(SHOP_URL + '/profile', {
      headers: { 'Authorization': 'Bearer ' + currentToken }
    });
    if (r.ok) {
      const d = await r.json();
      if (d.username) {
        currentUser = d;
        saveSession(currentToken, currentUser);
      }
    }
  } catch(e) {
    console.error("Error reloading session:", e);
  }
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
      currentUser.balance = (currentUser.balance || 0) + d.totalAdded;
      saveSession(currentToken, currentUser);
      closeOverlay('dep-overlay');
    } else { showAlert('dep-alert', d.message || 'Chưa có giao dịch mới', 'err'); }
  } catch { showAlert('dep-alert', 'Lỗi kết nối', 'err'); }
  setLoading('btn-check-pay', false, '<i class="fa-solid fa-rotate"></i> Kiểm tra đã chuyển');
}

// ── BUY PLAN ──
function buyPlan(key) {
  if (!currentUser) { openAuth(); return; }
  selectedPlan = PLANS[key];
  document.getElementById('buy-info').innerHTML = `
    <div class="name">${selectedPlan.name}</div>
    <div class="price">${fmt(selectedPlan.price)}</div>
    <div style="font-size:.78rem;color:var(--muted);margin-top:4px">Vĩnh viễn · Bảo hành 1 năm</div>`;
  document.getElementById('buy-bal-display').textContent = fmt(currentUser.balance || 0);
  clearAlert('buy-alert');
  resetBuyModal();
  openOverlay('buy-overlay');
}

function resetBuyModal() {
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
      area.innerHTML = `
        <div style="background:#22c55e14;border:1px solid #22c55e33;border-radius:16px;padding:20px;text-align:center">
          ${avatar ? `<img src="${avatar}" style="width:70px;height:70px;border-radius:50%;border:3px solid #f59e0b;margin-bottom:10px;object-fit:cover">` : ''}
          <div style="font-size:1.5rem;margin-bottom:6px">🎉</div>
          <div style="color:#4ade80;font-weight:900;font-size:1rem;margin-bottom:4px">Kick Gold Thành Công!</div>
          <div style="color:#4ade80;font-size:.83rem"><strong>${name}</strong> (@${uname}) đã được nâng Gold.</div>
          <div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:#f59e0b18;border:1px solid #f59e0b33;color:#f59e0b;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:700">⭐ ĐÃ CÓ GOLD</div>
        </div>`;
      clearAlert('buy-alert');
      document.getElementById('btn-kick-gold').style.display = 'none';
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
