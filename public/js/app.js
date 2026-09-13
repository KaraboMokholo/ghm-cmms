const API = '/api';
let TOKEN = localStorage.getItem('ghm_token') || '';
let CURRENT_USER = null;

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    TOKEN = '';
    localStorage.removeItem('ghm_token');
    showLogin();
    throw new Error(data.error || 'Please log in');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function badge(status) {
  const map = {
    OPEN: 'badge-open', ASSIGNED: 'badge-open', IN_PROGRESS: 'badge-progress',
    ON_HOLD: 'badge-progress', COMPLETED: 'badge-done', CANCELLED: 'badge-low',
    PENDING: 'badge-progress', APPROVED: 'badge-open', REJECTED: 'badge-low',
    SHIPPED: 'badge-open', RECEIVED: 'badge-done',
    Critical: 'badge-critical', High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low-p',
    CRITICAL: 'badge-critical', LOW: 'badge-high', WATCH: 'badge-progress', OK: 'badge-done',
    DRAFT: 'badge-open', Active: 'badge-done', Obsolete: 'badge-low',
    Standard: 'badge-open', Capital: 'badge-high', Available: 'badge-done',
    Quarantine: 'badge-high', Reserved: 'badge-progress',
    RECEIVE: 'badge-done', ISSUE: 'badge-low', PICK: 'badge-progress',
    TRANSFER_OUT: 'badge-high', TRANSFER_IN: 'badge-done', ADJUST: 'badge-open', RETURN: 'badge-done',
    LOGIN: 'badge-done', LOGOUT: 'badge-open'
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function closeModal() { $('#modal').classList.add('hidden'); }
function openModal(title, html) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function toggleSidebar() {
  $('#sidebar')?.classList.toggle('open');
  $('#sidebar-overlay')?.classList.toggle('show');
}
function closeSidebar() {
  $('#sidebar')?.classList.remove('open');
  $('#sidebar-overlay')?.classList.remove('show');
}

function showLogin() {
  $('#login-screen')?.classList.remove('hidden');
  $('#app-shell')?.classList.add('hidden');
}
function showApp() {
  $('#login-screen')?.classList.add('hidden');
  $('#app-shell')?.classList.remove('hidden');
  if (CURRENT_USER) {
    $('#user-label').textContent = CURRENT_USER.name + ' (' + CURRENT_USER.role + ')';
  }
}

async function doLogout() {
  try { await api('/auth/logout', { method: 'POST', body: '{}' }); } catch (e) {}
  TOKEN = '';
  localStorage.removeItem('ghm_token');
  CURRENT_USER = null;
  showLogin();
}

$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#login-email').value.trim(),
        password: $('#login-password').value
      })
    });
    TOKEN = data.token;
    localStorage.setItem('ghm_token', TOKEN);
    CURRENT_USER = data.user;
    showApp();
    loadView('dashboard');
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$$('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#page-title').textContent = btn.textContent;
    closeSidebar();
    loadView(btn.dataset.view);
  });
});

async function loadView(view) {
  const container = $('#view-container');
  const actions = $('#topbar-actions');
  if (actions) actions.innerHTML = '';
  try {
    const map = {
      dashboard: renderDashboard, inventory: renderInventory, branches: renderBranches,
      requests: renderRequests, movements: renderMovements, forecast: renderForecast,
      orders: renderOrders, purchase: renderPurchase, invoices: renderInvoices,
      services: renderServices, assets: renderAssets, jobs: renderJobs,
      suppliers: renderSuppliers, boms: renderBoms, reports: renderReports, audit: renderAudit,
      pr: renderPR, quotes: renderQuotes, stocktake: renderStockTake, availability: renderAvailability
    };
    if (map[view]) await map[view](container, actions);
  } catch (err) {
    container.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
  }
}

