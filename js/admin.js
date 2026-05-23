const SHOP_URL = 'https://tkmkshop.caovannamutt.workers.dev';
const PAY_URL  = 'https://shy-mode-c579.caovannamutt.workers.dev';

let adminToken = null;
let allUsers   = [];

// ── AUTH ──
function checkAdminAuth() {
  const saved = localStorage.getItem('admin_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.token && s.user?.role === 'admin') {
        adminToken = s.token;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display  = 'flex';
        loadDashboard();
        return;
      }
    } catch {}
  }
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display  = 'none';
}

async function doAdminLogin() {
  const u = document.getElementById('a-user').value.trim();
  const p = document.getElementById('a-pass').value.trim();
  if (!u || !p) { showAlert('login-alert', 'Nhập đầy đủ thông tin', 'err'); return; }
  setBtnLoading('btn-admin-login', true);
  try {
    const r = await fetch(SHOP_URL + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const d = await r.json();
    if (d.success && d.user?.role === 'admin') {
      adminToken = d.token;
      localStorage.setItem('admin_session', JSON.stringify({ token: d.token, user: d.user }));
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').style.display  = 'flex';
      loadDashboard();
    } else if (d.success) {
      showAlert('login-alert', 'Tài khoản này không có quyền admin', 'err');
    } else {
      showAlert('login-alert', d.error || 'Sai thông tin', 'err');
    }
  } catch { showAlert('login-alert', 'Lỗi kết nối', 'err'); }
  setBtnLoading('btn-admin-login', false, '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập');
}

function adminLogout() {
  adminToken = null;
  localStorage.removeItem('admin_session');
  location.reload();
}

// ── NAVIGATION ──
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'users')     loadUsers();
  if (page === 'txs')       loadTransactions();
}

// ── DASHBOARD ──
async function loadDashboard() {
  try {
    const r = await fetch(SHOP_URL + '/users', { headers: { Authorization: 'Bearer ' + adminToken } });
    const d = await r.json();
    if (!d.users) return;
    allUsers = d.users;
    const total = d.total || 0;
    const totalDep = d.users.reduce((s, u) => s + (u.totalDeposit || 0), 0);
    const totalSpent = d.users.reduce((s, u) => s + (u.totalSpent || 0), 0);
    const totalBal = d.users.reduce((s, u) => s + (u.balance || 0), 0);
    document.getElementById('stat-users').textContent  = total;
    document.getElementById('stat-dep').textContent    = fmt(totalDep);
    document.getElementById('stat-spent').textContent  = fmt(totalSpent);
    document.getElementById('stat-bal').textContent    = fmt(totalBal);
    renderUserTable(allUsers.slice(0, 5), 'recent-users-table');
  } catch {}
}

// ── USERS ──
async function loadUsers() {
  const tbody = document.getElementById('users-table');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const r = await fetch(SHOP_URL + '/users', { headers: { Authorization: 'Bearer ' + adminToken } });
    const d = await r.json();
    if (!d.users) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Lỗi tải dữ liệu</td></tr>'; return; }
    allUsers = d.users;
    renderUserTable(allUsers, 'users-table');
  } catch { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Lỗi kết nối</td></tr>'; }
}

function renderUserTable(users, tableId) {
  const tbody = document.getElementById(tableId);
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-users-slash"></i>Chưa có người dùng</div></td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role==='admin'?'👑 Admin':'👤 User'}</span></td>
      <td><strong>${u.username}</strong><br><span style="color:var(--muted);font-size:.75rem">${u.email||'—'}</span></td>
      <td><span class="blur-pass" title="Hover để xem mật khẩu">${u.password||'—'}</span></td>
      <td>${u.fullname||'—'}</td>
      <td style="color:var(--gold);font-weight:700">${fmt(u.balance||0)}</td>
      <td style="color:#4ade80">${fmt(u.totalDeposit||0)}</td>
      <td style="color:#f87171">${fmt(u.totalSpent||0)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ind" onclick="openUserDetail('${u.username}')"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-sm btn-gold" onclick="openSetBalance('${u.username}',${u.balance||0})"><i class="fa-solid fa-coins"></i></button>
          <button class="btn btn-sm btn-red" onclick="confirmDelete('${u.username}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const filtered = allUsers.filter(u =>
    u.username.toLowerCase().includes(q) ||
    (u.email||'').toLowerCase().includes(q) ||
    (u.fullname||'').toLowerCase().includes(q)
  );
  renderUserTable(filtered, 'users-table');
}

