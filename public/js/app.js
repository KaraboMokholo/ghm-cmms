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

function applyRoleNav() {
  const role = (CURRENT_USER && CURRENT_USER.role) || 'branch';
  const allow = {
    admin: null, // all
    store: ['dashboard','inventory','parts','movements','stocktake','requests','branches','pr','purchase','orders','quotes','jobs','boms','assets','services','reports','availability','forecast','invoices','suppliers'],
    branch: ['dashboard','inventory','parts','requests','branches','jobs','forecast','reports'],
    technician: ['dashboard','inventory','parts','jobs','assets','movements','reports']
  };
  const list = allow[role];
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    const v = btn.getAttribute('data-view');
    if (role === 'admin' || !list) {
      btn.style.display = '';
      return;
    }
    btn.style.display = list.includes(v) ? '' : 'none';
  });
  // show role on footer if present
  const foot = document.querySelector('.sidebar-footer');
  if (foot && CURRENT_USER) {
    foot.innerHTML = (CURRENT_USER.name || '') + '<br><span style="color:#888">' + role + '</span>';
  }
}

function showApp() {
  applyRoleNav();
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
      dashboard: renderDashboard, inventory: renderInventory, parts: renderPartsMaster, branches: renderBranches,
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

async function renderPartsMaster(container, actions) {
  actions.innerHTML = `<input id="parts-search" placeholder="Search part # or description..." style="min-width:180px"/>
    <button class="btn" onclick="showImportStock()">Import CSV</button>`;
  let list = await api('/parts');
  const draw = (items) => {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Parts info / catalogue (${items.length})</h3>
          <span style="font-size:0.8rem;color:var(--muted)">Click a row or Open to see full specs</span>
        </div>
        <table>
          <thead><tr>
            <th>Part #</th><th>Description</th><th>Category</th><th>UoM</th>
            <th>Cost</th><th>Supplier</th><th>Transfer?</th><th></th>
          </tr></thead>
          <tbody>
            ${items.slice(0, 200).map(p => `<tr>
              <td><strong><a href="#" style="color:var(--accent)" onclick="event.preventDefault();viewPartInfo(${p.id})">${p.part_number}</a></strong>
                <br><small style="color:var(--muted)">${(p.alternate_numbers||[]).slice(0,2).join(', ')}</small></td>
              <td>${p.description||'–'}</td>
              <td>${p.category||'–'}</td>
              <td>${p.unit||'EA'}</td>
              <td>R ${Number(p.unit_cost||0).toFixed(2)}</td>
              <td>${p.supplier_name||'–'}</td>
              <td>${p.cross_region_transfer!==false?'Yes':'No'}</td>
              <td><button type="button" class="btn btn-sm" onclick="viewPartInfo(${p.id})">Open info</button></td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">No parts</td></tr>'}
          </tbody>
        </table>
        ${items.length > 200 ? '<p class="empty">Showing first 200 — use search to narrow</p>' : ''}
      </div>`;
  };
  draw(list);
  const box = document.getElementById('parts-search');
  if (box) {
    box.oninput = () => {
      const q = (box.value || '').toLowerCase();
      if (!q) return draw(list);
      draw(list.filter(p =>
        (p.part_number || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.alternate_numbers || []).some(a => String(a).toLowerCase().includes(q))
      ));
    };
  }
}


async function renderInventory(container, actions) {
  const [branches, suppliers] = await Promise.all([api('/branches'), api('/suppliers')]);
  actions.innerHTML = `
    <select id="inv-branch">${branches.map(b=>`<option value="${b.id}" ${b.is_main?'selected':''}>${b.code}</option>`).join('')}</select>
    <button class="btn btn-outline" onclick="loadView('parts')">Parts catalogue</button>
    <button class="btn btn-outline" onclick="showImportStock()">Import CSV</button>
    <button class="btn" onclick="showStockMovement()">+ Movement</button>`;
  window._invMeta = { suppliers };
  await loadInv(container);
  $('#inv-branch').onchange = () => loadInv(container);
}

async function loadInv(container) {
  const branchId = $('#inv-branch')?.value || 1;
  const stock = await api(`/inventory?branch_id=${branchId}`);
  const cats = [...new Set(stock.map(s => s.category).filter(Boolean))].sort();
  const brands = [...new Set(stock.map(s => s.manufacturer).filter(Boolean))].sort();
  const suppliers = (window._invMeta && window._invMeta.suppliers) || [];
  container.innerHTML = `
    <div class="card"><div class="card-header"><h3>Branch stock</h3>
      <div class="filters" style="flex-wrap:wrap">
        <input id="inv-search" placeholder="Search part #..." style="min-width:120px"/>
        <select id="inv-cat"><option value="">All types</option>${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
        <select id="inv-sup"><option value="">All suppliers</option>${suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
        <select id="inv-brand"><option value="">All brands</option>${brands.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
        <input id="inv-machine" placeholder="Machine type..." style="min-width:110px"/>
        <label style="font-size:0.8rem"><input type="checkbox" id="inv-low"/> Low only</label>
      </div></div>
      <table><thead><tr>
        <th>Part # / Alt</th><th>Description</th><th>Type</th><th>Brand</th><th>Supplier</th>
        <th>Bin</th><th>Qty</th><th>Min</th><th>Status</th><th></th>
      </tr></thead>
      <tbody id="inv-tbody">${stockRows(stock)}</tbody></table></div>`;
  const apply = () => {
    const q = ($('#inv-search')?.value||'').toLowerCase();
    const low = $('#inv-low')?.checked;
    const cat = $('#inv-cat')?.value || '';
    const sup = $('#inv-sup')?.value || '';
    const brand = ($('#inv-brand')?.value || '').toLowerCase();
    const machine = ($('#inv-machine')?.value || '').toLowerCase();
    $('#inv-tbody').innerHTML = stockRows(stock.filter(s => {
      if (q && !(s.part_number||'').toLowerCase().includes(q) && !(s.description||'').toLowerCase().includes(q)
          && !(s.alternate_numbers||[]).some(a => String(a).toLowerCase().includes(q))) return false;
      if (low && s.quantity > (s.min_stock||0)) return false;
      if (cat && s.category !== cat) return false;
      if (sup && String(s.supplier_id) !== String(sup)) return false;
      if (brand && !(s.manufacturer||'').toLowerCase().includes(brand)) return false;
      if (machine && !(s.applicable_machines||[]).some(a => String(a).toLowerCase().includes(machine))) return false;
      return true;
    }));
  };
  ['inv-search','inv-cat','inv-sup','inv-brand','inv-machine','inv-low'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'inv-search' || id === 'inv-machine' ? 'input' : 'change', apply);
  });
}

window.showImportStock = function () {
  openModal('Import parts & opening stock (CSV)', `
    <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem">
      Excel: save sheet as <strong>CSV</strong>, then upload. Or paste CSV below.<br/>
      Required: <code>part_number</code>, <code>description</code>. Optional: category, unit, unit_cost, min_stock, max_stock,
      supplier_name, manufacturer, quantity, bin_location, branch_code, alternate_numbers, applicable_machines
    </p>
    <div class="form-group">
      <label>Upload CSV file</label>
      <input type="file" id="import-file" accept=".csv,text/csv"/>
    </div>
    <div class="form-group">
      <label>Or paste CSV</label>
      <textarea id="import-text" rows="8" style="width:100%;font-family:monospace;font-size:0.75rem"
        placeholder="part_number,description,category,unit_cost,min_stock,quantity,supplier_name,manufacturer&#10;FIL-100,Oil filter,Filters,120,5,20,Donaldson,CAT"></textarea>
    </div>
    <label style="font-size:0.85rem"><input type="checkbox" id="import-update" checked/> Update existing part numbers</label>
    <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
      <button type="button" class="btn" id="import-run">Import</button>
      <button type="button" class="btn btn-outline" id="import-template">Download template</button>
    </div>
    <pre id="import-result" style="margin-top:0.75rem;font-size:0.8rem;white-space:pre-wrap"></pre>
  `);
  document.getElementById('import-template').onclick = () => {
    const hdr = 'part_number,description,category,unit,unit_cost,min_stock,max_stock,supplier_name,manufacturer,quantity,bin_location,branch_code,alternate_numbers,applicable_machines\\n';
    const sample = 'DEMO-001,Demo filter,Filters,EA,150,5,40,Donaldson,CAT,25,A-01-01,MAIN,ALT-1;OEM-9,Wheel Loader;Forklift\\n';
    const blob = new Blob([hdr + sample], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ghm-parts-import-template.csv';
    a.click();
  };
  document.getElementById('import-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    document.getElementById('import-text').value = await f.text();
  };
  document.getElementById('import-run').onclick = async () => {
    const text = document.getElementById('import-text').value || '';
    const rows = parseCsv(text);
    if (!rows.length) return alert('No data rows found');
    try {
      const r = await api('/parts/import', {
        method: 'POST',
        body: JSON.stringify({ rows, update_existing: document.getElementById('import-update').checked })
      });
      document.getElementById('import-result').textContent =
        `Created: ${r.created} | Updated: ${r.updated} | Stock lines: ${r.stocked} | Errors: ${r.error_count}` +
        (r.errors && r.errors.length ? '\\n' + JSON.stringify(r.errors, null, 2) : '');
      if (r.created || r.updated) setTimeout(() => { closeModal(); loadView('inventory'); }, 1500);
    } catch (err) { alert(err.message); }
  };
};

function parseCsv(text) {
  const lines = text.replace(/^\\uFEFF/, '').trim().split(/\\r?\\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map(h => h.toLowerCase().replace(/\\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    if (!cols[0]) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] != null ? cols[idx] : ''; });
    rows.push(row);
  }
  return rows;
}
function stockRows(stock) {
  if (!stock.length) return '<tr><td colspan="10" class="empty">No stock</td></tr>';
  return stock.map(s => {
    const alts = (s.alternate_numbers || []).join(', ') || '–';
    const pid = s.part_id || s.id;
    return `<tr>
    <td>
      <a href="#" onclick="event.preventDefault();viewPartInfo(${pid})" style="color:var(--accent);font-weight:700;text-decoration:underline">${s.part_number}</a>
      <br><small style="color:var(--muted)">Alt: ${alts}</small>
    </td>
    <td>${s.description||'–'}</td>
    <td>${s.category||'–'}</td>
    <td>${s.manufacturer||'–'}</td>
    <td>${s.supplier_name||'–'}</td>
    <td>${s.bin_location||'–'}</td>
    <td>${s.quantity<=(s.min_stock||0)?`<span class="badge badge-low">${s.quantity}</span>`:s.quantity}</td>
    <td>${s.min_stock||0}</td>
    <td>${badge(s.status||'Available')}</td>
    <td>
      <button type="button" class="btn btn-sm" onclick="viewPartInfo(${pid})">Info</button>
    </td>
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




window.viewPartInfo = async function (partId) {
  const p = await api('/parts/' + partId);
  const stockRows = (p.stock_by_branch || []).map(s =>
    `<tr><td>${s.branch_code||'–'}</td><td>${s.bin_location||'–'}</td><td>${s.quantity}</td><td>${badge(s.status||'Available')}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty">No stock lines</td></tr>';
  const subs = (p.substitutes || []).map(s =>
    `${s.part_number} – ${s.description||''}`
  ).join('<br>') || '–';
  const machines = (p.applicable_machines || []).join(', ') || '–';
  const alts = (p.alternate_numbers || []).join(', ') || '–';
  const movs = (p.recent_movements || []).slice(0, 8).map(m =>
    `<tr>
      <td>${new Date(m.created_at).toLocaleDateString()}</td>
      <td>${m.doc_type||m.movement_type}</td>
      <td>${m.quantity}</td>
      <td>${m.lot_serial||'–'}</td>
      <td>${m.user_name||'–'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="5" class="empty">No movements</td></tr>';

  openModal('Part info – ' + p.part_number, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1rem;font-size:0.88rem;margin-bottom:0.75rem">
      <div><strong>Description</strong><br>${p.description||'–'}</div>
      <div><strong>Category</strong><br>${p.category||'–'}</div>
      <div><strong>UoM</strong><br>${p.unit||'EA'}${p.uom_secondary ? ' / ' + p.uom_secondary : ''}</div>
      <div><strong>Status / Reclass</strong><br>${p.status||'–'} · ${p.reclass_status||'–'}</div>
      <div><strong>Cost price</strong><br>R ${Number(p.unit_cost||0).toFixed(2)}</div>
      <div><strong>Selling price</strong><br>${p.selling_price!=null?'R '+Number(p.selling_price).toFixed(2):'–'}</div>
      <div><strong>Supplier</strong><br>${p.supplier_name||'–'}</div>
      <div><strong>Manufacturer</strong><br>${p.manufacturer||'–'}</div>
      <div><strong>Weight</strong><br>${p.weight!=null?p.weight:'–'}</div>
      <div><strong>Dimensions</strong><br>${p.dimensions||'–'}</div>
      <div><strong>EOQ</strong><br>${p.eoq!=null?p.eoq:'–'}</div>
      <div><strong>Lead time (days)</strong><br>${p.lead_time_days!=null?p.lead_time_days:'–'}</div>
      <div><strong>Min / Max / Safety</strong><br>${p.min_stock||0} / ${p.max_stock||0} / ${p.safety_stock||0}</div>
      <div><strong>Cross-region transfer</strong><br>${p.cross_region_transfer!==false?'Yes':'No'}</div>
      <div><strong>Barcode</strong><br>${p.barcode||'–'}</div>
      <div><strong>Alternates</strong><br>${alts}</div>
      <div class="full" style="grid-column:1/-1"><strong>Specs</strong><br>${p.specs||'–'}</div>
      <div class="full" style="grid-column:1/-1"><strong>Applicable machines</strong><br>${machines}</div>
      <div class="full" style="grid-column:1/-1"><strong>Substitutes (if out of stock)</strong><br>${subs}</div>
      <div class="full" style="grid-column:1/-1"><strong>Notes</strong><br>${p.notes_master||'–'}</div>
    </div>
    <h4 style="margin:0.5rem 0;font-size:0.9rem">Stock by branch</h4>
    <table><thead><tr><th>Branch</th><th>Bin</th><th>Qty</th><th>Status</th></tr></thead>
    <tbody>${stockRows}</tbody></table>
    <h4 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">Recent movements</h4>
    <table><thead><tr><th>Date</th><th>Doc</th><th>Qty</th><th>Lot</th><th>By</th></tr></thead>
    <tbody>${movs}</tbody></table>
    <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
      <button class="btn" onclick="editPartFull(${p.id})">Edit part info</button>
      <button class="btn btn-outline" onclick="closeModal(); trackPartMovements(${p.id}, '${(p.part_number||'').replace(/'/g,"\\'")}')">Track this part</button>
    </div>
  `);
};

window.editPartFull = async function (partId) {
  const p = await api('/parts/' + partId);
  const allParts = await api('/parts');
  const machinesStr = (p.applicable_machines || []).join(', ');
  const altsStr = (p.alternate_numbers || []).join(', ');
  const subStr = (p.substitute_part_ids || []).join(', ');
  openModal('Edit part – ' + p.part_number, `
    <form id="part-full-form" style="max-height:70vh;overflow:auto">
      <div class="form-grid">
        <div class="form-group"><label>Description</label><input name="description" value="${(p.description||'').replace(/"/g,'&quot;')}"/></div>
        <div class="form-group"><label>Category</label><input name="category" value="${p.category||''}"/></div>
        <div class="form-group"><label>UoM</label><input name="unit" value="${p.unit||'EA'}"/></div>
        <div class="form-group"><label>Secondary UoM</label><input name="uom_secondary" value="${p.uom_secondary||''}"/></div>
        <div class="form-group"><label>Cost price (R)</label><input name="unit_cost" type="number" step="0.01" value="${p.unit_cost||0}"/></div>
        <div class="form-group"><label>Selling price (R)</label><input name="selling_price" type="number" step="0.01" value="${p.selling_price??''}"/></div>
        <div class="form-group"><label>Weight</label><input name="weight" type="number" step="0.001" value="${p.weight??''}"/></div>
        <div class="form-group"><label>Dimensions</label><input name="dimensions" value="${p.dimensions||''}" placeholder="L x W x H"/></div>
        <div class="form-group"><label>EOQ</label><input name="eoq" type="number" value="${p.eoq??''}"/></div>
        <div class="form-group"><label>Lead time (days)</label><input name="lead_time_days" type="number" value="${p.lead_time_days??''}"/></div>
        <div class="form-group"><label>Min stock</label><input name="min_stock" type="number" value="${p.min_stock||0}"/></div>
        <div class="form-group"><label>Max stock</label><input name="max_stock" type="number" value="${p.max_stock||0}"/></div>
        <div class="form-group"><label>Safety stock</label><input name="safety_stock" type="number" value="${p.safety_stock||0}"/></div>
        <div class="form-group"><label>Manufacturer</label><input name="manufacturer" value="${p.manufacturer||''}"/></div>
        <div class="form-group"><label>Barcode</label><input name="barcode" value="${p.barcode||''}"/></div>
        <div class="form-group"><label>Cross-region transfer</label>
          <select name="cross_region_transfer">
            <option value="true" ${p.cross_region_transfer!==false?'selected':''}>Yes</option>
            <option value="false" ${p.cross_region_transfer===false?'selected':''}>No</option>
          </select>
        </div>
        <div class="form-group full"><label>Specs</label><textarea name="specs" rows="2" style="width:100%">${p.specs||''}</textarea></div>
        <div class="form-group full"><label>Alternate numbers (comma)</label><input name="alternate_numbers" value="${altsStr}"/></div>
        <div class="form-group full"><label>Applicable machines (comma)</label><input name="applicable_machines" value="${machinesStr}" placeholder="CAT 950M, Forklift 8FG25"/></div>
        <div class="form-group full"><label>Substitute part IDs (comma, if out of stock)</label>
          <input name="substitute_part_ids" value="${subStr}" placeholder="e.g. 12, 45"/>
          <small style="color:var(--muted)">Use part IDs from inventory; or leave blank</small>
        </div>
        <div class="form-group full"><label>Notes</label><input name="notes_master" value="${(p.notes_master||'').replace(/"/g,'&quot;')}"/></div>
      </div>
      <button class="btn" type="submit">Save part info</button>
    </form>`);
  document.getElementById('part-full-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api('/parts/' + partId, { method: 'PATCH', body: JSON.stringify(body) });
      alert('Part info saved');
      closeModal();
      viewPartInfo(partId);
    } catch (err) { alert(err.message); }
  };
};

window.trackPartMovements = async function (partId, partNumber) {
  loadView('reports');
  setTimeout(() => {
    const sel = document.getElementById('rpt-part');
    if (sel) {
      // ensure option exists
      let opt = [...sel.options].find(o => o.value == partId);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = partId;
        opt.textContent = partNumber || ('Part ' + partId);
        sel.appendChild(opt);
      }
      sel.value = String(partId);
    }
    if (typeof runReport === 'function') runReport();
  }, 400);
};


window.showStockMovement = async function () {
  const [branches, parts, jobs] = await Promise.all([
    api('/branches'),
    api('/parts'),
    api('/job-cards?upcoming=true').catch(() => [])
  ]);
  openModal('Stock Movement', `
    <form id="mov-form">
      <div class="form-group"><label>Branch</label>
        <select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code} – ${b.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Part</label>
        <div id="mov-part-search"></div>
        <input type="hidden" name="part_id" id="mov-part-id" value=""/></div>
      <div class="form-group"><label>Type</label>
        <select name="movement_type" id="mov-type">
          <option value="RECEIVE">Receive</option>
          <option value="ISSUE">Issue to job</option>
          <option value="PICK">Pick</option>
          <option value="TRANSFER_OUT">Transfer out</option>
          <option value="TRANSFER_IN">Transfer in</option>
          <option value="ADJUST">Adjust</option>
          <option value="RETURN">Return</option>
        </select></div>
      <div class="form-group"><label>Doc type (optional)</label>
        <input name="doc_type" id="mov-doc" placeholder="e.g. IM, IR"/></div>
      <div class="form-group"><label>Quantity</label>
        <input name="quantity" type="number" step="0.01" min="0.01" value="1" required/></div>
      <div class="form-group"><label>Unit cost (R)</label>
        <input name="unit_cost" id="mov-cost" type="number" step="0.01" min="0" value="0"/></div>
      <div class="form-group"><label>Lot / serial</label>
        <input name="lot_serial" placeholder="Optional"/></div>
      <div class="form-group"><label>From bin</label><input name="from_bin"/></div>
      <div class="form-group"><label>To bin</label><input name="to_bin"/></div>
      <div class="form-group"><label>Job card (if issuing)</label>
        <select name="job_id"><option value="">– None –</option>${(jobs||[]).map(j=>`<option value="${j.id}">${j.job_number} – ${j.title}</option>`).join('')}</select></div>
      <div class="form-group"><label>Reference</label><input name="reference"/></div>
      <div class="form-group"><label>Notes</label><input name="notes"/></div>
      <button type="submit" class="btn">Post</button>
    </form>`);
  const costInp = document.getElementById('mov-cost');
  mountPartSearch(document.getElementById('mov-part-search'), parts, {
    hiddenName: 'part_id_ui',
    onSelect: ({ id, cost }) => {
      document.getElementById('mov-part-id').value = id;
      if (costInp && (!costInp.value || costInp.value === '0')) costInp.value = cost || 0;
    }
  });
  // sync hidden into form field name part_id
  document.getElementById('mov-form').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.part_id = +document.getElementById('mov-part-id').value;
    if (!body.part_id) return alert('Select a part (type to search)');
    body.branch_id = +body.branch_id;
    body.quantity = +body.quantity;
    body.unit_cost = body.unit_cost !== '' ? +body.unit_cost : undefined;
    if (body.job_id) body.job_id = +body.job_id; else delete body.job_id;
    if (!body.doc_type) delete body.doc_type;
    if (!body.lot_serial) delete body.lot_serial;
    try {
      const r = await api('/movements', { method: 'POST', body: JSON.stringify(body) });
      alert('Posted · ' + r.transfer_code);
      closeModal();
      loadView('movements');
    } catch (err) { alert(err.message); }
  };
};

