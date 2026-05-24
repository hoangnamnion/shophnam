c-bal-display').textContent = fmt(currentUser.balance || 0);
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
cxle="width:20px;height:20px;margin-right:8px;filter:brightness(0) invert(1);"> Zalo: 0378787154</a></div>' : ''}

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
   cx
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