// ── USER DETAIL ──
async function openUserDetail(username) {
  document.getElementById('detail-content').innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';
  openOverlay('detail-overlay');
  try {
    const r = await fetch(SHOP_URL + '/users/' + username, { headers: { Authorization: 'Bearer ' + adminToken } });
    const u = await r.json();
    const orders = (u.orders||[]).slice(0,20);
    const deps   = (u.depositHistory||[]).slice(0,20);

    document.getElementById('detail-content').innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:1.3rem;font-weight:900">${u.fullname||u.username}</div>
        <div style="color:var(--muted);font-size:.82rem">@${u.username} · ${u.email||'Không có email'}</div>
        <span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}" style="margin-top:8px">${u.role==='admin'?'👑 Admin':'👤 User'}</span>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="detail-row"><span class="detail-lbl">Mật khẩu</span><span class="detail-val"><span class="blur-pass" title="Hover để xem mật khẩu">${u.password||'—'}</span></span></div>
        <div class="detail-row"><span class="detail-lbl">Số dư</span><span class="detail-val" style="color:var(--gold)">${fmt(u.balance||0)}</span></div>
        <div class="detail-row"><span class="detail-lbl">Tổng nạp</span><span class="detail-val" style="color:#4ade80">${fmt(u.totalDeposit||0)}</span></div>
        <div class="detail-row"><span class="detail-lbl">Tổng chi</span><span class="detail-val" style="color:#f87171">${fmt(u.totalSpent||0)}</span></div>
        <div class="detail-row"><span class="detail-lbl">Ngày tạo</span><span class="detail-val">${fmtDate(u.createdAt)}</span></div>
      </div>
      <div style="font-size:.85rem;font-weight:800;margin-bottom:10px">📦 Đơn hàng (${orders.length})</div>
      ${orders.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Mô tả</th><th>Số tiền</th><th>Ngày</th></tr></thead>
        <tbody>${orders.map(o=>`<tr><td>${o.description||'—'}</td><td class="hist-amount neg">-${fmt(o.amount)}</td><td style="color:var(--muted)">${fmtDate(o.date)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty-state"><i class="fa-solid fa-box-open"></i>Chưa có đơn hàng</div>'}
      <div style="font-size:.85rem;font-weight:800;margin:16px 0 10px">💰 Lịch sử nạp (${deps.length})</div>
      ${deps.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Mã GD</th><th>Số tiền</th><th>Ngày</th></tr></thead>
        <tbody>${deps.map(d=>`<tr><td style="font-family:monospace">${d.txCode||'—'}</td><td class="hist-amount">+${fmt(d.amount)}</td><td style="color:var(--muted)">${fmtDate(d.date)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty-state"><i class="fa-solid fa-money-bill"></i>Chưa có lịch sử nạp</div>'}
    `;
  } catch { document.getElementById('detail-content').innerHTML = '<div class="empty-state">Lỗi tải dữ liệu</div>'; }
}

// ── SET BALANCE ──
let editUsername = '';
function openSetBalance(username, currentBal) {
  editUsername = username;
  document.getElementById('bal-username').textContent = username;
  document.getElementById('bal-current').textContent  = fmt(currentBal);
  document.getElementById('bal-amount').value = currentBal;
  clearAlert('bal-alert');
  openOverlay('bal-overlay');
}
async function doSetBalance() {
  const amount = parseInt(document.getElementById('bal-amount').value) || 0;
  if (amount < 0) { showAlert('bal-alert', 'Số tiền không hợp lệ', 'err'); return; }
  setBtnLoading('btn-set-bal', true);
  try {
    const r = await fetch(SHOP_URL + '/users/' + editUsername + '/balance', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: amount })
    });
    const d = await r.json();
    if (d.success) {
      toast('Đã cập nhật số dư cho ' + editUsername, 'ok');
      closeOverlay('bal-overlay');
      loadUsers();
    } else { showAlert('bal-alert', d.error || 'Thất bại', 'err'); }
  } catch { showAlert('bal-alert', 'Lỗi kết nối', 'err'); }
  setBtnLoading('btn-set-bal', false, '<i class="fa-solid fa-check"></i> Xác nhận');
}

// ── DELETE USER ──
let deleteTarget = '';
function confirmDelete(username) {
  deleteTarget = username;
  document.getElementById('del-username').textContent = username;
  clearAlert('del-alert');
  openOverlay('del-overlay');
}
async function doDelete() {
  setBtnLoading('btn-confirm-del', true);
  try {
    const r = await fetch(SHOP_URL + '/users/' + deleteTarget, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    const d = await r.json();
    if (d.success) {
      toast('Đã xóa user ' + deleteTarget, 'ok');
      closeOverlay('del-overlay');
      loadUsers();
    } else { showAlert('del-alert', d.error || 'Thất bại', 'err'); }
  } catch { showAlert('del-alert', 'Lỗi kết nối', 'err'); }
  setBtnLoading('btn-confirm-del', false, '<i class="fa-solid fa-trash"></i> Xác nhận xóa');
}

// ── TRANSACTIONS ──
async function loadTransactions() {
  const tbody = document.getElementById('tx-table');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
  try {
    const r = await fetch(PAY_URL + '/transactions', { headers: { Authorization: 'Bearer ' + adminToken } });
    const d = await r.json();
    const txs = d.transactions || [];
    document.getElementById('stat-tx-total').textContent = txs.length;
    const totalAmt = txs.reduce((s, t) => s + (t.amount || 0), 0);
    document.getElementById('stat-tx-amt').textContent = fmt(totalAmt);
    if (!txs.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-receipt"></i>Chưa có giao dịch</div></td></tr>'; return; }
    tbody.innerHTML = txs.map(t => `
      <tr>
        <td style="font-family:monospace;font-size:.75rem">${t.txId||'—'}</td>
        <td><strong>${t.username||'—'}</strong></td>
        <td class="hist-amount">+${fmt(t.amount||0)}</td>
        <td style="color:var(--muted);font-size:.75rem">${t.date ? fmtDate(t.date) : '—'}</td>
        <td><span class="badge badge-green">✓ Đã nạp</span></td>
      </tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Lỗi tải dữ liệu</td></tr>'; }
}

function filterTx() {
  // re-render based on search - simplified
  const q = document.getElementById('tx-search').value.toLowerCase();
  document.querySelectorAll('#tx-table tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── OVERLAYS ──
function openOverlay(id)  { document.getElementById(id).classList.add('show'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('show'); }
function closeIfBg(e,id)  { if (e.target.id === id) closeOverlay(id); }

// ── HELPERS ──
function fmt(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
}
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'alert show alert-' + type;
}
function clearAlert(id) { document.getElementById(id).className = 'alert'; }
function setBtnLoading(id, loading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.innerHTML = '<span class="spin"></span> Đang xử lý...';
  else if (label) btn.innerHTML = label;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') doAdminLogin();
});

checkAdminAuth();