// ── Branches ──
async function renderBranches(container) {
  const branches = await api('/branches');
  let html = '<p style="margin-bottom:0.75rem;color:var(--muted);font-size:0.9rem">Click a branch to open its inventory.</p><div class="stats-grid">';
  for (const b of branches) {
    const stock = await api(`/branches/${b.id}/stock`);
    const low = stock.filter(s => s.quantity <= (s.min_stock||0)).length;
    const totalQty = stock.reduce((n, s) => n + (s.quantity || 0), 0);
    html += `<div class="stat-card ${low?'warning':''}" role="button" tabindex="0"
      style="cursor:pointer;transition:box-shadow 0.15s"
      onclick="openBranchInventory(${b.id}, '${(b.code||'').replace(/'/g,"\'")}')"
      onmouseover="this.style.boxShadow='0 0 0 2px var(--accent)'"
      onmouseout="this.style.boxShadow='none'">
      <div class="label">${b.code}${b.is_main ? ' · MAIN' : ''}</div>
      <div class="value" style="font-size:1.05rem">${b.name}</div>
      <div style="margin-top:0.4rem;font-size:0.8rem;color:var(--muted)">
        ${stock.length} part lines · ${totalQty} total qty · ${low} low
      </div>
      <div style="margin-top:0.5rem;font-size:0.78rem;color:var(--accent);font-weight:600">Open inventory →</div>
    </div>`;
  }
  html += '</div>';
  // recent requests summary
  try {
    const reqs = await api('/requests');
    const pending = reqs.filter(r => r.status === 'PENDING').slice(0, 5);
    html += `<div class="card" style="margin-top:1rem"><div class="card-header"><h3>Pending branch requests</h3>
      <button class="btn btn-sm" onclick="loadView('requests')">All requests</button></div>
      <table><thead><tr><th>REQ</th><th>TFR</th><th>From</th><th>Lines</th><th>Status</th></tr></thead>
      <tbody>${pending.length ? pending.map(r => `<tr>
        <td>${r.request_code}</td><td><strong>${r.transfer_code||'–'}</strong></td>
        <td>${r.from_branch_code}</td><td>${r.item_count||1}</td><td>${badge(r.status)}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">None pending</td></tr>'}</tbody></table></div>`;
  } catch (e) {}
  container.innerHTML = html;
}

