const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db/database');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

function send(res, status, data, type = 'application/json') {
  const body = type === 'application/json' ? JSON.stringify(data) : data;
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function getToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function requireAuth(req, res) {
  const token = getToken(req);
  const session = db.getSession(token);
  if (!session) {
    send(res, 401, { error: 'Please log in' });
    return null;
  }
  const user = db.getById('users', session.user_id);
  if (!user || !user.active) {
    send(res, 401, { error: 'Invalid session' });
    return null;
  }
  db.update('sessions', session.id, { last_seen: new Date().toISOString() });
  return { session, user };
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
        if (e2) return send(res, 404, { error: 'Not found' });
        send(res, 200, html, 'text/html');
      });
      return;
    }
    send(res, 200, data, types[ext] || 'application/octet-stream');
  });
}

async function handleAPI(req, res, pathname, query) {
  const method = req.method;
  const parts = pathname.replace(/^\/api\//, '').split('/').filter(Boolean);

  try {
    if (method === 'OPTIONS') return send(res, 204, '');

    // ═══════ AUTH (public) ═══════
    if (parts[0] === 'auth') {
      if (parts[1] === 'login' && method === 'POST') {
        const body = await parseBody(req);
        const user = db.findUserByEmail(body.email);
        if (!user || user.password !== db.hashPassword(body.password)) {
          return send(res, 401, { error: 'Invalid email or password' });
        }
        const session = db.createSession(user.id);
        db.logLogin(user.id, 'LOGIN', { email: user.email });
        return send(res, 200, {
          token: session.token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role, branch_id: user.branch_id }
        });
      }
      if (parts[1] === 'logout' && method === 'POST') {
        const token = getToken(req);
        const session = db.getSession(token);
        if (session) {
          db.logLogin(session.user_id, 'LOGOUT');
          db.deleteSession(token);
        }
        return send(res, 200, { message: 'Logged out' });
      }
      if (parts[1] === 'me' && method === 'GET') {
        const auth = requireAuth(req, res);
        if (!auth) return;
        const b = db.getById('branches', auth.user.branch_id);
        return send(res, 200, {
          id: auth.user.id, email: auth.user.email, name: auth.user.name,
          role: auth.user.role, branch_id: auth.user.branch_id,
          branch_code: b?.code, branch_name: b?.name
        });
      }
      if (parts[1] === 'logs' && method === 'GET') {
        const auth = requireAuth(req, res);
        if (!auth) return;
        if (auth.user.role !== 'admin') return send(res, 403, { error: 'Admin only' });
        const logs = db.getAll('login_logs').map(l => {
          const u = db.getById('users', l.user_id);
          return { ...l, user_name: u?.name, email: u?.email };
        }).sort((a, b) => new Date(b.at) - new Date(a.at));
        return send(res, 200, logs.slice(0, 200));
      }
    }

    // All routes below require login
    const auth = requireAuth(req, res);
    if (!auth) return;
    const currentUser = auth.user;

    // ═══════ DASHBOARD ═══════
    if (parts[0] === 'dashboard' && method === 'GET') {
      const branches = db.getAll('branches');
      const mainId = branches.find(b => b.is_main)?.id || 1;
      const mainStock = db.getBranchStock(mainId);
      const jobs = db.getJobsEnriched();
      const requests = db.getRequestsEnriched();
      const forecast = db.getForecast();
      return send(res, 200, {
        summary: {
          totalParts: db.getAll('parts').length,
          branches: branches.length,
          lowStockMain: mainStock.filter(s => s.quantity <= (s.min_stock || 0)).length,
          openJobs: jobs.filter(j => ['OPEN','ASSIGNED','IN_PROGRESS','ON_HOLD'].includes(j.status)).length,
          pendingRequests: requests.filter(r => r.status === 'PENDING').length,
          criticalForecast: forecast.filter(f => f.urgency === 'CRITICAL').length,
          belowMinimum: forecast.filter(f => f.quantity <= (f.min_stock || 0)).length
        },
        reorderAlerts: forecast.filter(f => f.quantity <= (f.min_stock || 0)).slice(0, 10),
        lowStockMain: mainStock.filter(s => s.quantity <= (s.min_stock || 0)).slice(0, 8),
        pendingRequests: requests.filter(r => r.status === 'PENDING').slice(0, 8),
        upcomingJobs: jobs.filter(j => ['OPEN','ASSIGNED','IN_PROGRESS','ON_HOLD'].includes(j.status)).slice(0, 8),
        branchOverview: branches.map(b => {
          const stock = db.getBranchStock(b.id);
          return {
            id: b.id, code: b.code, name: b.name, is_main: b.is_main,
            partCount: stock.length,
            lowStock: stock.filter(s => s.quantity <= (s.min_stock || 0)).length,
            totalQty: stock.reduce((n, s) => n + s.quantity, 0)
          };
        })
      });
    }

    // ═══════ BRANCHES ═══════
    if (parts[0] === 'branches') {
      if (method === 'GET' && !parts[1]) return send(res, 200, db.getAll('branches'));
      if (method === 'GET' && parts[1] && parts[2] === 'stock') {
        return send(res, 200, db.getBranchStock(parts[1]));
      }
    }

    // ═══════ PARTS ═══════
    if (parts[0] === 'parts') {
      if (method === 'GET' && !parts[1]) {
        let list = db.getPartsWithSupplier();
        if (query.search) {
          const q = query.search.toLowerCase();
          list = list.filter(p => p.part_number.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
        }
        if (query.status) list = list.filter(p => p.status === query.status);
        if (query.reclass_status) list = list.filter(p => p.reclass_status === query.reclass_status);
        return send(res, 200, list);
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.part_number || !body.description) return send(res, 400, { error: 'part_number and description required' });
        if (db.getAll('parts').some(p => p.part_number === body.part_number)) return send(res, 400, { error: 'Part number exists' });
        const part = db.insert('parts', {
          part_number: body.part_number, description: body.description,
          category: body.category || null, unit: body.unit || 'EA',
          unit_cost: Number(body.unit_cost) || 0, supplier_id: body.supplier_id ? Number(body.supplier_id) : null,
          min_stock: Number(body.min_stock) || 0, max_stock: Number(body.max_stock) || 0,
          safety_stock: Number(body.safety_stock) || 0,
          status: body.status || 'Active',
          reclass_status: body.reclass_status || 'Standard'
        });
        return send(res, 201, part);
      }
      if (method === 'PATCH' && parts[1]) {
        const body = await parseBody(req);
        const allowed = ['status', 'reclass_status', 'min_stock', 'max_stock', 'safety_stock', 'description', 'category', 'unit_cost', 'supplier_id'];
        const updates = {};
        for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
        const part = db.update('parts', parts[1], updates);
        if (!part) return send(res, 404, { error: 'Part not found' });
        return send(res, 200, part);
      }
    }

    // ═══════ INVENTORY ═══════
    if (parts[0] === 'inventory' && method === 'GET') {
      const branchId = query.branch_id || currentUser.branch_id || 1;
      let stock = db.getBranchStock(branchId);
      if (query.search) {
        const q = query.search.toLowerCase();
        stock = stock.filter(s => (s.part_number||'').toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));
      }
      if (query.lowStock === 'true') stock = stock.filter(s => s.quantity <= (s.min_stock || 0));
      if (query.status) stock = stock.filter(s => s.status === query.status);
      return send(res, 200, stock);
    }

    if (parts[0] === 'branch-stock' && method === 'PATCH' && parts[1]) {
      const body = await parseBody(req);
      const updates = {};
      if (body.status) updates.status = body.status;
      if (body.bin_location !== undefined) updates.bin_location = body.bin_location;
      const row = db.update('branch_stock', parts[1], updates);
      if (!row) return send(res, 404, { error: 'Stock line not found' });
      return send(res, 200, row);
    }

    // ═══════ MOVEMENTS ═══════
    if (parts[0] === 'movements') {
      if (method === 'GET') {
        let list = db.getMovementsEnriched();
        if (query.branch_id) list = list.filter(m => m.branch_id === Number(query.branch_id));
        if (query.type) list = list.filter(m => m.movement_type === query.type);
        if (query.transfer_code) list = list.filter(m => m.transfer_code === query.transfer_code);
        return send(res, 200, list.slice(0, Number(query.limit) || 150));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const { part_id, branch_id, movement_type, quantity, from_bin, to_bin, reference, notes, related_request_id, job_id } = body;
        if (!part_id || !branch_id || !movement_type || quantity === undefined) {
          return send(res, 400, { error: 'part_id, branch_id, movement_type, quantity required' });
        }
        const valid = ['RECEIVE','ADJUST','TRANSFER_OUT','TRANSFER_IN','ISSUE','PICK','RETURN'];
        if (!valid.includes(movement_type)) return send(res, 400, { error: 'Invalid movement_type' });

        const stock = db.ensureStockRow(branch_id, part_id, to_bin || from_bin);
        const qty = Number(quantity);
        let newQty = stock.quantity;
        if (['RECEIVE','TRANSFER_IN','RETURN'].includes(movement_type)) newQty += Math.abs(qty);
        else if (['ISSUE','PICK','TRANSFER_OUT'].includes(movement_type)) {
          newQty -= Math.abs(qty);
          if (newQty < 0) return send(res, 400, { error: 'Insufficient stock at this branch' });
        } else if (movement_type === 'ADJUST') newQty = qty;

        const transfer_code = db.nextTransferCode(
          movement_type === 'RECEIVE' ? 'RCV' :
          movement_type === 'PICK' ? 'PCK' :
          movement_type === 'ISSUE' ? 'ISS' :
          movement_type === 'ADJUST' ? 'ADJ' :
          movement_type.startsWith('TRANSFER') ? 'TRF' : 'TR'
        );

        const movement = db.insert('stock_movements', {
          transfer_code, part_id: Number(part_id), branch_id: Number(branch_id),
          movement_type, quantity: qty,
          from_bin: from_bin || stock.bin_location || null,
          to_bin: to_bin || null,
          reference: reference || null, notes: notes || null,
          performed_by: currentUser.name,
          user_id: currentUser.id,
          related_request_id: related_request_id || null,
          job_id: job_id || null,
          created_at: new Date().toISOString()
        });

        const updates = { quantity: newQty };
        if (to_bin && movement_type !== 'TRANSFER_OUT') updates.bin_location = to_bin;
        db.update('branch_stock', stock.id, updates);

        if (job_id && movement_type === 'ISSUE') {
          db.insert('job_parts', {
            job_id: Number(job_id),
            part_id: Number(part_id),
            quantity_used: Math.abs(qty),
            amended: !!body.amended,
            notes: notes || null
          });
        }

        return send(res, 201, { ...movement, message: 'Movement recorded', transfer_code });
      }
    }

    // ═══════ REQUESTS ═══════
    if (parts[0] === 'requests') {
      if (method === 'GET') {
        let list = db.getRequestsEnriched();
        if (query.status) list = list.filter(r => r.status === query.status);
        return send(res, 200, list);
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const { from_branch_id, part_id, quantity, notes } = body;
        if (!from_branch_id || !part_id || !quantity) return send(res, 400, { error: 'from_branch_id, part_id, quantity required' });
        const main = db.getAll('branches').find(b => b.is_main);
        const all = db.getAll('part_requests');
        const seq = String((all.length + 1)).padStart(4, '0');
        const request_code = `REQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${seq}`;
        const reqRow = db.insert('part_requests', {
          request_code,
          from_branch_id: Number(from_branch_id),
          to_branch_id: main?.id || 1,
          part_id: Number(part_id),
          quantity: Number(quantity),
          status: 'PENDING',
          notes: notes || null,
          requested_by: currentUser.name,
          transfer_code: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return send(res, 201, reqRow);
      }
      if (method === 'PATCH' && parts[1]) {
        const body = await parseBody(req);
        const reqRow = db.getById('part_requests', parts[1]);
        if (!reqRow) return send(res, 404, { error: 'Request not found' });
        const status = body.status;
        const updates = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;

        if (status === 'SHIPPED') {
          const mainId = reqRow.to_branch_id;
          const stock = db.getStockRow(mainId, reqRow.part_id);
          if (!stock || stock.quantity < reqRow.quantity) {
            return send(res, 400, { error: 'Insufficient stock at main branch' });
          }
          const transfer_code = db.nextTransferCode('TRF');
          db.insert('stock_movements', {
            transfer_code, part_id: reqRow.part_id, branch_id: mainId,
            movement_type: 'TRANSFER_OUT', quantity: reqRow.quantity,
            from_bin: stock.bin_location, to_bin: null,
            reference: reqRow.request_code, notes: `Inter-branch to request ${reqRow.request_code}`,
            performed_by: currentUser.name, user_id: currentUser.id,
            related_request_id: reqRow.id, created_at: new Date().toISOString()
          });
          db.update('branch_stock', stock.id, { quantity: stock.quantity - reqRow.quantity });
          updates.transfer_code = transfer_code;
        }
        if (status === 'RECEIVED') {
          const dest = db.ensureStockRow(reqRow.from_branch_id, reqRow.part_id);
          db.update('branch_stock', dest.id, { quantity: dest.quantity + reqRow.quantity });
          db.insert('stock_movements', {
            transfer_code: reqRow.transfer_code || db.nextTransferCode('TRF'),
            part_id: reqRow.part_id, branch_id: reqRow.from_branch_id,
            movement_type: 'TRANSFER_IN', quantity: reqRow.quantity,
            from_bin: null, to_bin: dest.bin_location,
            reference: reqRow.request_code, notes: 'Inter-branch received',
            performed_by: currentUser.name, user_id: currentUser.id,
            related_request_id: reqRow.id, created_at: new Date().toISOString()
          });
        }
        return send(res, 200, db.update('part_requests', parts[1], updates));
      }
    }

    // ═══════ BOMs / Service kits ═══════
    if (parts[0] === 'boms') {
      if (method === 'GET' && !parts[1]) {
        let list = db.getBomsEnriched();
        if (query.search) {
          const q = query.search.toLowerCase();
          list = list.filter(b =>
            (b.code || '').toLowerCase().includes(q) ||
            (b.name || '').toLowerCase().includes(q) ||
            (b.service_type_name || '').toLowerCase().includes(q)
          );
        }
        return send(res, 200, list);
      }
      if (method === 'GET' && parts[1]) {
        const list = db.getBomsEnriched();
        const bom = list.find(b => b.id === Number(parts[1]));
        if (!bom) return send(res, 404, { error: 'BOM not found' });
        return send(res, 200, bom);
      }
      if (method === 'POST' && !parts[1]) {
        const body = await parseBody(req);
        if (!body.code || !body.name) return send(res, 400, { error: 'code and name required' });
        const bom = db.insert('boms', {
          code: body.code, name: body.name,
          service_type_id: body.service_type_id ? Number(body.service_type_id) : null,
          notes: body.notes || null, active: 1
        });
        for (const item of (body.items || [])) {
          db.insert('bom_items', {
            bom_id: bom.id,
            part_id: Number(item.part_id),
            quantity: Number(item.quantity) || 1
          });
        }
        return send(res, 201, bom);
      }
      // Create job card from BOM
      if (method === 'POST' && parts[1] && parts[2] === 'create-job') {
        const bomList = db.getBomsEnriched();
        const bom = bomList.find(b => b.id === Number(parts[1]));
        if (!bom) return send(res, 404, { error: 'BOM not found' });
        const body = await parseBody(req);
        const all = db.getAll('job_cards');
        let jn = 'JC-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].job_number;
          jn = `JC-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const job = db.insert('job_cards', {
          job_number: jn,
          title: body.title || `${bom.name}`,
          description: body.description || `From BOM ${bom.code}`,
          asset_id: body.asset_id ? Number(body.asset_id) : null,
          service_type_id: bom.service_type_id,
          bom_id: bom.id,
          branch_id: body.branch_id ? Number(body.branch_id) : currentUser.branch_id || 1,
          priority: body.priority || 'Medium',
          status: 'OPEN',
          technician_id: body.technician_id ? Number(body.technician_id) : null,
          scheduled_date: body.scheduled_date || null,
          completed_date: null,
          estimated_hours: body.estimated_hours ? Number(body.estimated_hours) : null,
          actual_hours: null,
          created_by: currentUser.name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        return send(res, 201, job);
      }
      // Issue BOM parts to a job (with optional amendments)
      if (method === 'POST' && parts[1] && parts[2] === 'issue') {
        const body = await parseBody(req);
        const { job_id, branch_id, items } = body;
        if (!job_id || !items || !items.length) {
          return send(res, 400, { error: 'job_id and items required' });
        }
        const branch = branch_id || currentUser.branch_id || 1;
        const results = [];
        for (const item of items) {
          const qty = Number(item.quantity);
          if (!item.part_id || !qty) continue;
          const stock = db.ensureStockRow(branch, item.part_id);
          if (stock.quantity < qty) {
            results.push({ part_id: item.part_id, error: 'Insufficient stock', available: stock.quantity });
            continue;
          }
          const transfer_code = db.nextTransferCode('ISS');
          db.insert('stock_movements', {
            transfer_code, part_id: Number(item.part_id), branch_id: Number(branch),
            movement_type: 'ISSUE', quantity: qty,
            from_bin: stock.bin_location, to_bin: null,
            reference: `Job ${job_id}`, notes: item.amended ? `Amended from BOM: ${item.notes || ''}` : 'BOM issue',
            performed_by: currentUser.name, user_id: currentUser.id,
            job_id: Number(job_id), created_at: new Date().toISOString()
          });
          db.update('branch_stock', stock.id, { quantity: stock.quantity - qty });
          db.insert('job_parts', {
            job_id: Number(job_id), part_id: Number(item.part_id),
            quantity_used: qty, amended: !!item.amended, notes: item.notes || null
          });
          results.push({ part_id: item.part_id, quantity: qty, transfer_code, ok: true });
        }
        return send(res, 200, { message: 'Issue complete', results });
      }
    }

    // ═══════ REPORTS ═══════
    if (parts[0] === 'reports') {
      if (parts[1] === 'movements' && method === 'GET') {
        return send(res, 200, db.getMovementReport({
          from: query.from, to: query.to, type: query.type, branch_id: query.branch_id
        }));
      }
      if (parts[1] === 'summary' && method === 'GET') {
        const movements = db.getMovementsEnriched();
        const from = query.from;
        const to = query.to;
        let filtered = movements;
        if (from) filtered = filtered.filter(m => m.created_at >= from);
        if (to) filtered = filtered.filter(m => m.created_at <= to + 'T23:59:59');

        const byType = {};
        for (const m of filtered) {
          byType[m.movement_type] = (byType[m.movement_type] || 0) + 1;
        }
        const stockIn = filtered.filter(m => ['RECEIVE','TRANSFER_IN','RETURN'].includes(m.movement_type));
        const stockOut = filtered.filter(m => ['ISSUE','PICK','TRANSFER_OUT'].includes(m.movement_type));
        const adjustments = filtered.filter(m => m.movement_type === 'ADJUST');
        const interBranch = filtered.filter(m => ['TRANSFER_OUT','TRANSFER_IN'].includes(m.movement_type));
        const servicesIssued = filtered.filter(m => m.movement_type === 'ISSUE' && m.job_id);
        const pos = db.getPOsWithSupplier();
        let posF = pos;
        if (from) posF = posF.filter(p => (p.order_date || p.created_at || '') >= from);
        if (to) posF = posF.filter(p => (p.order_date || p.created_at || '') <= to);

        return send(res, 200, {
          period: { from: from || null, to: to || null },
          counts: {
            total_movements: filtered.length,
            stock_in: stockIn.length,
            stock_out: stockOut.length,
            adjustments: adjustments.length,
            inter_branch: interBranch.length,
            services_issued: servicesIssued.length,
            purchase_orders: posF.length
          },
          by_type: byType,
          stock_in: stockIn.slice(0, 100),
          stock_out: stockOut.slice(0, 100),
          adjustments: adjustments.slice(0, 100),
          inter_branch: interBranch.slice(0, 100),
          services_issued: servicesIssued.slice(0, 100),
          purchase_orders: posF.slice(0, 50)
        });
      }
    }

    // ═══════ SERVICE TYPES / ASSETS / JOBS (existing) ═══════
    if (parts[0] === 'service-types') {
      if (method === 'GET') return send(res, 200, db.getAll('service_types'));
      if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.code) return send(res, 400, { error: 'code and name required' });
        return send(res, 201, db.insert('service_types', {
          code: body.code, name: body.name, asset_type: body.asset_type || 'General',
          interval_hours: body.interval_hours ? Number(body.interval_hours) : null,
          interval_days: body.interval_days ? Number(body.interval_days) : null,
          checklist: body.checklist || null
        }));
      }
    }

    if (parts[0] === 'assets' && method === 'GET') {
      const list = db.getAll('assets').map(a => {
        const b = db.getById('branches', a.branch_id);
        const dueServices = db.getAll('service_types')
          .filter(st => st.asset_type === a.asset_type || st.asset_type === 'General')
          .filter(st => st.interval_hours && (a.hour_meter - (a.last_service_hours || 0)) >= st.interval_hours * 0.9)
          .map(st => st.name);
        return { ...a, branch_name: b?.name, branch_code: b?.code, services_due: dueServices };
      });
      return send(res, 200, list);
    }

    if (parts[0] === 'job-cards') {
      if (method === 'GET' && !parts[1]) {
        let jobs = db.getJobsEnriched();
        if (query.upcoming === 'true') jobs = jobs.filter(j => ['OPEN','ASSIGNED','IN_PROGRESS','ON_HOLD'].includes(j.status));
        if (query.past === 'true') jobs = jobs.filter(j => ['COMPLETED','CANCELLED'].includes(j.status));
        return send(res, 200, jobs);
      }
      if (method === 'GET' && parts[1]) {
        const job = db.getJobsEnriched().find(j => j.id === Number(parts[1]));
        if (!job) return send(res, 404, { error: 'Job not found' });
        const jparts = db.getAll('job_parts').filter(jp => jp.job_id === job.id).map(jp => {
          const p = db.getById('parts', jp.part_id);
          return { ...jp, part_number: p?.part_number, description: p?.description };
        });
        let bom = null;
        if (job.bom_id) bom = db.getBomsEnriched().find(b => b.id === job.bom_id);
        return send(res, 200, { ...job, parts: jparts, bom });
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.title) return send(res, 400, { error: 'title required' });
        const all = db.getAll('job_cards');
        let jn = 'JC-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].job_number;
          jn = `JC-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const job = db.insert('job_cards', {
          job_number: jn, title: body.title, description: body.description || null,
          asset_id: body.asset_id ? Number(body.asset_id) : null,
          service_type_id: body.service_type_id ? Number(body.service_type_id) : null,
          bom_id: body.bom_id ? Number(body.bom_id) : null,
          branch_id: body.branch_id ? Number(body.branch_id) : currentUser.branch_id || 1,
          priority: body.priority || 'Medium',
          status: body.technician_id ? 'ASSIGNED' : 'OPEN',
          technician_id: body.technician_id ? Number(body.technician_id) : null,
          scheduled_date: body.scheduled_date || null, completed_date: null,
          estimated_hours: body.estimated_hours ? Number(body.estimated_hours) : null,
          actual_hours: null, created_by: currentUser.name,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        return send(res, 201, job);
      }
      if (method === 'PUT' && parts[1]) {
        const body = await parseBody(req);
        delete body.id;
        body.updated_at = new Date().toISOString();
        const job = db.update('job_cards', parts[1], body);
        if (!job) return send(res, 404, { error: 'Job not found' });
        return send(res, 200, job);
      }
    }

    // POs, invoices, supplier orders, forecast, suppliers, technicians
    if (parts[0] === 'purchase-orders') {
      if (method === 'GET' && !parts[1]) return send(res, 200, db.getPOsWithSupplier());
      if (method === 'GET' && parts[1]) {
        const po = db.getPOsWithSupplier().find(p => p.id === Number(parts[1]));
        if (!po) return send(res, 404, { error: 'PO not found' });
        const items = db.getAll('po_items').filter(i => i.po_id === po.id).map(i => {
          const p = db.getById('parts', i.part_id);
          return { ...i, part_number: p?.part_number, description: p?.description };
        });
        return send(res, 200, { ...po, items });
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const { supplier_id, expected_date, notes, items = [] } = body;
        if (!supplier_id || !items.length) return send(res, 400, { error: 'supplier_id and items required' });
        const all = db.getAll('purchase_orders');
        let poNum = 'PO-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].po_number;
          poNum = `PO-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const total = items.reduce((s, i) => s + i.quantity_ordered * (i.unit_cost || 0), 0);
        const po = db.insert('purchase_orders', {
          po_number: poNum, supplier_id: Number(supplier_id), status: 'DRAFT',
          order_date: new Date().toISOString().slice(0, 10), expected_date: expected_date || null,
          total_amount: total, notes: notes || null, created_by: currentUser.name,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        for (const item of items) {
          db.insert('po_items', {
            po_id: po.id, part_id: Number(item.part_id),
            quantity_ordered: Number(item.quantity_ordered), quantity_received: 0,
            unit_cost: Number(item.unit_cost) || 0
          });
        }
        return send(res, 201, po);
      }
      if (method === 'PATCH' && parts[1] && parts[2] === 'status') {
        const body = await parseBody(req);
        const po = db.update('purchase_orders', parts[1], { status: body.status, updated_at: new Date().toISOString() });
        if (!po) return send(res, 404, { error: 'PO not found' });
        return send(res, 200, po);
      }
    }

    if (parts[0] === 'invoices') {
      if (method === 'GET') {
        const list = db.getAll('invoices').map(inv => {
          const po = inv.po_id ? db.getById('purchase_orders', inv.po_id) : null;
          return { ...inv, po_number: po?.po_number || inv.external_po || null };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return send(res, 200, list);
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const all = db.getAll('invoices');
        let invNum = 'INV-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].invoice_number;
          invNum = `INV-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const items = body.items || [];
        const total = items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
        const inv = db.insert('invoices', {
          invoice_number: invNum, customer_name: body.customer_name || null,
          po_id: body.po_id ? Number(body.po_id) : null, external_po: body.external_po || null,
          status: 'DRAFT', total_amount: total,
          invoice_date: body.invoice_date || new Date().toISOString().slice(0, 10),
          due_date: body.due_date || null, notes: body.notes || null,
          created_at: new Date().toISOString()
        });
        for (const item of items) {
          db.insert('invoice_items', {
            invoice_id: inv.id, description: item.description,
            quantity: Number(item.quantity) || 1, unit_price: Number(item.unit_price) || 0
          });
        }
        return send(res, 201, inv);
      }
    }

    if (parts[0] === 'supplier-orders') {
      if (method === 'GET') {
        const list = db.getAll('supplier_orders').map(o => {
          const s = db.getById('suppliers', o.supplier_id);
          return { ...o, supplier_name: s?.name };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return send(res, 200, list);
      }
      if (method === 'POST' && !parts[1]) {
        const body = await parseBody(req);
        const { supplier_id, notes, items = [] } = body;
        if (!supplier_id || !items.length) return send(res, 400, { error: 'supplier_id and items required' });
        const all = db.getAll('supplier_orders');
        const order_number = `SO-2026-${String(all.length + 1).padStart(4, '0')}`;
        const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0);
        const order = db.insert('supplier_orders', {
          order_number, supplier_id: Number(supplier_id), status: 'DRAFT',
          total_amount: total, notes: notes || null, created_by: currentUser.name,
          created_at: new Date().toISOString()
        });
        for (const item of items) {
          db.insert('supplier_order_items', {
            order_id: order.id, part_id: Number(item.part_id),
            quantity: Number(item.quantity), unit_cost: Number(item.unit_cost) || 0
          });
        }
        return send(res, 201, order);
      }
      if (method === 'POST' && parts[1] && parts[2] === 'to-po') {
        const order = db.getById('supplier_orders', parts[1]);
        if (!order) return send(res, 404, { error: 'Order not found' });
        const items = db.getAll('supplier_order_items').filter(i => i.order_id === order.id);
        const all = db.getAll('purchase_orders');
        let poNum = 'PO-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].po_number;
          poNum = `PO-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const po = db.insert('purchase_orders', {
          po_number: poNum, supplier_id: order.supplier_id, status: 'DRAFT',
          order_date: new Date().toISOString().slice(0, 10), expected_date: null,
          total_amount: order.total_amount, notes: `From order ${order.order_number}`,
          created_by: currentUser.name, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        for (const item of items) {
          db.insert('po_items', {
            po_id: po.id, part_id: item.part_id,
            quantity_ordered: item.quantity, quantity_received: 0, unit_cost: item.unit_cost
          });
        }
        db.update('supplier_orders', order.id, { status: 'CONVERTED', po_id: po.id });
        return send(res, 201, po);
      }
    }

    if (parts[0] === 'forecast' && method === 'GET') return send(res, 200, db.getForecast());

    // Reorder alerts + generate draft POs from minimum stock
    if (parts[0] === 'reorder') {
      if (parts[1] === 'alerts' && method === 'GET') {
        const forecast = db.getForecast().filter(f => f.quantity <= (f.min_stock || 0));
        const withSupplier = forecast.map(f => {
          const part = db.getById('parts', f.part_id);
          const sup = part?.supplier_id ? db.getById('suppliers', part.supplier_id) : null;
          return {
            ...f,
            supplier_id: part?.supplier_id || null,
            supplier_name: sup?.name || 'No supplier',
            unit_cost: part?.unit_cost || 0,
            order_qty: Math.max(f.suggested_order_qty || 0, (f.max_stock || f.min_stock || 0) - f.quantity)
          };
        });
        return send(res, 200, withSupplier);
      }
      if (parts[1] === 'generate-pos' && method === 'POST') {
        const body = await parseBody(req);
        const alerts = db.getForecast().filter(f => f.quantity <= (f.min_stock || 0));
        if (!alerts.length) return send(res, 400, { error: 'No items at or below minimum stock' });

        // Group by supplier
        const bySupplier = {};
        for (const f of alerts) {
          const part = db.getById('parts', f.part_id);
          if (!part) continue;
          const sid = part.supplier_id || 0;
          if (!bySupplier[sid]) bySupplier[sid] = [];
          const orderQty = Math.max(
            f.suggested_order_qty || 0,
            (part.max_stock || part.min_stock || 0) - f.quantity,
            part.min_stock || 1
          );
          if (orderQty <= 0) continue;
          bySupplier[sid].push({
            part_id: part.id,
            quantity_ordered: orderQty,
            unit_cost: part.unit_cost || 0
          });
        }

        const created = [];
        for (const [sid, items] of Object.entries(bySupplier)) {
          if (!items.length) continue;
          if (sid === '0' || sid === 0) continue; // skip no-supplier unless forced
          const all = db.getAll('purchase_orders');
          let poNum = 'PO-2026-0001';
          if (all.length) {
            const last = all[all.length - 1].po_number;
            poNum = `PO-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
          }
          const total = items.reduce((s, i) => s + i.quantity_ordered * (i.unit_cost || 0), 0);
          const po = db.insert('purchase_orders', {
            po_number: poNum,
            supplier_id: Number(sid),
            status: 'DRAFT',
            order_date: new Date().toISOString().slice(0, 10),
            expected_date: null,
            total_amount: total,
            notes: body.notes || 'Auto-generated from minimum stock levels',
            created_by: currentUser.name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          for (const item of items) {
            db.insert('po_items', {
              po_id: po.id,
              part_id: item.part_id,
              quantity_ordered: item.quantity_ordered,
              quantity_received: 0,
              unit_cost: item.unit_cost
            });
            const part = db.getById('parts', item.part_id);
            // optional: bump stock_on_order on branch stock at main - keep simple
          }
          const sup = db.getById('suppliers', sid);
          created.push({ po_number: po.po_number, supplier_name: sup?.name, lines: items.length, total_amount: total });
        }
        if (!created.length) {
          return send(res, 400, { error: 'Items below min have no supplier assigned. Set suppliers on parts first.' });
        }
        return send(res, 201, { message: 'Draft POs created', purchase_orders: created });
      }
    }
    if (parts[0] === 'suppliers') {
      if (method === 'GET') return send(res, 200, db.getAll('suppliers'));
      if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.name) return send(res, 400, { error: 'name required' });
        return send(res, 201, db.insert('suppliers', {
          name: body.name, contact_person: body.contact_person || null,
          email: body.email || null, phone: body.phone || null
        }));
      }
    }
    if (parts[0] === 'technicians' && method === 'GET') {
      return send(res, 200, db.getAll('technicians').filter(t => t.active));
    }

    send(res, 404, { error: 'API endpoint not found: ' + pathname });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname.startsWith('/api/')) {
    await handleAPI(req, res, parsed.pathname, parsed.query);
  } else {
    serveStatic(req, res, parsed.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`\n  GHM WMS/CMMS running at http://localhost:${PORT}`);
  console.log(`  Login: admin@ghm.local / admin123\n`);
});