// ── Dashboard ──
async function renderDashboard(container) {
  const d = await api('/dashboard');
  const s = d.summary;
  const k = d.kpis || {};
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Parts</div><div class="value">${s.totalParts}</div></div>
      <div class="stat-card"><div class="label">Branches</div><div class="value">${s.branches}</div></div>
      <div class="stat-card warning"><div class="label">Low Stock (Main)</div><div class="value">${s.lowStockMain}</div></div>
      <div class="stat-card info"><div class="label">Open Jobs</div><div class="value">${s.openJobs}</div></div>
      <div class="stat-card danger"><div class="label">Pending Requests</div><div class="value">${s.pendingRequests}</div></div>
      <div class="stat-card warning"><div class="label">Critical Forecast</div><div class="value">${s.criticalForecast}</div></div>
      <div class="stat-card danger"><div class="label">Below Minimum</div><div class="value">${s.belowMinimum || 0}</div></div>
    </div>
    <div class="card-header" style="padding:0;border:none;margin-bottom:0.5rem"><h3 style="font-size:0.95rem">Maintenance KPIs</h3>
      <button class="btn btn-sm" onclick="runPM()">Run PM scheduler</button></div>
    <div class="stats-grid">
      <div class="stat-card info"><div class="label">Open work orders</div><div class="value">${k.open_work_orders ?? '–'}</div></div>
      <div class="stat-card"><div class="label">Completed repairs/services</div><div class="value">${k.completed_repairs ?? '–'}</div></div>
      <div class="stat-card warning"><div class="label">Total downtime (hrs)</div><div class="value">${k.total_downtime_hours ?? '–'}</div></div>
      <div class="stat-card danger"><div class="label">Assets currently down</div><div class="value">${k.open_downtime_events ?? '–'}</div></div>
      <div class="stat-card"><div class="label">MTTR (hrs avg)</div><div class="value">${k.mttr_hours ?? '–'}</div></div>
      <div class="stat-card"><div class="label">Open PM jobs</div><div class="value">${k.pm_jobs_open ?? '–'}</div></div>
      <div class="stat-card success"><div class="label">Under warranty</div><div class="value">${k.assets_under_warranty ?? '–'}/${k.assets_count ?? '–'}</div></div>
    </div>
    ${(d.reorderAlerts && d.reorderAlerts.length) ? `
    <div class="card" style="border-color:#1a3a6b">
      <div class="card-header">
        <h3>Reorder alerts (at or below minimum)</h3>
        <button class="btn" onclick="generateReorderPOs()">Generate draft POs</button>
      </div>
      <table><thead><tr><th>Part</th><th>On hand</th><th>Min</th><th>Suggested order</th></tr></thead>
      <tbody>${d.reorderAlerts.map(a => `<tr>
        <td><strong>${a.part_number}</strong><br><small style="color:var(--muted)">${a.description}</small></td>
        <td><span class="badge badge-low">${a.quantity}</span></td>
        <td>${a.min_stock}</td>
        <td>${a.suggested_order_qty || '–'}</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}
    <div class="two-col">
      <div class="card"><div class="card-header"><h3>Branch Overview</h3></div>
        <table><thead><tr><th>Branch</th><th>Parts</th><th>Low</th><th>Qty</th></tr></thead>
        <tbody>${d.branchOverview.map(b => `
          <tr><td><strong>${b.code}</strong> ${b.is_main?'(MAIN)':''}<br><small style="color:var(--muted)">${b.name}</small></td>
          <td>${b.partCount}</td><td>${b.lowStock?`<span class="badge badge-low">${b.lowStock}</span>`:0}</td><td>${b.totalQty}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="card"><div class="card-header"><h3>Pending Requests</h3></div>
        <table><thead><tr><th>Code</th><th>From</th><th>Part</th><th>Qty</th></tr></thead>
        <tbody>${d.pendingRequests.length?d.pendingRequests.map(r=>`<tr><td>${r.request_code}</td><td>${r.from_branch_code}</td><td>${r.part_number}</td><td>${r.quantity}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">None</td></tr>'}
        </tbody></table></div>
    </div>`;
}

// ── Inventory ──
async function renderInventory(container, actions) {
  const branches = await api('/branches');
  actions.innerHTML = `
    <select id="inv-branch">${branches.map(b=>`<option value="${b.id}" ${b.is_main?'selected':''}>${b.code}</option>`).join('')}</select>
    <button class="btn" onclick="showStockMovement()">+ Movement</button>`;
  await loadInv(container);
  $('#inv-branch').onchange = () => loadInv(container);
}
async function loadInv(container) {
  const branchId = $('#inv-branch')?.value || 1;
  const stock = await api(`/inventory?branch_id=${branchId}`);
  container.innerHTML = `
    <div class="card"><div class="card-header"><h3>Branch Stock</h3>
      <div class="filters"><input id="inv-search" placeholder="Search..." /><label><input type="checkbox" id="inv-low"/> Low only</label></div></div>
      <table><thead><tr><th>Part # / Alt</th><th>Description</th><th>Bin</th><th>Qty</th><th>Min</th><th>Line Status</th><th>Reclass</th><th></th></tr></thead>
      <tbody id="inv-tbody">${stockRows(stock)}</tbody></table></div>`;
  const filter = () => {
    const q = ($('#inv-search')?.value||'').toLowerCase();
    const low = $('#inv-low')?.checked;
    $('#inv-tbody').innerHTML = stockRows(stock.filter(s => {
      if (q && !(s.part_number||'').toLowerCase().includes(q) && !(s.description||'').toLowerCase().includes(q)) return false;
      if (low && s.quantity > (s.min_stock||0)) return false;
      return true;
    }));
  };
  $('#inv-search')?.addEventListener('input', filter);
  $('#inv-low')?.addEventListener('change', filter);
}
function stockRows(stock) {
  if (!stock.length) return '<tr><td colspan="8" class="empty">No stock</td></tr>';
  return stock.map(s => {
    const alts = (s.alternate_numbers || []).join(', ') || '–';
    return `<tr>
    <td><strong>${s.part_number}</strong><br><small style="color:var(--muted)">Alt: ${alts}</small></td>
    <td>${s.description}</td><td>${s.bin_location||'–'}</td>
    <td>${s.quantity<=(s.min_stock||0)?`<span class="badge badge-low">${s.quantity}</span>`:s.quantity}</td>
    <td>${s.min_stock||0}</td><td>${badge(s.status||'Available')}</td><td>${badge(s.reclass_status||'Standard')}</td>
    <td><button class="btn btn-sm btn-outline" onclick="editPartAlts(${s.part_id}, '${String(s.part_number).replace(/'/g,"&#39;")}', '${alts.replace(/'/g,"&#39;")}')">Alt #</button></td>
  </tr>`;
  }).join('');
}

window.editPartAlts = async function(partId, partNumber, currentAlts) {
  openModal('Part numbers – ' + partNumber, `
    <p style="margin-bottom:0.75rem;color:var(--muted)">
      <strong>Main part number</strong> = the number GHM uses (e.g. 123).<br/>
      <strong>Alternate numbers</strong> = official other numbers for the <em>same</em> part
      (OEM, supplier, box label). They are stored on the part — not typed each time you move stock.<br/>
      Example: main <strong>123</strong>, alternates <strong>246, SANY-FIL-123</strong>. Searching any of them finds this part.
    </p>
    <form id="alt-form">
      <div class="form-group">
        <label>Main part number</label>
        <input name="part_number" value="${partNumber}" required />
      </div>
      <div class="form-group">
        <label>Alternate numbers (comma separated)</label>
        <input name="alternate_numbers" value="${currentAlts === '–' ? '' : currentAlts}" placeholder="246, SANY-FIL-123" />
      </div>
      <button type="submit" class="btn">Save</button>
    </form>`);
  document.getElementById('alt-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/parts/' + partId, {
        method: 'PATCH',
        body: JSON.stringify({
          part_number: fd.get('part_number'),
          alternate_numbers: fd.get('alternate_numbers')
        })
      });
      closeModal();
      loadView('inventory');
    } catch (err) { alert(err.message); }
  };
};


window.showStockMovement = async function () {
  const [branches, parts] = await Promise.all([api('/branches'), api('/parts')]);
  openModal('Stock Movement', `
    <form id="mov-form">
      <div class="form-group"><label>Branch</label><select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code}</option>`).join('')}</select></div>
      <div class="form-group"><label>Part</label><select name="part_id"><option value="">Select…</option>${parts.map(p=>`<option value="${p.id}">${p.part_number}</option>`).join('')}</select></div>
      <div class="form-group"><label>Type</label><select name="movement_type">
        <option value="RECEIVE">Receive</option><option value="ISSUE">Issue</option><option value="PICK">Pick</option>
        <option value="TRANSFER_OUT">Transfer Out</option><option value="TRANSFER_IN">Transfer In</option>
        <option value="ADJUST">Adjust</option><option value="RETURN">Return</option>
      </select></div>
      <div class="form-group"><label>Qty</label><input name="quantity" type="number" min="1" value="1" required/></div>
      <div class="form-group"><label>Reference</label><input name="reference"/></div>
      <div class="form-group"><label>Notes</label><input name="notes"/></div>
      <button type="submit" class="btn">Post</button>
    </form>`);
  $('#mov-form').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.branch_id = +body.branch_id; body.part_id = +body.part_id; body.quantity = +body.quantity;
    try {
      const r = await api('/movements', { method: 'POST', body: JSON.stringify(body) });
      alert('Transfer code: ' + r.transfer_code);
      closeModal(); loadView('inventory');
    } catch (err) { alert(err.message); }
  };
};