window.openBranchInventory = function (branchId, code) {
  // Jump to inventory and select branch
  loadView('inventory');
  setTimeout(() => {
    const sel = document.getElementById('inv-branch');
    if (sel) {
      sel.value = String(branchId);
      sel.dispatchEvent(new Event('change'));
    }
    const title = document.getElementById('page-title');
    if (title) title.textContent = 'Inventory – ' + (code || branchId);
  }, 300);
};


// ── Requests ──
async function renderRequests(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="showNewRequest()">Parts request</button>`;
  const requests = await api('/requests');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Branch requests</h3></div>
    <table><thead><tr>
      <th>Request</th><th>TFR code</th><th>From</th><th>Lines</th><th>Priority</th><th>Status</th><th>By</th><th></th>
    </tr></thead>
    <tbody>${requests.map(r => `<tr>
      <td><strong>${r.request_code}</strong>
        <br><small style="color:var(--muted)">${r.needed_by ? 'Need by '+r.needed_by : ''}</small></td>
      <td><strong>${r.transfer_code || '–'}</strong></td>
      <td>${r.from_branch_code || '–'}</td>
      <td>${r.item_count || 1} part(s)
        <br><small>${r.part_number || ''}${r.item_count > 1 ? ' +…' : ''}</small></td>
      <td>${badge(r.priority || 'Normal')}</td>
      <td>${badge(r.status)}</td>
      <td>${r.requested_by || '–'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewRequest(${r.id})">Open</button>
        ${r.status==='PENDING'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'APPROVED')">Approve</button>
        <button class="btn btn-sm btn-outline" onclick="updateRequest(${r.id},'REJECTED')">Reject</button>`:''}
        ${r.status==='APPROVED'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'SHIPPED')">Ship</button>`:''}
        ${r.status==='SHIPPED'?`<button class="btn btn-sm" onclick="updateRequest(${r.id},'RECEIVED')">Receive</button>`:''}
      </td>
    </tr>`).join('')||'<tr><td colspan="8" class="empty">None</td></tr>'}</tbody></table></div>`;
}

window.viewRequest = async function (id) {
  const r = await api('/requests/' + id);
  const lines = (r.items || []).map(it => `<tr>
    <td>${it.part_number || it.part_id}</td>
    <td>${it.description || '–'}</td>
    <td>${it.quantity}</td>
    <td>${it.main_qty != null ? it.main_qty : '–'}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="empty">No lines</td></tr>';
  openModal(r.request_code, `
    <p style="margin-bottom:0.75rem;font-size:0.9rem">
      <strong>TFR:</strong> ${r.transfer_code || '–'} ·
      <strong>From:</strong> ${r.from_branch_code} ·
      <strong>To:</strong> ${r.to_branch_code || 'MAIN'} ·
      <strong>Status:</strong> ${badge(r.status)} ·
      <strong>Priority:</strong> ${r.priority || 'Normal'}<br/>
      <strong>By:</strong> ${r.requested_by || '–'} ·
      <strong>Needed by:</strong> ${r.needed_by || '–'}<br/>
      <strong>Notes:</strong> ${r.notes || '–'}
      ${r.line_transfer_codes ? '<br/><strong>Line TFRs:</strong> ' + r.line_transfer_codes.join(', ') : ''}
    </p>
    <table><thead><tr><th>Part</th><th>Description</th><th>Qty requested</th><th>Main on hand</th></tr></thead>
    <tbody>${lines}</tbody></table>
  `);
};

window.updateRequest = async (id, status) => {
  try {
    const r = await api(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    let msg = 'Status: ' + (r.status || status);
    if (r.transfer_code) msg += '\\nHeader TFR: ' + r.transfer_code;
    if (r.line_transfer_codes && r.line_transfer_codes.length) {
      msg += '\\nLine TFRs:\\n' + r.line_transfer_codes.join('\\n');
    }
    alert(msg);
    loadView('requests');
  } catch (e) { alert(e.message); }
};

window.showNewRequest = async () => {
  const [branches, parts] = await Promise.all([api('/branches'), api('/parts')]);
  const branchOpts = branches.filter(b => !b.is_main).map(b =>
    `<option value="${b.id}">${b.code} – ${b.name}</option>`
  ).join('');
  const partOpts = parts.slice(0, 500).map(p =>
    `<option value="${p.id}">${p.part_number} – ${(p.description||'').slice(0,35)}</option>`
  ).join('');

  openModal('New branch request (multiple parts)', `
    <form id="req-form">
      <div class="form-group"><label>Requesting branch</label>
        <select name="from_branch_id">${branchOpts}</select></div>
      <div class="form-group"><label>Priority</label>
        <select name="priority">
          <option>Normal</option><option>High</option><option>Urgent</option>
        </select></div>
      <div class="form-group"><label>Needed by</label>
        <input name="needed_by" type="date"/></div>
      <div class="form-group"><label>Notes</label>
        <input name="notes" placeholder="Optional"/></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0.6rem 0 0.3rem">
        <strong>Parts</strong>
        <button type="button" class="btn btn-sm" id="req-add-line">+ Add part</button>
      </div>
      <table><thead><tr><th>Part</th><th>Qty</th><th></th></tr></thead>
      <tbody id="req-lines">
        <tr>
          <td><select class="req-part">${partOpts}</select></td>
          <td><input class="req-qty" type="number" min="1" value="1" style="width:70px"/></td>
          <td><button type="button" class="btn btn-sm btn-outline req-rm">×</button></td>
        </tr>
      </tbody></table>
      <p style="font-size:0.8rem;color:var(--muted);margin:0.5rem 0">A TFR code is assigned when you create the request.</p>
      <button class="btn" type="submit">Submit request</button>
    </form>`);

  const tbody = document.getElementById('req-lines');
  function bindRm(tr) {
    tr.querySelector('.req-rm').onclick = () => {
      if (tbody.querySelectorAll('tr').length <= 1) return alert('Keep at least one part');
      tr.remove();
    };
  }
  tbody.querySelectorAll('tr').forEach(bindRm);
  document.getElementById('req-add-line').onclick = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select class="req-part">${partOpts}</select></td>
      <td><input class="req-qty" type="number" min="1" value="1" style="width:70px"/></td>
      <td><button type="button" class="btn btn-sm btn-outline req-rm">×</button></td>`;
    tbody.appendChild(tr);
    bindRm(tr);
  };
  document.getElementById('req-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      items.push({
        part_id: +tr.querySelector('.req-part').value,
        quantity: +tr.querySelector('.req-qty').value
      });
    });
    try {
      const r = await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          from_branch_id: +fd.get('from_branch_id'),
          priority: fd.get('priority'),
          needed_by: fd.get('needed_by') || null,
          notes: fd.get('notes') || null,
          items
        })
      });
      alert('Request created\\n' + r.request_code + '\\nTFR: ' + (r.transfer_code || '–'));
      closeModal();
      loadView('requests');
    } catch (err) { alert(err.message); }
  };
};