// ── Branches ──
async function renderBranches(container) {
  const branches = await api('/branches');
  let html = '<div class="stats-grid">';
  for (const b of branches) {
    const stock = await api(`/branches/${b.id}/stock`);
    const low = stock.filter(s => s.quantity <= (s.min_stock||0)).length;
    html += `<div class="stat-card ${low?'warning':''}"><div class="label">${b.code}</div>
      <div class="value" style="font-size:1.1rem">${b.name}</div>
      <div style="margin-top:0.4rem;font-size:0.8rem;color:var(--muted)">${stock.length} parts · ${low} low</div></div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ── Requests ──
async function renderRequests(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="showNewRequest()">+ Request</button>`;
  const requests = await api('/requests');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Branch Requests</h3></div>
    <table><thead><tr><th>Code</th><th>From</th><th>Part</th><th>Qty</th><th>Status</th><th>Transfer</th><th></th></tr></thead>
    <tbody>${requests.map(r => `<tr>
      <td><strong>${r.request_code}</strong></td><td>${r.from_branch_code}</td>
      <td>${r.part_number}</td><td>${r.quantity}</td><td>${badge(r.status)}</td>
      <td>${r.transfer_code||'–'}</td>
      <td>${r.status==='PENDING'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'APPROVED')">Approve</button>`:''}
      ${r.status==='APPROVED'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'SHIPPED')">Ship</button>`:''}
      ${r.status==='SHIPPED'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'RECEIVED')">Receive</button>`:''}</td>
    </tr>`).join('')||'<tr><td colspan="7" class="empty">None</td></tr>'}</tbody></table></div>`;
}
window.updateRequest = async (id, status) => {
  try {
    const r = await api(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (r.transfer_code) alert('Transfer: ' + r.transfer_code);
    loadView('requests');
  } catch (e) { alert(e.message); }
};
window.showNewRequest = async () => {
  const [branches, parts] = await Promise.all([api('/branches'), api('/parts')]);
  openModal('New Request', `<form id="req-form">
    <div class="form-group"><label>From branch</label><select name="from_branch_id">${branches.filter(b=>!b.is_main).map(b=>`<option value="${b.id}">${b.code}</option>`).join('')}</select></div>
    <div class="form-group"><label>Part</label><select name="part_id">${parts.map(p=>`<option value="${p.id}">${p.part_number}</option>`).join('')}</select></div>
    <div class="form-group"><label>Qty</label><input name="quantity" type="number" value="1" min="1"/></div>
    <div class="form-group"><label>Notes</label><input name="notes"/></div>
    <button class="btn" type="submit">Submit</button></form>`);
  $('#req-form').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.from_branch_id=+body.from_branch_id; body.part_id=+body.part_id; body.quantity=+body.quantity;
    try { await api('/requests',{method:'POST',body:JSON.stringify(body)}); closeModal(); loadView('requests'); }
    catch(err){alert(err.message);}
  };
};

// ── Movements ──
async function renderMovements(container) {
  const list = await api('/movements?limit=100');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>All Movements (name + date on every line)</h3></div>
    <table><thead><tr><th>What happened</th><th>Transfer Code</th><th>Branch</th><th>Type</th></tr></thead>
    <tbody>${list.map(m=>`<tr>
      <td><strong>${m.summary || ((m.user_name||m.performed_by||'Someone') + ' — ' + m.quantity + ' × ' + (m.part_number||''))}</strong>
        <br><small style="color:var(--muted)">${new Date(m.created_at).toLocaleString()}</small></td>
      <td><strong>${m.transfer_code}</strong></td>
      <td>${m.branch_code||'–'}</td>
      <td>${badge(m.movement_type)}</td>
    </tr>`).join('')||'<tr><td colspan="4" class="empty">None</td></tr>'}</tbody></table></div>`;
}

// ── BOMs ──
async function renderBoms(container, actions) {
  actions.innerHTML = `<input id="bom-search" placeholder="Search kits..." style="width:180px"/>`;
  let list = await api('/boms');
  const render = (items) => {
    container.innerHTML = `<div class="card"><div class="card-header"><h3>Service Kits (BOM)</h3></div>
      <table><thead><tr><th>Code</th><th>Name</th><th>Service Type</th><th>Items</th><th></th></tr></thead>
      <tbody>${items.map(b=>`<tr>
        <td><strong>${b.code}</strong></td><td>${b.name}</td><td>${b.service_type_name||'–'}</td>
        <td>${b.item_count}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewBom(${b.id})">View</button>
          <button class="btn btn-sm" onclick="jobFromBom(${b.id})">Open Job Card</button>
        </td>
      </tr>`).join('')||'<tr><td colspan="5" class="empty">No BOMs</td></tr>'}</tbody></table></div>`;
  };
  render(list);
  $('#bom-search').oninput = async () => {
    const q = $('#bom-search').value;
    list = await api('/boms' + (q ? '?search=' + encodeURIComponent(q) : ''));
    render(list);
  };
}

window.viewBom = async (id) => {
  const bom = await api('/boms/' + id);
  openModal(bom.code + ' – ' + bom.name, `
    <p style="margin-bottom:0.75rem;color:var(--muted)">${bom.service_type_name||''} ${bom.notes?('· '+bom.notes):''}</p>
    <table><thead><tr><th>Part</th><th>Description</th><th>Qty</th></tr></thead>
    <tbody>${bom.items.map(i=>`<tr><td>${i.part_number}</td><td>${i.description}</td><td>${i.quantity}</td></tr>`).join('')}</tbody></table>
    <div style="margin-top:1rem">
      <button class="btn" onclick="closeModal(); jobFromBom(${id})">Create Job from this kit</button>
      <button class="btn btn-outline" onclick="issueBomToJob(${id})">Issue kit to existing job</button>
    </div>`);
};

window.jobFromBom = async (bomId) => {
  const [bom, assets, branches] = await Promise.all([api('/boms/'+bomId), api('/assets'), api('/branches')]);
  openModal('Job Card from ' + bom.code, `<form id="bom-job-form">
    <div class="form-group"><label>Title</label><input name="title" value="${bom.name}" required/></div>
    <div class="form-group"><label>Asset</label><select name="asset_id"><option value="">–</option>${assets.map(a=>`<option value="${a.id}">${a.code} ${a.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Branch</label><select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code}</option>`).join('')}</select></div>
    <div class="form-group"><label>Scheduled</label><input name="scheduled_date" type="date"/></div>
    <button class="btn" type="submit">Create Job Card</button></form>`);
  $('#bom-job-form').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (body.asset_id) body.asset_id = +body.asset_id; else delete body.asset_id;
    body.branch_id = +body.branch_id;
    try {
      const job = await api(`/boms/${bomId}/create-job`, { method: 'POST', body: JSON.stringify(body) });
      alert('Created ' + job.job_number);
      closeModal(); loadView('jobs');
    } catch (err) { alert(err.message); }
  };
};

window.issueBomToJob = async (bomId) => {
  const [bom, jobs, branches] = await Promise.all([api('/boms/'+bomId), api('/job-cards?upcoming=true'), api('/branches')]);
  if (!jobs.length) return alert('No open jobs. Create a job first.');
  openModal('Issue BOM to Job (amend quantities if needed)', `
    <form id="issue-bom-form">
      <div class="form-group"><label>Job</label><select name="job_id">${jobs.map(j=>`<option value="${j.id}">${j.job_number} – ${j.title}</option>`).join('')}</select></div>
      <div class="form-group"><label>Branch (stock from)</label><select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code}</option>`).join('')}</select></div>
      <table><thead><tr><th>Part</th><th>BOM Qty</th><th>Issue Qty (amend)</th><th>Note</th></tr></thead>
      <tbody>${bom.items.map((i,idx)=>`<tr>
        <td>${i.part_number}<input type="hidden" name="part_id_${idx}" value="${i.part_id}"/></td>
        <td>${i.quantity}</td>
        <td><input name="qty_${idx}" type="number" value="${i.quantity}" min="0" style="width:70px"/></td>
        <td><input name="note_${idx}" placeholder="amendment note" style="width:120px"/></td>
      </tr>`).join('')}</tbody></table>
      <input type="hidden" name="item_count" value="${bom.items.length}"/>
      <button class="btn" type="submit" style="margin-top:0.75rem">Issue stock</button>
    </form>`);
  $('#issue-bom-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const count = +fd.get('item_count');
    const items = [];
    for (let i = 0; i < count; i++) {
      const part_id = +fd.get('part_id_'+i);
      const quantity = +fd.get('qty_'+i);
      const notes = fd.get('note_'+i) || '';
      const bomQty = bom.items[i].quantity;
      if (quantity > 0) items.push({ part_id, quantity, amended: quantity !== bomQty || !!notes, notes });
    }
    try {
      const r = await api(`/boms/${bomId}/issue`, {
        method: 'POST',
        body: JSON.stringify({ job_id: +fd.get('job_id'), branch_id: +fd.get('branch_id'), items })
      });
      const codes = (r.results||[]).filter(x=>x.ok).map(x=>x.transfer_code).join(', ');
      alert('Issued. Codes: ' + (codes || 'see movements'));
      closeModal(); loadView('movements');
    } catch (err) { alert(err.message); }
  };
};