// ── Movements ──
async function renderMovements(container) {
  const list = await api('/movements?limit=150');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Inventory movements</h3></div>
    <table><thead><tr>
      <th>Date / who</th><th>Doc type</th><th>Transfer</th><th>Branch</th><th>Part</th>
      <th>Qty</th><th>Lot/Serial</th><th>Unit cost</th><th>Extended</th><th>Type</th>
    </tr></thead>
    <tbody>${list.map(m=>`<tr>
      <td><strong>${m.user_name||m.performed_by||'–'}</strong>
        <br><small style="color:var(--muted)">${new Date(m.created_at).toLocaleString()}</small>
        <br><small>${m.summary ? '' : ''}</small></td>
      <td><strong>${m.doc_type||'–'}</strong>
        <br><small style="color:var(--muted)">${m.doc_type_name||''}</small></td>
      <td><strong>${m.transfer_code||'–'}</strong></td>
      <td>${m.branch_code||'–'}
        <br><small>${m.from_bin||m.to_bin||''}</small></td>
      <td>${m.part_number||'–'}
        <br><small style="color:var(--muted)">${(m.description||'').slice(0,40)}</small></td>
      <td>${m.quantity}</td>
      <td>${m.lot_serial||'–'}</td>
      <td>R ${Number(m.unit_cost||0).toFixed(2)}</td>
      <td>R ${Number(m.extended_cost||0).toFixed(2)}</td>
      <td>${badge(m.movement_type)}</td>
    </tr>`).join('')||'<tr><td colspan="10" class="empty">None</td></tr>'}</tbody></table></div>`;
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
  let parts = [];
  try { parts = await api('/parts'); } catch (e) {}
  actions.innerHTML = `
    <input type="date" id="rpt-from" title="From"/>
    <input type="date" id="rpt-to" title="To"/>
    <select id="rpt-group">
      <option value="summary">Summary + groups</option>
      <option value="type">Group by movement type</option>
      <option value="doc_type">Group by ERP doc code</option>
    </select>
    <select id="rpt-part" style="max-width:160px">
      <option value="">All parts</option>
      ${parts.slice(0, 400).map(p => `<option value="${p.id}">${p.part_number}</option>`).join('')}
    </select>
    <button class="btn" onclick="runReport()">Run Report</button>`;
  container.innerHTML = `<div class="empty">
    <p>Choose a period (optional), then <strong>Run Report</strong>.</p>
    <p style="margin-top:0.5rem;font-size:0.9rem;color:var(--muted)">
      • Summary groups stock in / out / transfers / adjustments<br/>
      • Or group by type / ERP code (IM, IR, IT…)<br/>
      • Or pick one part to see its full movement history
    </p>
  </div>`;
}

window.runReport = async () => {
  const from = $('#rpt-from')?.value || '';
  const to = $('#rpt-to')?.value || '';
  const group = $('#rpt-group')?.value || 'summary';
  const partId = $('#rpt-part')?.value || '';

  // Single part history
  if (partId) {
    const q = new URLSearchParams({ part_id: partId, limit: '300' });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const list = await api('/movements?' + q.toString());
    const part = (await api('/parts/' + partId).catch(() => null));
    const title = part ? (part.part_number + ' – ' + (part.description || '')) : ('Part #' + partId);
    $('#view-container').innerHTML = `
      <div class="card"><div class="card-header">
        <h3>Movement history – ${title}</h3>
        <span>${Array.isArray(list) ? list.length : 0} lines</span>
      </div>
      <table><thead><tr>
        <th>Date</th><th>Who</th><th>Doc</th><th>Type</th><th>Branch</th>
        <th>Qty</th><th>Lot</th><th>Unit cost</th><th>Extended</th><th>Transfer</th><th>Ref</th>
      </tr></thead>
      <tbody>${(Array.isArray(list)?list:[]).map(m => `<tr>
        <td>${new Date(m.created_at).toLocaleString()}</td>
        <td>${m.user_name||m.performed_by||'–'}</td>
        <td><strong>${m.doc_type||'–'}</strong></td>
        <td>${badge(m.movement_type)}</td>
        <td>${m.branch_code||'–'}</td>
        <td>${m.quantity}</td>
        <td>${m.lot_serial||'–'}</td>
        <td>R ${Number(m.unit_cost||0).toFixed(2)}</td>
        <td>R ${Number(m.extended_cost||0).toFixed(2)}</td>
        <td>${m.transfer_code||'–'}</td>
        <td>${m.reference||'–'}</td>
      </tr>`).join('')||'<tr><td colspan="11" class="empty">No movements for this part in the period</td></tr>'}
      </tbody></table></div>`;
    return;
  }

  // Grouped by type / doc_type
  if (group === 'type' || group === 'doc_type') {
    const q = new URLSearchParams({ group, limit: '500' });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const r = await api('/movements?' + q.toString());
    const blocks = (r.groups || []).map(g => `
      <div class="card">
        <div class="card-header">
          <h3>${g.key}</h3>
          <span>${g.count} moves · qty ${g.total_qty} · R ${Number(g.total_extended||0).toFixed(2)}</span>
        </div>
        ${reportTable('', g.movements)}
      </div>`).join('') || '<div class="empty">No movements</div>';
    $('#view-container').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Groups</div><div class="value">${(r.groups||[]).length}</div></div>
        <div class="stat-card"><div class="label">Total lines</div><div class="value">${(r.groups||[]).reduce((s,g)=>s+g.count,0)}</div></div>
      </div>
      ${blocks}`;
    return;
  }

  // Default summary
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
    ${reportTable('Stock In (IR – Receive / Transfer In / Return)', r.stock_in)}
    ${reportTable('Stock Out (IM / IL – Issue / Pick / Transfer Out)', r.stock_out)}
    ${reportTable('Adjustments (IA)', r.adjustments)}
    ${reportTable('Inter-branch Transfers (IT)', r.inter_branch)}
    ${reportTable('Services Issued to jobs (IM)', r.services_issued)}
    <div class="card"><div class="card-header"><h3>Purchase Orders</h3></div>
      <table><thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Total</th></tr></thead>
      <tbody>${(r.purchase_orders||[]).map(p=>`<tr><td>${p.po_number}</td><td>${p.supplier_name||'–'}</td><td>${badge(p.status)}</td><td>${p.order_date||'–'}</td><td>R ${Number(p.total_amount).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">None</td></tr>'}
      </tbody></table></div>`;
};

function reportTable(title, rows) {
  return `<div class="card"><div class="card-header"><h3>${title}</h3></div>
    <table><thead><tr>
      <th>What happened</th><th>Doc</th><th>Transfer</th><th>Branch</th>
      <th>Lot</th><th>Unit cost</th><th>Extended</th><th>Type</th>
    </tr></thead>
    <tbody>${(rows||[]).length?rows.map(m=>`<tr>
      <td><strong>${m.summary || ((m.user_name||m.performed_by||'Someone') + ' — ' + m.quantity + ' × ' + (m.part_number||''))}</strong>
        <br><small style="color:var(--muted)">${new Date(m.created_at).toLocaleString()}</small></td>
      <td><strong>${m.doc_type||'–'}</strong></td>
      <td>${m.transfer_code||'–'}</td>
      <td>${m.branch_code||'–'}</td>
      <td>${m.lot_serial||'–'}</td>
      <td>R ${Number(m.unit_cost||0).toFixed(2)}</td>
      <td>R ${Number(m.extended_cost||0).toFixed(2)}</td>
      <td>${badge(m.movement_type)}</td>
    </tr>`).join(''):'<tr><td colspan="8" class="empty">None in period</td></tr>'}</tbody></table></div>`;
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
    <button class="btn" onclick="generateReorderPOs()">Generate POs (below min)</button>
    <button class="btn btn-outline" onclick="createOrderFromForecast()">Order list (critical/low)</button>`;
  const data = await api('/forecast');
  const list = Array.isArray(data) ? data : (data.items || []);
  const sum = data.summary || {};
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Season</div><div class="value" style="font-size:1rem">${data.season_month || '–'} × ${data.season_factor != null ? data.season_factor : '–'}</div></div>
      <div class="stat-card warning"><div class="label">Critical</div><div class="value">${sum.critical ?? 0}</div></div>
      <div class="stat-card"><div class="label">Low</div><div class="value">${sum.low ?? 0}</div></div>
      <div class="stat-card"><div class="label">Stockout risk ≥50%</div><div class="value">${sum.high_stockout_risk ?? 0}</div></div>
      <div class="stat-card"><div class="label">Avg confidence</div><div class="value">${sum.avg_confidence_pct ?? 0}%</div></div>
    </div>
    <div class="card"><div class="card-header"><h3>Demand forecast</h3></div>
    <table><thead><tr>
      <th>Urgency</th><th>Part</th><th>On hand</th><th>30d use</th><th>Seasonal daily</th>
      <th>30d forecast</th><th>Cover</th><th>Stockout %</th><th>Confidence</th><th>Order</th><th>Peak</th>
    </tr></thead>
    <tbody>${list.slice(0,200).map(f=>`<tr>
      <td>${badge(f.urgency)}</td>
      <td><strong>${f.part_number}</strong><br><small>${(f.description||'').slice(0,36)}</small></td>
      <td>${f.quantity}</td>
      <td>${f.used_last_30_days}</td>
      <td>${f.seasonal_daily_use ?? f.avg_daily_use}</td>
      <td>${f.forecast_30_day ?? '–'}</td>
      <td>${f.days_of_cover}</td>
      <td><strong>${f.stockout_probability_30d ?? '–'}%</strong></td>
      <td>${f.confidence_pct ?? '–'}%</td>
      <td>${f.suggested_order_qty||0}</td>
      <td>${f.peak_season_month||'–'}</td>
    </tr>`).join('')||'<tr><td colspan="11" class="empty">No data</td></tr>'}</tbody></table></div>`;
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
  const data = await api('/forecast');
  const list = Array.isArray(data) ? data : (data.items || []);
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
    <table><thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Total</th><th></th></tr></thead>
    <tbody>${pos.map(p=>`<tr>
      <td><strong>${p.po_number}</strong></td><td>${p.supplier_name||'–'}</td><td>${badge(p.status)}</td>
      <td>${p.order_date||'–'}</td><td>R ${Number(p.total_amount).toFixed(2)}</td>
      <td><button class="btn btn-sm" onclick="printPO(${p.id})">Download</button></td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">None</td></tr>'}</tbody></table></div>`;
}

async function renderInvoices(container, actions) {
  if (actions) actions.innerHTML = `<button class="btn" onclick="showNewInvoice()">+ Invoice</button>`;
  const list = await api('/invoices');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Invoices</h3></div>
    <table><thead><tr><th>#</th><th>Customer</th><th>PO</th><th>Status</th><th>Total</th><th></th></tr></thead>
    <tbody>${list.map(i=>`<tr>
      <td><strong>${i.invoice_number}</strong></td><td>${i.customer_name||'–'}</td><td>${i.po_number||i.external_po||'–'}</td>
      <td>${badge(i.status)}</td><td>R ${Number(i.total_amount).toFixed(2)}</td>
      <td>
        <button class="btn btn-sm" onclick="printInvoice(${i.id})">Download</button>
        ${i.status==='DRAFT'?`<button class="btn btn-sm btn-outline" onclick="patchInvoice(${i.id},'SENT')">Mark sent</button>`:''}
        ${i.status==='SENT'?`<button class="btn btn-sm btn-outline" onclick="patchInvoice(${i.id},'PAID')">Mark paid</button>`:''}
      </td>
    </tr>`).join('')||'<tr><td colspan="6" class="empty">None yet — create one</td></tr>'}</tbody></table></div>`;
}
window.patchInvoice = async (id, status) => {
  try {
    await api('/invoices/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadView('invoices');
  } catch (e) { alert(e.message); }
};
window.showNewInvoice = async () => {
  const [parts, pos] = await Promise.all([
    api('/parts'),
    api('/purchase-orders').catch(() => [])
  ]);
  openModal('New invoice', `
    <form id="inv-form">
      <div class="form-group"><label>Customer</label><input name="customer_name" required placeholder="Customer / company name"/></div>
      <div class="form-group"><label>Their PO number (optional)</label><input name="external_po" placeholder="Customer PO #"/></div>
      <div class="form-group"><label>Link internal PO (optional)</label>
        <select name="po_id"><option value="">– None –</option>${(pos||[]).map(p=>`<option value="${p.id}">${p.po_number}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Due date</label><input name="due_date" type="date"/></div>
      <div class="form-group"><label>Notes</label><input name="notes"/></div>
      <div style="display:flex;justify-content:space-between;margin:0.5rem 0">
        <strong>Lines</strong>
        <button type="button" class="btn btn-sm" id="inv-add">+ Line</button>
      </div>
      <table><thead><tr><th>Description / part</th><th>Qty</th><th>Unit price</th><th></th></tr></thead>
      <tbody id="inv-lines"></tbody></table>
      <p id="inv-total" style="font-weight:600;margin:0.5rem 0"></p>
      <button class="btn" type="submit">Create invoice</button>
    </form>`);
  const tbody = document.getElementById('inv-lines');
  function addLine(desc, price) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="inv-desc" value="${(desc||'').replace(/"/g,'&quot;')}" placeholder="Description" style="width:100%"/></td>
      <td><input class="inv-qty" type="number" min="0.01" step="0.01" value="1" style="width:70px"/></td>
      <td><input class="inv-price" type="number" min="0" step="0.01" value="${price||0}" style="width:90px"/></td>
      <td><button type="button" class="btn btn-sm btn-outline inv-rm">×</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('.inv-rm').onclick = () => { if (tbody.children.length > 1) tr.remove(); recalc(); };
    tr.querySelector('.inv-qty').oninput = recalc;
    tr.querySelector('.inv-price').oninput = recalc;
    recalc();
  }
  function recalc() {
    let t = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      t += (parseFloat(tr.querySelector('.inv-qty').value)||0) * (parseFloat(tr.querySelector('.inv-price').value)||0);
    });
    document.getElementById('inv-total').textContent = 'Total: R ' + t.toFixed(2);
  }
  addLine();
  document.getElementById('inv-add').onclick = () => addLine();
  // quick-add from part search
  document.getElementById('inv-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const description = tr.querySelector('.inv-desc').value.trim();
      if (!description) return;
      items.push({
        description,
        quantity: +tr.querySelector('.inv-qty').value || 1,
        unit_price: +tr.querySelector('.inv-price').value || 0
      });
    });
    if (!items.length) return alert('Add at least one line');
    try {
      const inv = await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: fd.get('customer_name'),
          external_po: fd.get('external_po') || null,
          po_id: fd.get('po_id') || null,
          due_date: fd.get('due_date') || null,
          notes: fd.get('notes') || null,
          items
        })
      });
      alert('Created ' + inv.invoice_number);
      closeModal();
      loadView('invoices');
    } catch (err) { alert(err.message); }
  };
};


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
  actions.innerHTML = `
    <button class="btn" onclick="showNewJob()">+ Job card</button>
    <button class="btn btn-outline" onclick="loadJobs('upcoming')">Open</button>
    <button class="btn btn-outline" onclick="loadJobs('past')">Past</button>
    <button class="btn btn-outline" onclick="loadJobs('mine')">My jobs</button>
    <select id="job-type-filter" onchange="loadJobs(window._jobListType||'upcoming')">
      <option value="">All types</option>
      <option value="SERVICE">Services</option>
      <option value="BAKKIE_STOCK">Bakkie stock</option>
      <option value="REPAIR">Repairs</option>
      <option value="INSPECTION">Inspection</option>
      <option value="OTHER">Other</option>
    </select>`;
  await loadJobs('upcoming');
}
window.loadJobs = async (type) => {
  window._jobListType = type;
  let q = 'upcoming=true';
  if (type === 'past') q = 'past=true';
  if (type === 'mine') q = 'upcoming=true&mine=true';
  const jt = document.getElementById('job-type-filter')?.value;
  if (jt) q += '&job_type=' + encodeURIComponent(jt);
  const jobs = await api(`/job-cards?${q}`);
  $('#view-container').innerHTML = `<div class="card"><div class="card-header"><h3>${type === 'mine' ? 'My' : type} job cards</h3></div>
    <table><thead><tr>
      <th>Job #</th><th>Type</th><th>Title</th><th>Asset</th><th>Service / BOM</th><th>Branch</th>
      <th>Tech</th><th>Priority</th><th>Status</th><th></th>
    </tr></thead>
    <tbody>${jobs.map(j=>`<tr>
      <td><strong>${j.job_number}</strong>
        <br><small style="color:var(--muted)">${j.scheduled_date||''}</small></td>
      <td>${badge(j.job_type||'SERVICE')}</td>
      <td>${j.title}</td>
      <td>${j.asset_code||'–'}</td>
      <td>${j.bom_code||j.service_type_name||'–'}</td>
      <td>${j.branch_code||'–'}</td>
      <td>${j.technician_name||'–'}</td>
      <td>${badge(j.priority)}</td><td>${badge(j.status)}</td>
      <td>
        <button class="btn btn-sm" onclick="printServiceCard(${j.id})">Print card</button>
        <button class="btn btn-sm btn-outline" onclick="showJobCost(${j.id})">Cost</button>
        <select onchange="setJobStatus(${j.id},this.value)"><option value="">Update…</option>
        <option value="ASSIGNED">Assigned</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="ON_HOLD">On Hold</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option></select>
      </td>
    </tr>`).join('')||'<tr><td colspan="10" class="empty">None</td></tr>'}</tbody></table></div>`;
};
window.setJobStatus = async (id, status) => {
  if (!status) return;
  const body = { status };
  if (status === 'COMPLETED') body.completed_date = new Date().toISOString().slice(0,10);
  try { await api(`/job-cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }); loadView('jobs'); }
  catch(e){alert(e.message);}
};
window.showNewJob = async () => {
  const [assets, services, boms, branches, techs] = await Promise.all([
    api('/assets'), api('/service-types'), api('/boms'), api('/branches'),
    api('/technicians').catch(() => [])
  ]);
  openModal('New job card', `<form id="job-form">
    <div class="form-group"><label>Job card type</label>
      <select name="job_type" id="job-type-sel">
        <option value="SERVICE">Service</option>
        <option value="BAKKIE_STOCK">Bakkie stock</option>
        <option value="REPAIR">Repair</option>
        <option value="INSPECTION">Inspection</option>
        <option value="OTHER">Other</option>
      </select>
      <button type="button" class="btn btn-sm btn-outline" style="margin-top:0.35rem" id="job-svc-template">Service template (fleet + hours)</button>
    </div>
    <div class="form-group"><label>Title</label><input name="title" required placeholder="e.g. 500hr service WL-001"/></div>
    <div class="form-group"><label>Description</label><input name="description"/></div>
    <div class="form-group"><label>Asset / fleet</label>
      <select name="asset_id"><option value="">– Optional –</option>${assets.map(a=>`<option value="${a.id}">${a.code} – ${a.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Service hours (meter)</label><input name="service_hours_at_open" type="number" placeholder="Current hours"/></div>
    <div class="form-group"><label>Equipment group</label><input name="equipment_group" placeholder="e.g. Wheel Loader"/></div>
    <div class="form-group"><label>Service type / template</label>
      <select name="service_type_id"><option value="">–</option>${services.map(s=>`<option value="${s.id}">${s.name} (${s.interval_hours||s.interval_days||'?'})</option>`).join('')}</select></div>
    <div class="form-group"><label>Service kit (BOM)</label>
      <select name="bom_id"><option value="">–</option>${boms.map(b=>`<option value="${b.id}">${b.code} – ${b.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Branch</label>
      <select name="branch_id">${branches.map(b=>`<option value="${b.id}">${b.code}</option>`).join('')}</select></div>
    <div class="form-group"><label>Technician</label>
      <select name="technician_id"><option value="">– Unassigned –</option>${(techs||[]).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Priority</label>
      <select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>
    <div class="form-group"><label>Scheduled date</label><input name="scheduled_date" type="date"/></div>
    <div class="form-group"><label>Estimated hours</label><input name="estimated_hours" type="number" step="0.5" value="2"/></div>
    <button class="btn" type="submit">Create job card</button>
  </form>`);
  const svcBtn = document.getElementById('job-svc-template');
  if (svcBtn) svcBtn.onclick = () => { closeModal(); showServiceWizard(); };
  document.getElementById('job-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    ['asset_id','service_type_id','bom_id','branch_id','technician_id'].forEach(k => {
      if (!body[k]) delete body[k]; else body[k] = +body[k];
    });
    if (body.estimated_hours) body.estimated_hours = +body.estimated_hours;
    if (body.service_hours_at_open) body.service_hours_at_open = +body.service_hours_at_open;
    else delete body.service_hours_at_open;
    try {
      const j = await api('/job-cards', { method: 'POST', body: JSON.stringify(body) });
      alert('Created ' + j.job_number);
      closeModal(); loadView('jobs');
    } catch (err) { alert(err.message); }
  };
};

/** CMMS-style: fleet # → hours → templates → create + print service card */
window.showServiceWizard = function () {
  openModal('Service card wizard', `
    <p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem">
      Same flow as CMMS: fleet number + service hours → equipment info → templates by hours → print service card.
    </p>
    <div class="form-group"><label>1. Fleet / machine number</label>
      <input id="wiz-fleet" placeholder="e.g. WHE-CAT-001 or WL-001"/></div>
    <div class="form-group"><label>2. Current service hours</label>
      <input id="wiz-hours" type="number" placeholder="e.g. 4850"/></div>
    <button type="button" class="btn" id="wiz-query">Query templates</button>
    <div id="wiz-result" style="margin-top:1rem"></div>
  `);
  document.getElementById('wiz-query').onclick = async () => {
    const fleet = document.getElementById('wiz-fleet').value.trim();
    const hours = document.getElementById('wiz-hours').value;
    if (!fleet) return alert('Enter fleet / machine number');
    const q = new URLSearchParams({ fleet });
    if (hours) q.set('hours', hours);
    const r = await api('/service-templates?' + q.toString());
    const box = document.getElementById('wiz-result');
    if (!r.asset) {
      box.innerHTML = '<p class="empty">No equipment found for that fleet number. Check Assets.</p>';
      return;
    }
    const a = r.asset;
    const trows = (r.templates || []).map(t => `<tr>
      <td>${t.suggested ? badge('Due') : '–'}</td>
      <td><strong>${t.name}</strong><br><small>${t.code} · ${t.interval_hours ? t.interval_hours + ' hr' : (t.interval_days ? t.interval_days + ' d' : '')}</small></td>
      <td>${t.bom_code || '–'}</td>
      <td><button type="button" class="btn btn-sm" data-st="${t.id}" data-bom="${t.bom_id||''}" data-name="${(t.name||'').replace(/"/g,'&quot;')}" data-check="${(t.checklist||'').replace(/"/g,'&quot;')}">Use template</button></td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No templates for this equipment group</td></tr>';
    box.innerHTML = `
      <h4 style="margin:0 0 0.5rem">3. Equipment info</h4>
      <p style="font-size:0.88rem">
        <strong>${a.code}</strong> – ${a.name}<br/>
        Group: ${a.equipment_group || a.asset_type} · Hours on meter: ${a.hour_meter}
        ${hours ? ' · You entered: ' + hours : ''}<br/>
        Last service @ ${a.last_service_hours ?? '–'} · Location: ${a.location_detail || '–'} · Serial: ${a.serial_number || '–'}
      </p>
      <h4 style="margin:0.75rem 0 0.35rem">4. Service templates</h4>
      <table><thead><tr><th>Due?</th><th>Template</th><th>Kit</th><th></th></tr></thead>
      <tbody>${trows}</tbody></table>`;
    box.querySelectorAll('button[data-st]').forEach(btn => {
      btn.onclick = async () => {
        const hoursVal = hours ? +hours : (a.hour_meter || null);
        const body = {
          job_type: 'SERVICE',
          title: btn.dataset.name + ' – ' + a.code,
          description: 'Service card from template',
          asset_id: a.id,
          service_type_id: +btn.dataset.st,
          bom_id: btn.dataset.bom ? +btn.dataset.bom : undefined,
          branch_id: a.branch_id,
          service_hours_at_open: hoursVal,
          equipment_group: a.equipment_group || a.asset_type,
          checklist_notes: btn.dataset.check || null,
          priority: 'Medium',
          scheduled_date: new Date().toISOString().slice(0, 10)
        };
        try {
          const j = await api('/job-cards', { method: 'POST', body: JSON.stringify(body) });
          // update asset hour meter if user entered hours
          if (hoursVal != null) {
            try { await api('/assets/' + a.id, { method: 'PATCH', body: JSON.stringify({ hour_meter: hoursVal }) }); } catch (e) {}
          }
          alert('Service job created: ' + j.job_number + '\nYou can print the service card next.');
          closeModal();
          loadView('jobs');
          setTimeout(() => printServiceCard(j.id), 500);
        } catch (err) { alert(err.message); }
      };
    });
  };
};



async function renderSuppliers(container) {
  const list = await api('/suppliers');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Suppliers</h3></div>
    <table><thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th></tr></thead>
    <tbody>${list.map(s=>`<tr><td>${s.name}</td><td>${s.contact_person||'–'}</td><td>${s.email||'–'}</td><td>${s.phone||'–'}</td></tr>`).join('')}</tbody></table></div>`;
}


// ── Print / PDF (browser → Save as PDF) ──

function mountPartSearch(containerEl, parts, { inputName, hiddenName, onSelect } = {}) {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.innerHTML = `
    <input type="text" class="part-search-input" placeholder="Type part number or name…" autocomplete="off" style="width:100%"/>
    <input type="hidden" class="part-search-id" name="${hiddenName || 'part_id'}" value=""/>
    <div class="part-search-list" style="display:none;position:absolute;left:0;right:0;top:100%;max-height:200px;overflow:auto;background:#fff;border:1px solid #ccc;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.12)"></div>
  `;
  containerEl.appendChild(wrap);
  const inp = wrap.querySelector('.part-search-input');
  const hid = wrap.querySelector('.part-search-id');
  const list = wrap.querySelector('.part-search-list');
  const render = (q) => {
    const qq = (q || '').toLowerCase().trim();
    let matches = parts;
    if (qq) {
      matches = parts.filter(p =>
        (p.part_number || '').toLowerCase().includes(qq) ||
        (p.description || '').toLowerCase().includes(qq) ||
        (p.alternate_numbers || []).some(a => String(a).toLowerCase().includes(qq))
      );
    }
    matches = matches.slice(0, 40);
    list.innerHTML = matches.length ? matches.map(p =>
      `<div class="part-opt" data-id="${p.id}" data-cost="${p.unit_cost||0}" style="padding:0.45rem 0.6rem;cursor:pointer;border-bottom:1px solid #eee;font-size:0.85rem">
        <strong>${p.part_number}</strong> – ${(p.description||'').slice(0,50)}
      </div>`
    ).join('') : '<div style="padding:0.5rem;color:#888">No matches</div>';
    list.style.display = 'block';
    list.querySelectorAll('.part-opt').forEach(el => {
      el.onmousedown = (e) => {
        e.preventDefault();
        hid.value = el.dataset.id;
        inp.value = el.textContent.trim();
        list.style.display = 'none';
        if (onSelect) onSelect({ id: +el.dataset.id, cost: +el.dataset.cost });
      };
    });
  };
  inp.onfocus = () => render(inp.value);
  inp.oninput = () => { hid.value = ''; render(inp.value); };
  inp.onblur = () => setTimeout(() => { list.style.display = 'none'; }, 150);
  return { input: inp, hidden: hid };
}


window.openPrintWindow = function (title, bodyHtml) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Please allow pop-ups to print / save PDF'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; padding: 24px; font-size: 12px; }
      h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 1px; }
      h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      .meta { color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f3f3f3; font-size: 11px; text-transform: uppercase; }
      .right { text-align: right; }
      .total { font-size: 14px; font-weight: 700; }
      .footer { margin-top: 28px; font-size: 10px; color: #888; }
      .sign { margin-top: 36px; display: flex; gap: 40px; }
      .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
      @media print {
        body { padding: 0; }
        .no-print { display: none !important; }
      }
    </style></head><body>
    <div class="no-print" style="margin-bottom:16px">
      <button onclick="window.print()" style="padding:8px 16px;background:#1a3a6b;color:#fff;border:none;cursor:pointer;border-radius:4px">Print</button>
      <button onclick="window.close()" style="padding:8px 16px;margin-left:8px;cursor:pointer">Close</button>
    </div>
    ${bodyHtml}
    <div class="footer">GHM WMS/CMMS · Made by Karabo · ${new Date().toLocaleString()}</div>
    </body></html>`);
  w.document.close();
};


function downloadSimplePdf(filename, lines) {
  // Minimal PDF 1.4 text document
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contentLines = [];
  let y = 800;
  for (const line of lines) {
    contentLines.push(`BT /F1 10 Tf 40 ${y} Td (${esc(line)}) Tj ET`);
    y -= 14;
    if (y < 40) break;
  }
  const stream = contentLines.join('\\n');
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj');
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\\n${stream}\\nendstream endobj`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');
  let pdf = '%PDF-1.4\\n';
  const offsets = [0];
  for (const o of objs) {
    offsets.push(pdf.length);
    pdf += o + '\\n';
  }
  const xrefPos = pdf.length;
  pdf += `xref\\n0 ${objs.length + 1}\\n`;
  pdf += '0000000000 65535 f \\n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \\n';
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefPos}\\n%%EOF`;
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
  a.click();
  URL.revokeObjectURL(a.href);
}


window.printPO = async function (id) {
  const po = await api('/purchase-orders/' + id);
  const lines = [
    'PURCHASE ORDER',
    po.po_number + '  |  Status: ' + (po.status || '') + '  |  Date: ' + (po.order_date || ''),
    'Supplier: ' + (po.supplier_name || '-'),
    'Expected: ' + (po.expected_date || '-') + '  |  By: ' + (po.created_by || '-'),
    'Notes: ' + (po.notes || '-'),
    '',
    'Part #          Qty    Unit cost      Line',
    '----------------------------------------------'
  ];
  for (const i of (po.items || [])) {
    const line = ((i.part_number || '') + '                    ').slice(0, 14) + '  ' +
      String(i.quantity_ordered || 0).padStart(4) + '  R ' + Number(i.unit_cost || 0).toFixed(2).padStart(8) +
      '  R ' + (Number(i.quantity_ordered || 0) * Number(i.unit_cost || 0)).toFixed(2);
    lines.push(line);
  }
  lines.push('');
  lines.push('Total: R ' + Number(po.total_amount || 0).toFixed(2));
  downloadSimplePdf(po.po_number || 'PO', lines);
};

window.printInvoice = async function (id) {
  let inv;
  try { inv = await api('/invoices/' + id); }
  catch (e) {
    const list = await api('/invoices');
    inv = list.find(i => i.id === Number(id));
  }
  if (!inv) return alert('Invoice not found');
  const lines = [
    'INVOICE',
    (inv.invoice_number || '') + '  |  Status: ' + (inv.status || '') + '  |  Date: ' + (inv.invoice_date || ''),
    'Customer: ' + (inv.customer_name || '-'),
    'Linked PO: ' + (inv.po_number || inv.external_po || '-'),
    'Due: ' + (inv.due_date || '-'),
    'Notes: ' + (inv.notes || '-'),
    '',
    'Description                         Qty    Price      Line',
    '----------------------------------------------------------'
  ];
  for (const i of (inv.items || [])) {
    lines.push(
      ((i.description || 'Item') + '                              ').slice(0, 30) + '  ' +
      String(i.quantity || 1).padStart(3) + '  R ' + Number(i.unit_price || 0).toFixed(2) +
      '  R ' + ((i.quantity || 1) * Number(i.unit_price || 0)).toFixed(2)
    );
  }
  lines.push('');
  lines.push('Amount due: R ' + Number(inv.total_amount || 0).toFixed(2));
  downloadSimplePdf(inv.invoice_number || 'Invoice', lines);
};

window.printServiceCard = async function (jobId) {
  const job = await api('/job-cards/' + jobId);
  const parts = (job.parts || []).map(p => `<tr>
    <td>${p.part_number||'–'}</td><td>${p.description||'–'}</td><td>${p.quantity_used||0}</td>
  </tr>`).join('');
  const checklist = (job.service_type_checklist || job.checklist_notes || '');
  openPrintWindow(job.job_number + ' Service Card', `
    <h1>SERVICE JOB CARD</h1>
    <div class="meta"><strong>${job.job_number}</strong> · Type: ${job.job_type || 'SERVICE'} · ${job.status}</div>
    <table>
      <tr><th>Fleet / Asset</th><td>${job.asset_code || '–'} ${job.asset_name ? '– ' + job.asset_name : ''}</td>
          <th>Hours at open</th><td>${job.service_hours_at_open ?? job.asset_hours ?? '–'}</td></tr>
      <tr><th>Equipment group</th><td>${job.equipment_group || job.asset_type || '–'}</td>
          <th>Service template</th><td>${job.service_type_name || '–'}</td></tr>
      <tr><th>Branch</th><td>${job.branch_code || '–'}</td>
          <th>Technician</th><td>${job.technician_name || '–'}</td></tr>
      <tr><th>Priority</th><td>${job.priority || '–'}</td>
          <th>Scheduled</th><td>${job.scheduled_date || '–'}</td></tr>
      <tr><th>Title</th><td colspan="3">${job.title || '–'}</td></tr>
      <tr><th>Description</th><td colspan="3">${job.description || '–'}</td></tr>
    </table>
    <h2>Service kit / parts</h2>
    <table><thead><tr><th>Part #</th><th>Description</th><th>Qty</th></tr></thead>
    <tbody>${parts || '<tr><td colspan="3">No parts issued yet — use BOM kit on job</td></tr>'}</tbody></table>
    ${job.bom ? `<p><strong>BOM:</strong> ${job.bom.code || ''} ${job.bom.name || ''}</p>` : ''}
    <h2>Checklist / notes</h2>
    <p>${checklist || '–'}</p>
    <div class="sign"><div>Technician sign</div><div>Supervisor sign</div><div>Date completed</div></div>
  `);
};


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
    <div class="form-group"><label>Supplier</label>
      <select name="supplier_id"><option value="">– Select –</option>${suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:0.5rem 0">
      <strong>Lines</strong>
      <button type="button" class="btn btn-sm" id="pr-add">+ Add line</button>
    </div>
    <table><thead><tr><th>Part</th><th>Qty</th><th>Unit cost</th><th></th></tr></thead>
    <tbody id="pr-lines"></tbody></table>
    <button class="btn" type="submit" style="margin-top:0.75rem">Create PR</button>
  </form>`);
  const tbody = document.getElementById('pr-lines');
  function addLine() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><div class="pr-part-slot"></div></td>
      <td><input class="pr-qty" type="number" min="1" value="1" style="width:70px"/></td>
      <td><input class="pr-cost" type="number" step="0.01" value="0" style="width:90px"/></td>
      <td><button type="button" class="btn btn-sm btn-outline pr-rm">×</button></td>`;
    tbody.appendChild(tr);
    const slot = tr.querySelector('.pr-part-slot');
    const cost = tr.querySelector('.pr-cost');
    const m = mountPartSearch(slot, parts, {
      onSelect: ({ id, cost: c }) => {
        slot.dataset.partId = id;
        if (c) cost.value = c;
      }
    });
    tr.querySelector('.pr-rm').onclick = () => {
      if (tbody.querySelectorAll('tr').length <= 1) return;
      tr.remove();
    };
  }
  addLine();
  document.getElementById('pr-add').onclick = addLine;
  document.getElementById('pr-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const slot = tr.querySelector('.pr-part-slot');
      const pid = +(slot.dataset.partId || 0);
      if (!pid) return;
      items.push({
        part_id: pid,
        quantity: +tr.querySelector('.pr-qty').value || 1,
        unit_cost: +tr.querySelector('.pr-cost').value || 0
      });
    });
    if (!items.length) return alert('Add at least one part (search and select)');
    try {
      await api('/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          supplier_id: fd.get('supplier_id') || null,
          items
        })
      });
      closeModal();
      loadView('pr');
    } catch (err) { alert(err.message); }
  };
};


// ── Quotations ──
async function renderQuotes(container, actions) {
  actions.innerHTML = `<button class="btn" onclick="showNewQuote('PARTS')">+ Parts quote</button>
    <button class="btn btn-outline" onclick="showNewQuote('SERVICE')">+ Service quote</button>`;
  const list = await api('/quotations');
  container.innerHTML = `<div class="card"><div class="card-header"><h3>Quotations</h3></div>
    <table><thead><tr><th>#</th><th>Type</th><th>Customer</th><th>Status</th><th>TFR / Ref</th><th>Total</th><th>By</th><th></th></tr></thead>
    <tbody>${list.map(q=>`<tr>
      <td><strong>${q.quote_number}</strong></td><td>${badge(q.quote_type)}</td>
      <td>${q.customer_name||'–'}</td><td>${badge(q.status)}</td>
      <td>${q.transfer_code||q.quote_number||'–'}</td><td>R ${Number(q.total_amount).toFixed(2)}</td><td>${q.created_by||'–'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openQuote(${q.id})">Open</button>
        ${q.status==='DRAFT'?`<button class="btn btn-sm" onclick="openQuote(${q.id}, true)">Edit</button>
        <button class="btn btn-sm btn-outline" onclick="setQuoteStatus(${q.id},'SENT')">Mark sent</button>`:''}
        ${q.status==='SENT'?`<button class="btn btn-sm" onclick="setQuoteStatus(${q.id},'ACCEPTED')">Accepted</button>
        <button class="btn btn-sm btn-outline" onclick="setQuoteStatus(${q.id},'REJECTED')">Rejected</button>`:''}
      </td>
    </tr>`).join('')||'<tr><td colspan="7" class="empty">None</td></tr>'}</tbody></table></div>`;
}

window.setQuoteStatus = async (id, status) => {
  try {
    await api('/quotations/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadView('quotes');
  } catch (e) { alert(e.message); }
};

window.openQuote = async (id, editMode) => {
  const q = await api('/quotations/' + id);
  if (editMode || q.status === 'DRAFT') {
    return showQuoteEditor(q.quote_type || 'PARTS', q);
  }
  const rows = (q.items || []).map(i => `<tr>
    <td>${i.description || (i.part_id ? 'Part #' + i.part_id : '–')}</td>
    <td>${i.quantity}</td>
    <td>R ${Number(i.unit_price).toFixed(2)}</td>
    <td>R ${(Number(i.quantity) * Number(i.unit_price)).toFixed(2)}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="empty">No lines</td></tr>';
  openModal(q.quote_number, `
    <p><strong>Customer:</strong> ${q.customer_name || '–'} · <strong>Status:</strong> ${badge(q.status)}
    · <strong>Valid until:</strong> ${q.valid_until || '–'}</p>
    <table style="margin-top:0.75rem"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Line</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:0.75rem;font-size:1.05rem"><strong>Total: R ${Number(q.total_amount).toFixed(2)}</strong></p>
    ${q.status==='DRAFT'?`<button class="btn" onclick="closeModal(); openQuote(${q.id}, true)">Edit draft</button>`:''}
  `);
};

window.showNewQuote = async (quote_type) => showQuoteEditor(quote_type, null);

async function showQuoteEditor(quote_type, existing) {
  const parts = await api('/parts');
  const isEdit = !!(existing && existing.id);
  const partOptions = parts.map(p =>
    `<option value="${p.id}" data-cost="${p.unit_cost}">${p.part_number} – ${p.description}</option>`
  ).join('');

  const initialItems = (existing && existing.items && existing.items.length)
    ? existing.items
    : [{ part_id: '', description: '', quantity: 1, unit_price: 0 }];

  function lineHtml(item, idx) {
    if (quote_type === 'PARTS') {
      const sel = parts.map(p =>
        `<option value="${p.id}" data-cost="${p.unit_cost}" ${String(item.part_id)===String(p.id)?'selected':''}>${p.part_number} – ${p.description}</option>`
      ).join('');
      return `<tr data-idx="${idx}">
        <td><select class="q-part">${sel}</select></td>
        <td><input class="q-qty" type="number" min="0.01" step="0.01" value="${item.quantity || 1}" style="width:70px"/></td>
        <td><input class="q-price" type="number" min="0" step="0.01" value="${item.unit_price || 0}" style="width:90px"/></td>
        <td><button type="button" class="btn btn-sm btn-outline q-remove">×</button></td>
      </tr>`;
    }
    return `<tr data-idx="${idx}">
      <td><input class="q-desc" value="${(item.description || '').replace(/"/g, '&quot;')}" placeholder="Service description" style="width:100%"/></td>
      <td><input class="q-qty" type="number" min="0.01" step="0.01" value="${item.quantity || 1}" style="width:70px"/></td>
      <td><input class="q-price" type="number" min="0" step="0.01" value="${item.unit_price || 0}" style="width:90px"/></td>
      <td><button type="button" class="btn btn-sm btn-outline q-remove">×</button></td>
    </tr>`;
  }

  openModal((isEdit ? 'Edit ' : 'New ') + (quote_type === 'SERVICE' ? 'Service' : 'Parts') + ' quote', `
    <form id="q-form">
      <div class="form-group"><label>Customer</label>
        <input name="customer_name" required value="${(existing && existing.customer_name) || ''}"/></div>
      <div class="form-group"><label>Valid until</label>
        <input name="valid_until" type="date" value="${(existing && existing.valid_until) || ''}"/></div>
      <div class="form-group"><label>Notes</label>
        <input name="notes" value="${(existing && existing.notes) || ''}"/></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0.75rem 0 0.35rem">
        <strong>Lines</strong>
        <button type="button" class="btn btn-sm" id="q-add-line">+ Add line</button>
      </div>
      <table><thead><tr>
        <th>${quote_type === 'PARTS' ? 'Part' : 'Description'}</th><th>Qty</th><th>Unit price (R)</th><th></th>
      </tr></thead>
      <tbody id="q-lines">${initialItems.map((it, i) => lineHtml(it, i)).join('')}</tbody></table>
      <p id="q-total" style="margin:0.5rem 0;font-weight:600"></p>
      <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Create quote'}</button>
    </form>`);

  const tbody = document.getElementById('q-lines');
  function recalc() {
    let total = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.q-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.q-price').value) || 0;
      total += qty * price;
    });
    document.getElementById('q-total').textContent = 'Total: R ' + total.toFixed(2);
  }
  function bindRow(tr) {
    const partSel = tr.querySelector('.q-part');
    if (partSel) {
      partSel.onchange = () => {
        const opt = partSel.selectedOptions[0];
        const cost = opt && opt.dataset.cost ? parseFloat(opt.dataset.cost) : 0;
        const price = tr.querySelector('.q-price');
        if (price && (!price.value || price.value === '0')) price.value = cost || 0;
        recalc();
      };
    }
    tr.querySelector('.q-qty').oninput = recalc;
    tr.querySelector('.q-price').oninput = recalc;
    tr.querySelector('.q-remove').onclick = () => {
      if (tbody.querySelectorAll('tr').length <= 1) return alert('Keep at least one line');
      tr.remove();
      recalc();
    };
  }
  tbody.querySelectorAll('tr').forEach(bindRow);
  recalc();

  document.getElementById('q-add-line').onclick = () => {
    const idx = tbody.querySelectorAll('tr').length;
    const wrap = document.createElement('tbody');
    wrap.innerHTML = lineHtml({ part_id: '', description: '', quantity: 1, unit_price: 0 }, idx);
    const tr = wrap.firstElementChild;
    tbody.appendChild(tr);
    bindRow(tr);
    recalc();
  };

  document.getElementById('q-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.q-qty').value) || 0;
      const unit_price = parseFloat(tr.querySelector('.q-price').value) || 0;
      if (quote_type === 'PARTS') {
        const part_id = +tr.querySelector('.q-part').value;
        const p = parts.find(x => x.id === part_id);
        items.push({
          part_id,
          description: p ? (p.part_number + ' – ' + p.description) : 'Part',
          quantity: qty,
          unit_price
        });
      } else {
        items.push({
          part_id: null,
          description: (tr.querySelector('.q-desc').value || '').trim() || 'Service',
          quantity: qty,
          unit_price
        });
      }
    });
    if (!items.length) return alert('Add at least one line');
    const body = {
      quote_type,
      customer_name: fd.get('customer_name'),
      valid_until: fd.get('valid_until') || null,
      notes: fd.get('notes') || null,
      items
    };
    try {
      if (isEdit) {
        await api('/quotations/' + existing.id, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/quotations', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal();
      loadView('quotes');
    } catch (err) { alert(err.message); }
  };
}

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