// ── Reports ──
async function renderReports(container, actions) {
  actions.innerHTML = `
    <input type="date" id="rpt-from"/> <input type="date" id="rpt-to"/>
    <button class="btn" onclick="runReport()">Run Report</button>`;
  container.innerHTML = `<div class="empty">Select dates (optional) and click Run Report</div>`;
}
window.runReport = async () => {
  const from = $('#rpt-from')?.value || '';
  const to = $('#rpt-to')?.value || '';
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const r = await api('/reports/summary?' + q.toString());
  const c = r.counts;
  $('#view-container').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Movements</div><div class="value">${c.total_movements}</div></div>
      <div class="stat-card"><div class="label">Stock In</div><div class="value">${c.stock_in}</div></div>
      <div class="stat-card"><div class="label">Stock Out</div><div class="value">${c.stock_out}</div></div>
      <div class="stat-card"><div class="label">Adjustments</div><div class="value">${c.adjustments}</div></div>
      <div class="stat-card"><div class="label">Inter-branch</div><div class="value">${c.inter_branch}</div></div>
      <div class="stat-card"><div class="label">Service Issues</div><div class="value">${c.services_issued}</div></div>
      <div class="stat-card"><div class="label">POs</div><div class="value">${c.purchase_orders}</div></div>
    </div>
    ${reportTable('Stock In (Receive / Transfer In / Return)', r.stock_in)}
    ${reportTable('Stock Out (Issue / Pick / Transfer Out)', r.stock_out)}
    ${reportTable('Adjustments', r.adjustments)}
    ${reportTable('Inter-branch Transfers', r.inter_branch)}
    ${reportTable('Services Issued (to jobs)', r.services_issued)}
    <div class="card"><div class="card-header"><h3>Purchase Orders</h3></div>
      <table><thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Total</th></tr></thead>
      <tbody>${(r.purchase_orders||[]).map(p=>`<tr><td>${p.po_number}</td><td>${p.supplier_name||'–'}</td><td>${badge(p.status)}</td><td>${p.order_date||'–'}</td><td>R ${Number(p.total_amount).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">None</td></tr>'}
      </tbody></table></div>`;
};
function reportTable(title, rows) {
  return `<div class="card"><div class="card-header"><h3>${title}</h3></div>
    <table><thead><tr><th>What happened</th><th>Transfer</th><th>Branch</th><th>Type</th></tr></thead>
    <tbody>${(rows||[]).length?rows.map(m=>`<tr>
      <td><strong>${m.summary || ((m.user_name||m.performed_by||'Someone') + ' — ' + m.quantity + ' × ' + (m.part_number||''))}</strong>
        <br><small style="color:var(--muted)">${new Date(m.created_at).toLocaleString()}</small></td>
      <td>${m.transfer_code||'–'}</td>
      <td>${m.branch_code||'–'}</td>
      <td>${badge(m.movement_type)}</td>
    </tr>`).join(''):'<tr><td colspan="4" class="empty">None in period</td></tr>'}</tbody></table></div>`;
}

// ── Audit ──
async function renderAudit(container) {
  try {
    const logs = await api('/auth/logs');
    container.innerHTML = `<div class="card"><div class="card-header"><h3>Login / Logout Audit</h3></div>
      <table><thead><tr><th>Time</th><th>User</th><th>Email</th><th>Action</th></tr></thead>
      <tbody>${logs.map(l=>`<tr>
        <td>${new Date(l.at).toLocaleString()}</td>
        <td>${l.user_name||'–'}</td><td>${l.email||'–'}</td>
        <td>${badge(l.action)}</td>
      </tr>`).join('')||'<tr><td colspan="4" class="empty">No logs</td></tr>'}</tbody></table></div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty">${e.message} (admin only)</div>`;
  }
}

// ── Forecast / Orders / PO / Invoices / Services / Assets / Jobs / Suppliers ──
async function renderForecast(container, actions) {
  actions.innerHTML = `
    <button class="btn btn-outline" onclick="loadView('reports')">Reports</button>
    <button class="btn" onclick="generateReorderPOs()">Generate POs (below min)</button>
    <button class="btn btn-outline" onclick="createOrderFromForecast()">Order list (critical/low)</button>`;
  const list = await api('/forecast');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Forecast</h3></div>
    <table><thead><tr><th>Urgency</th><th>Part</th><th>On Hand</th><th>Min</th><th>Used 30d</th><th>Suggested</th></tr></thead>
    <tbody>${list.map(f=>`<tr><td>${badge(f.urgency)}</td><td>${f.part_number}<br><small>${f.description}</small></td>
      <td>${f.quantity}</td><td>${f.min_stock}</td><td>${f.used_last_30_days}</td><td>${f.suggested_order_qty||'–'}</td></tr>`).join('')}</tbody></table></div>`;
}

// ── Global actions (must exist for onclick buttons) ──
window.runPM = async function () {
  try {
    const r = await api('/pm/run', { method: 'POST', body: '{}' });
    const n = (r.jobs && r.jobs.length) || 0;
    if (n === 0) {
      alert('PM scheduler ran.\n\nNo new jobs created.\nReason: no asset is due, or an open PM job already exists for due services.');
    } else {
      alert('PM scheduler created ' + n + ' job(s):\n' + r.jobs.map(j => j.job_number + ' – ' + j.title).join('\n'));
      loadView('jobs');
    }
  } catch (e) {
    alert('PM failed: ' + e.message);
  }
};

window.generateReorderPOs = async function () {
  try {
    // First show what would be ordered
    const alerts = await api('/reorder/alerts');
    if (!alerts.length) {
      alert('No items at or below minimum stock.\n\nLower a quantity or raise min stock on a part, then try again.');
      return;
    }
    const withSup = alerts.filter(a => a.supplier_id);
    const noSup = alerts.filter(a => !a.supplier_id);
    let msg = alerts.length + ' part(s) below minimum.\n';
    msg += withSup.length + ' have a supplier (will get draft POs).\n';
    if (noSup.length) msg += noSup.length + ' have NO supplier (skipped).\n';
    msg += '\nCreate draft Purchase Orders now?';
    if (!confirm(msg)) return;
    const r = await api('/reorder/generate-pos', { method: 'POST', body: JSON.stringify({ notes: 'Auto from minimum quantity' }) });
    const lines = (r.purchase_orders || []).map(p => p.po_number + ' – ' + p.supplier_name + ' (' + p.lines + ' lines)').join('\n');
    alert((r.message || 'Done') + (lines ? '\n\n' + lines : ''));
    loadView('purchase');
  } catch (e) {
    alert('Generate POs failed: ' + e.message);
  }
};

window.createOrderFromForecast = async () => {
  const list = await api('/forecast');
  const need = list.filter(f => f.suggested_order_qty > 0 && ['CRITICAL','LOW','WATCH'].includes(f.urgency));
  if (!need.length) return alert('Nothing to order');
  const suppliers = await api('/suppliers');
  openModal('Order from Forecast', `<form id="fc-form">
    <div class="form-group"><label>Supplier</label><select name="supplier_id">${suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
    <p>${need.length} parts</p>
    <button class="btn" type="submit">Create Order List</button></form>`);
  $('#fc-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/supplier-orders', { method: 'POST', body: JSON.stringify({
        supplier_id: +e.target.supplier_id.value,
        notes: 'From forecast',
        items: need.map(f => ({ part_id: f.part_id, quantity: f.suggested_order_qty, unit_cost: 0 }))
      })});
      closeModal(); loadView('orders');
    } catch (err) { alert(err.message); }
  };
};

async function renderOrders(container, actions) {
  const orders = await api('/supplier-orders');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Order Lists</h3></div>
    <table><thead><tr><th>#</th><th>Supplier</th><th>Status</th><th>Total</th><th></th></tr></thead>
    <tbody>${orders.map(o=>`<tr><td>${o.order_number}</td><td>${o.supplier_name||'–'}</td><td>${badge(o.status)}</td>
      <td>R ${Number(o.total_amount).toFixed(2)}</td>
      <td>${o.status==='DRAFT'?`<button class="btn btn-sm" onclick="convertOrderToPO(${o.id})">To PO</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">None</td></tr>'}</tbody></table></div>`;
}
window.convertOrderToPO = async id => {
  try { const po = await api(`/supplier-orders/${id}/to-po`, { method: 'POST', body: '{}' }); alert('PO: '+po.po_number); loadView('orders'); }
  catch(e){alert(e.message);}
};

async function renderPurchase(container) {
  const pos = await api('/purchase-orders');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Purchase Orders</h3></div>
    <table><thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Total</th></tr></thead>
    <tbody>${pos.map(p=>`<tr><td>${p.po_number}</td><td>${p.supplier_name||'–'}</td><td>${badge(p.status)}</td><td>${p.order_date||'–'}</td><td>R ${Number(p.total_amount).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">None</td></tr>'}</tbody></table></div>`;
}

async function renderInvoices(container) {
  const list = await api('/invoices');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Invoices</h3></div>
    <table><thead><tr><th>#</th><th>Customer</th><th>PO</th><th>Status</th><th>Total</th></tr></thead>
    <tbody>${list.map(i=>`<tr><td>${i.invoice_number}</td><td>${i.customer_name||'–'}</td><td>${i.po_number||'–'}</td><td>${badge(i.status)}</td><td>R ${Number(i.total_amount).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">None</td></tr>'}</tbody></table></div>`;
}

async function renderServices(container) {
  const list = await api('/service-types');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Service Types</h3></div>
    <table><thead><tr><th>Code</th><th>Name</th><th>Asset</th><th>Interval</th></tr></thead>
    <tbody>${list.map(s=>`<tr><td>${s.code}</td><td>${s.name}</td><td>${s.asset_type}</td><td>${s.interval_hours?s.interval_hours+' hrs':(s.interval_days?s.interval_days+' days':'–')}</td></tr>`).join('')}</tbody></table></div>`;
}

async function renderAssets(container, actions) {
  if (actions) actions.innerHTML = `<button class="btn btn-sm" onclick="runPM()">Run PM scheduler</button>`;
  const list = await api('/assets');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Asset registry</h3></div>
    <table><thead><tr>
      <th>Code</th><th>Name</th><th>Location</th><th>Branch</th><th>Hours</th>
      <th>Warranty</th><th>Status</th><th>Due</th><th></th>
    </tr></thead>
    <tbody>${list.map(a=>`<tr>
      <td><strong>${a.code}</strong><br><small style="color:var(--muted)">${a.serial_number||''}</small></td>
      <td>${a.name}</td>
      <td>${a.location_detail||'–'}</td>
      <td>${a.branch_code||'–'}</td>
      <td>${a.hour_meter}</td>
      <td>${a.warranty_expiry ? (a.warranty_active ? badge('Active') + ' ' + a.warranty_expiry : badge('Expired') + ' ' + a.warranty_expiry) : '–'}</td>
      <td>${badge(a.status||'Operational')}</td>
      <td>${(a.services_due||[]).length ? a.services_due.map(s=>`<span class="badge badge-high">${s}</span>`).join(' ') : '–'}</td>
      <td><button class="btn btn-sm btn-outline" onclick="viewAsset(${a.id})">Open</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

window.viewAsset = async function (id) {
  const a = await api('/assets/' + id);
  const hist = (a.service_history || []).map(h => `
    <tr>
      <td>${h.date||'–'}</td>
      <td>${h.summary||'–'}</td>
      <td>${h.service_type_name||'–'}</td>
      <td>${h.hour_meter??'–'}</td>
      <td>${h.performed_by||'–'}</td>
      <td>${h.job_number||'–'}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">No service history yet</td></tr>';
  openModal(a.code + ' – ' + a.name, `
    <p style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--muted)">
      <strong>Location:</strong> ${a.location_detail||'–'} ·
      <strong>Serial:</strong> ${a.serial_number||'–'} ·
      <strong>Branch:</strong> ${a.branch_code||'–'}<br/>
      <strong>Purchase:</strong> ${a.purchase_date||'–'} ·
      <strong>Warranty until:</strong> ${a.warranty_expiry||'–'} ${a.warranty_active ? '(active)' : (a.warranty_expiry ? '(expired)' : '')}<br/>
      <strong>Warranty notes:</strong> ${a.warranty_notes||'–'} ·
      <strong>Status:</strong> ${a.status} · <strong>Hours:</strong> ${a.hour_meter} (last service @ ${a.last_service_hours??'–'})
    </p>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <button class="btn btn-sm" onclick="startDowntime(${a.id})">Start downtime</button>
      <button class="btn btn-sm btn-outline" onclick="endDowntime(${a.id})">End downtime</button>
      <button class="btn btn-sm btn-outline" onclick="addHistory(${a.id})">Add service record</button>
    </div>
    <h4 style="margin:0.5rem 0;font-size:0.9rem">Service history</h4>
    <table><thead><tr><th>Date</th><th>Summary</th><th>Type</th><th>Hours</th><th>By</th><th>Job</th></tr></thead>
    <tbody>${hist}</tbody></table>
  `);
};

window.startDowntime = async function (id) {
  const reason = prompt('Reason for downtime?', 'Breakdown');
  if (reason === null) return;
  try {
    await api('/assets/' + id + '/downtime/start', { method: 'POST', body: JSON.stringify({ reason }) });
    alert('Downtime started');
    closeModal();
    loadView('assets');
  } catch (e) { alert(e.message); }
};

window.endDowntime = async function (id) {
  try {
    await api('/assets/' + id + '/downtime/end', { method: 'POST', body: '{}' });
    alert('Downtime ended');
    closeModal();
    loadView('assets');
  } catch (e) { alert(e.message); }
};

window.addHistory = async function (id) {
  const summary = prompt('Service summary?', 'Routine service');
  if (!summary) return;
  try {
    await api('/assets/' + id + '/history', { method: 'POST', body: JSON.stringify({ summary }) });
    alert('History saved');
    viewAsset(id);
  } catch (e) { alert(e.message); }
};


async function renderJobs(container, actions) {
  actions.innerHTML = `<button class="btn btn-outline" onclick="loadJobs('upcoming')">Upcoming</button>
    <button class="btn btn-outline" onclick="loadJobs('past')">Past</button>`;
  await loadJobs('upcoming');
}
window.loadJobs = async (type) => {
  const jobs = await api(`/job-cards?${type}=true`);
  $('#view-container').innerHTML = `<div class="card"><div class="card-header"><h3>${type} Jobs</h3></div>
    <table><thead><tr><th>Job #</th><th>Title</th><th>BOM / Service</th><th>Branch</th><th>Priority</th><th>Status</th><th></th></tr></thead>
    <tbody>${jobs.map(j=>`<tr>
      <td><strong>${j.job_number}</strong></td><td>${j.title}</td>
      <td>${j.bom_code||j.service_type_name||'–'}</td><td>${j.branch_code||'–'}</td>
      <td>${badge(j.priority)}</td><td>${badge(j.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showJobCost(${j.id})">Cost</button>
        <select onchange="setJobStatus(${j.id},this.value)"><option value="">Update…</option>
        <option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option></select>
      </td>
    </tr>`).join('')||'<tr><td colspan="7" class="empty">None</td></tr>'}</tbody></table></div>`;
};
window.setJobStatus = async (id, status) => {
  if (!status) return;
  const body = { status };
  if (status === 'COMPLETED') body.completed_date = new Date().toISOString().slice(0,10);
  try { await api(`/job-cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }); loadView('jobs'); }
  catch(e){alert(e.message);}
};

async function renderSuppliers(container) {
  const list = await api('/suppliers');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Suppliers</h3></div>
    <table><thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th></tr></thead>
    <tbody>${list.map(s=>`<tr><td>${s.name}</td><td>${s.contact_person||'–'}</td><td>${s.email||'–'}</td><td>${s.phone||'–'}</td></tr>`).join('')}</tbody></table></div>`;
}

// ── Boot ──
(async function init() {
  if (TOKEN) {
    try {
      CURRENT_USER = await api('/auth/me');
      showApp();
      loadView('dashboard');
      return;
    } catch (e) {
      TOKEN = '';
      localStorage.removeItem('ghm_token');
    }
  }
  showLogin();
})();


// ── Purchase Requests ──
async function renderPR(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="showNewPR()">+ Purchase Request</button>`;
  const list = await api('/purchase-requests');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Purchase Requests (initiation → approve → PO)</h3></div>
    <table><thead><tr><th>PR #</th><th>Title</th><th>Supplier</th><th>Status</th><th>By</th><th></th></tr></thead>
    <tbody>${list.map(pr => `<tr>
      <td><strong>${pr.pr_number}</strong></td><td>${pr.title||'–'}</td><td>${pr.supplier_name||'–'}</td>
      <td>${badge(pr.status)}</td><td>${pr.requested_by||'–'}</td>
      <td>
        ${pr.status==='DRAFT'?`<button class="btn btn-sm" onclick="patchPR(${pr.id},'SUBMITTED')">Submit</button>`:''}
        ${pr.status==='SUBMITTED'?`<button class="btn btn-sm" onclick="patchPR(${pr.id},'APPROVED')">Approve</button>`:''}
        ${pr.status==='APPROVED'?`<button class="btn btn-sm" onclick="prToPO(${pr.id})">Convert to PO</button>`:''}
        ${pr.status==='CONVERTED'?'→ PO':''}
      </td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">None</td></tr>'}</tbody></table></div>`;
}
window.patchPR = async (id, status) => {
  try { await api('/purchase-requests/'+id, { method:'PATCH', body: JSON.stringify({ status }) }); loadView('pr'); }
  catch(e){ alert(e.message); }
};
window.prToPO = async (id) => {
  try {
    const po = await api('/purchase-requests/'+id+'/to-po', { method:'POST', body:'{}' });
    alert('Created ' + po.po_number);
    loadView('purchase');
  } catch(e){ alert(e.message); }
};
window.showNewPR = async () => {
  const [parts, suppliers] = await Promise.all([api('/parts'), api('/suppliers')]);
  openModal('New Purchase Request', `<form id="pr-form">
    <div class="form-group"><label>Title</label><input name="title" value="Stock replenishment" required/></div>
    <div class="form-group"><label>Supplier (optional now)</label>
      <select name="supplier_id"><option value="">– Later –</option>${suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Part</label>
      <select name="part_id">${parts.map(p=>`<option value="${p.id}">${p.part_number}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Qty</label><input name="quantity" type="number" value="1" min="1"/></div>
    <div class="form-group"><label>Est. unit cost</label><input name="unit_cost" type="number" step="0.01" value="0"/></div>
    <button class="btn" type="submit">Create PR</button>
  </form>`);
  $('#pr-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      title: fd.get('title'),
      supplier_id: fd.get('supplier_id') || null,
      items: [{ part_id: +fd.get('part_id'), quantity: +fd.get('quantity'), unit_cost: +fd.get('unit_cost') }]
    };
    try { await api('/purchase-requests', { method:'POST', body: JSON.stringify(body) }); closeModal(); loadView('pr'); }
    catch(err){ alert(err.message); }
  };
};

// ── Quotations ──
async function renderQuotes(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="showNewQuote('PARTS')">+ Parts quote</button>
    <button class="btn btn-outline" onclick="showNewQuote('SERVICE')">+ Service quote</button>`;
  const list = await api('/quotations');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Quotations</h3></div>
    <table><thead><tr><th>#</th><th>Type</th><th>Customer</th><th>Status</th><th>Total</th><th>By</th></tr></thead>
    <tbody>${list.map(q=>`<tr>
      <td><strong>${q.quote_number}</strong></td><td>${badge(q.quote_type)}</td>
      <td>${q.customer_name||'–'}</td><td>${badge(q.status)}</td>
      <td>R ${Number(q.total_amount).toFixed(2)}</td><td>${q.created_by||'–'}</td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">None</td></tr>'}</tbody></table></div>`;
}
window.showNewQuote = async (quote_type) => {
  const parts = await api('/parts');
  openModal((quote_type==='SERVICE'?'Service':'Parts') + ' quotation', `<form id="q-form">
    <div class="form-group"><label>Customer</label><input name="customer_name" required/></div>
    <div class="form-group"><label>Valid until</label><input name="valid_until" type="date"/></div>
    ${quote_type==='PARTS' ? `<div class="form-group"><label>Part</label>
      <select name="part_id">${parts.map(p=>`<option value="${p.id}" data-cost="${p.unit_cost}">${p.part_number} – ${p.description}</option>`).join('')}</select></div>
      <div class="form-group"><label>Qty</label><input name="quantity" type="number" value="1"/></div>
      <div class="form-group"><label>Unit price (R)</label><input name="unit_price" type="number" step="0.01" value="0"/></div>`
    : `<div class="form-group"><label>Service description</label><input name="description" required placeholder="e.g. 500hr service labour"/></div>
      <div class="form-group"><label>Qty / hours</label><input name="quantity" type="number" step="0.5" value="1"/></div>
      <div class="form-group"><label>Unit price (R)</label><input name="unit_price" type="number" step="0.01" value="0"/></div>`}
    <button class="btn" type="submit">Save quote</button>
  </form>`);
  $('#q-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let description = fd.get('description');
    let part_id = fd.get('part_id') ? +fd.get('part_id') : null;
    if (quote_type==='PARTS' && part_id) {
      const p = parts.find(x => x.id === part_id);
      description = p ? (p.part_number + ' – ' + p.description) : 'Part';
    }
    try {
      await api('/quotations', { method:'POST', body: JSON.stringify({
        quote_type, customer_name: fd.get('customer_name'), valid_until: fd.get('valid_until')||null,
        items: [{ description, part_id, quantity: +fd.get('quantity'), unit_price: +fd.get('unit_price') }]
      })});
      closeModal(); loadView('quotes');
    } catch(err){ alert(err.message); }
  };
};

// ── Stock take ──
async function renderStockTake(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="startStockTake()">+ Start stock take</button>`;
  const list = await api('/stock-takes');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Stock takes</h3></div>
    <table><thead><tr><th>#</th><th>Branch</th><th>Status</th><th>By</th><th>Date</th><th></th></tr></thead>
    <tbody>${list.map(st=>`<tr>
      <td><strong>${st.take_number}</strong></td><td>${st.branch_code||'–'}</td>
      <td>${badge(st.status)}</td><td>${st.created_by||'–'}</td>
      <td>${new Date(st.created_at).toLocaleString()}</td>
      <td>
        ${st.status==='OPEN'?`<button class="btn btn-sm" onclick="openStockTake(${st.id})">Count</button>
        <button class="btn btn-sm btn-outline" onclick="postStockTake(${st.id})">Post adjustments</button>`:'Posted'}
      </td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">None</td></tr>'}</tbody></table></div>`;
}
window.startStockTake = async () => {
  const branches = await api('/branches');
  openModal('Start stock take', `<form id="st-form">
    <div class="form-group"><label>Branch</label>
      <select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code} – ${b.name}</option>`).join('')}</select>
    </div>
    <button class="btn" type="submit">Create count sheet</button>
  </form>`);
  $('#st-form').onsubmit = async e => {
    e.preventDefault();
    try {
      const st = await api('/stock-takes', { method:'POST', body: JSON.stringify({ branch_id: +e.target.branch_id.value }) });
      closeModal(); openStockTake(st.id);
    } catch(err){ alert(err.message); }
  };
};
window.openStockTake = async (id) => {
  const st = await api('/stock-takes/'+id);
  openModal(st.take_number + ' – count', `
    <form id="count-form">
      <table><thead><tr><th>Part</th><th>System</th><th>Counted</th><th>Var</th></tr></thead>
      <tbody>${(st.items||[]).map(l=>`<tr>
        <td>${l.part_number}<br><small>${l.description||''}</small>
          <input type="hidden" name="line_${l.id}" value="${l.id}"/></td>
        <td>${l.system_qty}</td>
        <td><input name="qty_${l.id}" type="number" value="${l.counted_qty!=null?l.counted_qty:l.system_qty}" style="width:80px"/></td>
        <td>${l.variance!=null?l.variance:'–'}</td>
      </tr>`).join('')}</tbody></table>
      <button class="btn" type="submit" style="margin-top:0.75rem">Save counts</button>
    </form>`);
  $('#count-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const counts = [];
    for (const [k,v] of fd.entries()) {
      if (k.startsWith('qty_')) {
        const line_id = +k.replace('qty_','');
        counts.push({ line_id, counted_qty: +v });
      }
    }
    try {
      await api('/stock-takes/'+id+'/counts', { method:'PUT', body: JSON.stringify({ counts }) });
      alert('Counts saved');
      closeModal(); loadView('stocktake');
    } catch(err){ alert(err.message); }
  };
};
window.postStockTake = async (id) => {
  if (!confirm('Post stock take? This creates ADJUST movements for variances and updates stock.')) return;
  try {
    const r = await api('/stock-takes/'+id+'/post', { method:'POST', body:'{}' });
    alert(r.message);
    loadView('stocktake');
  } catch(e){ alert(e.message); }
};

// ── Job costing ──
window.showJobCost = async (id) => {
  const c = await api('/job-cards/'+id+'/costing');
  openModal('Job costing – ' + c.job_number, `
    <p><strong>${c.title}</strong> · ${badge(c.status)}</p>
    <table style="margin:0.75rem 0"><thead><tr><th>Part</th><th>Qty</th><th>Unit cost</th><th>Line</th></tr></thead>
    <tbody>${(c.parts||[]).map(p=>`<tr>
      <td>${p.part_number}<br><small>${p.description||''}</small></td>
      <td>${p.quantity_used}</td><td>R ${Number(p.unit_cost).toFixed(2)}</td>
      <td>R ${Number(p.line_cost).toFixed(2)}</td>
    </tr>`).join('')||'<tr><td colspan="4" class="empty">No parts issued</td></tr>'}
    </tbody></table>
    <p>Labour: ${c.hours} h × R ${c.labour_rate}/h = <strong>R ${Number(c.labour_total).toFixed(2)}</strong></p>
    <p>Parts total: <strong>R ${Number(c.parts_total).toFixed(2)}</strong></p>
    <p style="font-size:1.1rem">Grand total: <strong>R ${Number(c.grand_total).toFixed(2)}</strong></p>
  `);
};

// ── Availability report ──
async function renderAvailability(container, actions) {
  actions.innerHTML = `
    <input type="date" id="av-from"/> <input type="date" id="av-to"/>
    <button class="btn" onclick="runAvailability()">Run</button>`;
  container.innerHTML = `<div class="empty">Pick period (optional) and Run for monthly / period availability</div>`;
}
window.runAvailability = async () => {
  const q = new URLSearchParams();
  if ($('#av-from')?.value) q.set('from', $('#av-from').value);
  if ($('#av-to')?.value) q.set('to', $('#av-to').value);
  const r = await api('/reports/availability?' + q.toString());
  $('#view-container').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card success"><div class="label">Fleet availability</div><div class="value">${r.fleet_availability_pct}%</div></div>
      <div class="stat-card"><div class="label">Period hours</div><div class="value">${r.period.period_hours}</div></div>
      <div class="stat-card"><div class="label">From</div><div class="value" style="font-size:1rem">${r.period.from}</div></div>
      <div class="stat-card"><div class="label">To</div><div class="value" style="font-size:1rem">${r.period.to}</div></div>
    </div>
    <div class="card"><div class="card-header"><h3>By asset</h3></div>
      <table><thead><tr><th>Asset</th><th>Name</th><th>Status</th><th>Downtime (h)</th><th>Availability %</th></tr></thead>
      <tbody>${r.assets.map(a=>`<tr>
        <td><strong>${a.asset_code}</strong></td><td>${a.asset_name}</td>
        <td>${badge(a.status)}</td><td>${a.downtime_hours}</td>
        <td><strong>${a.availability_pct}%</strong></td>
      </tr>`).join('')}</tbody></table></div>`;
};
