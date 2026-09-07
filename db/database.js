const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'ghm-data.json');

function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + 'ghm-salt-v1').digest('hex');
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

const defaultData = {
  users: [],
  login_logs: [],
  sessions: [],
  branches: [],
  suppliers: [],
  parts: [],
  branch_stock: [],
  stock_movements: [],
  purchase_orders: [],
  po_items: [],
  technicians: [],
  job_cards: [],
  job_parts: [],
  service_types: [],
  assets: [],
  part_requests: [],
  invoices: [],
  invoice_items: [],
  supplier_orders: [],
  supplier_order_items: [],
  boms: [],
  bom_items: [],
  _meta: {
    nextId: {
      users: 1, login_logs: 1, sessions: 1,
      branches: 1, suppliers: 1, parts: 1, branch_stock: 1,
      stock_movements: 1, purchase_orders: 1, po_items: 1,
      technicians: 1, job_cards: 1, job_parts: 1,
      service_types: 1, assets: 1, part_requests: 1,
      invoices: 1, invoice_items: 1, supplier_orders: 1, supplier_order_items: 1,
      boms: 1, bom_items: 1
    },
    transferSeq: 1000
  }
};

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
    return JSON.parse(JSON.stringify(defaultData));
  }
  const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  for (const key of Object.keys(defaultData)) {
    if (raw[key] === undefined) raw[key] = Array.isArray(defaultData[key]) ? [] : defaultData[key];
  }
  if (!raw._meta) raw._meta = JSON.parse(JSON.stringify(defaultData._meta));
  if (!raw._meta.nextId) raw._meta.nextId = {};
  for (const k of Object.keys(defaultData._meta.nextId)) {
    if (raw._meta.nextId[k] === undefined) raw._meta.nextId[k] = 1;
  }
  if (raw._meta.transferSeq === undefined) raw._meta.transferSeq = 1000;
  return raw;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let data = load();

function nextTransferCode(prefix = 'TR') {
  data._meta.transferSeq = (data._meta.transferSeq || 1000) + 1;
  const seq = String(data._meta.transferSeq).padStart(6, '0');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  save(data);
  return `${prefix}-${date}-${seq}`;
}

// Seed if no users (fresh or upgraded)
if (!data.users.length) {
  console.log('Seeding users, BOMs and demo data...');

  data.users = [
    { id: 1, email: 'admin@ghm.local', password: hashPassword('admin123'), name: 'Admin Karabo', role: 'admin', branch_id: 1, active: 1, created_at: new Date().toISOString() },
    { id: 2, email: 'store@ghm.local', password: hashPassword('store123'), name: 'Main Storeman', role: 'store', branch_id: 1, active: 1, created_at: new Date().toISOString() },
    { id: 3, email: 'cpt@ghm.local', password: hashPassword('branch123'), name: 'CPT Branch User', role: 'branch', branch_id: 2, active: 1, created_at: new Date().toISOString() }
  ];
  data._meta.nextId.users = 4;

  if (!data.branches.length) {
    data.branches = [
      { id: 1, code: 'MAIN', name: 'Main Branch (Head Office)', is_main: true,  address: 'Johannesburg', phone: '011-000-0001', active: 1 },
      { id: 2, code: 'CPT',  name: 'Cape Town Depot', is_main: false, address: 'Bellville', phone: '021-000-0002', active: 1 },
      { id: 3, code: 'DBN',  name: 'Durban Depot', is_main: false, address: 'Pinetown', phone: '031-000-0003', active: 1 },
      { id: 4, code: 'PLK',  name: 'Polokwane Depot', is_main: false, address: 'Polokwane', phone: '015-000-0004', active: 1 }
    ];
    data._meta.nextId.branches = 5;
  }

  if (!data.suppliers.length) {
    data.suppliers = [
      { id: 1, name: 'Bearing World SA', contact_person: 'Thabo Molefe', email: 'thabo@bearingworld.co.za', phone: '011-555-0101' },
      { id: 2, name: 'Industrial Belts Ltd', contact_person: 'Sarah Naidoo', email: 'sarah@indbelts.co.za', phone: '021-555-0202' },
      { id: 3, name: 'Hydraulics Direct', contact_person: 'Johan van Wyk', email: 'johan@hydraulics.co.za', phone: '031-555-0303' },
      { id: 4, name: 'Caterpillar Parts SA', contact_person: 'Mike Botha', email: 'mike@catparts.co.za', phone: '011-555-0404' }
    ];
    data._meta.nextId.suppliers = 5;
  }

  if (!data.parts.length) {
    data.parts = [
      { id: 1, part_number: 'BRG-6205-2RS', description: 'Deep Groove Ball Bearing 6205-2RS', category: 'Bearings', unit: 'EA', unit_cost: 85.50, supplier_id: 1, min_stock: 20, max_stock: 100, safety_stock: 10, status: 'Active', reclass_status: 'Standard' },
      { id: 2, part_number: 'BLT-A38', description: 'V-Belt A38', category: 'Belts', unit: 'EA', unit_cost: 125.00, supplier_id: 2, min_stock: 15, max_stock: 50, safety_stock: 5, status: 'Active', reclass_status: 'Standard' },
      { id: 3, part_number: 'HYD-HOSE-1/2', description: 'Hydraulic Hose 1/2" x 2m', category: 'Hydraulics', unit: 'EA', unit_cost: 450.00, supplier_id: 3, min_stock: 5, max_stock: 30, safety_stock: 3, status: 'Active', reclass_status: 'Standard' },
      { id: 4, part_number: 'FIL-OIL-10W40', description: 'Engine Oil Filter', category: 'Filters', unit: 'EA', unit_cost: 95.00, supplier_id: 1, min_stock: 10, max_stock: 60, safety_stock: 5, status: 'Active', reclass_status: 'Standard' },
      { id: 5, part_number: 'SEAL-NBR-50', description: 'NBR Oil Seal 50x70x10', category: 'Seals', unit: 'EA', unit_cost: 35.00, supplier_id: 1, min_stock: 15, max_stock: 80, safety_stock: 8, status: 'Active', reclass_status: 'Standard' },
      { id: 6, part_number: 'MOTOR-3PH-5.5', description: '3-Phase Motor 5.5kW', category: 'Motors', unit: 'EA', unit_cost: 8500, supplier_id: 3, min_stock: 1, max_stock: 5, safety_stock: 1, status: 'Active', reclass_status: 'Capital' },
      { id: 7, part_number: 'CHAIN-40-1R', description: 'Roller Chain #40', category: 'Chains', unit: 'M', unit_cost: 280.00, supplier_id: 2, min_stock: 10, max_stock: 40, safety_stock: 5, status: 'Active', reclass_status: 'Standard' },
      { id: 8, part_number: 'GREASE-NLGI2', description: 'Lithium Grease NLGI 2 - 400g', category: 'Lubricants', unit: 'EA', unit_cost: 65.00, supplier_id: 1, min_stock: 20, max_stock: 100, safety_stock: 10, status: 'Active', reclass_status: 'Standard' },
      { id: 9, part_number: 'CAT-FILTER-1R', description: 'Cat Oil Filter 1R-0739', category: 'Filters', unit: 'EA', unit_cost: 320.00, supplier_id: 4, min_stock: 8, max_stock: 40, safety_stock: 4, status: 'Active', reclass_status: 'Standard' },
      { id: 10, part_number: 'CAT-BUCKET-PIN', description: 'Wheel Loader Bucket Pin Kit', category: 'Undercarriage', unit: 'KIT', unit_cost: 1850, supplier_id: 4, min_stock: 2, max_stock: 10, safety_stock: 1, status: 'Active', reclass_status: 'Standard' },
      { id: 11, part_number: 'OIL-15W40-20L', description: 'Engine Oil 15W40 20L', category: 'Lubricants', unit: 'EA', unit_cost: 890, supplier_id: 1, min_stock: 5, max_stock: 30, safety_stock: 3, status: 'Active', reclass_status: 'Standard' },
      { id: 12, part_number: 'AIR-FILTER-WL', description: 'Wheel Loader Air Filter', category: 'Filters', unit: 'EA', unit_cost: 450, supplier_id: 4, min_stock: 4, max_stock: 20, safety_stock: 2, status: 'Active', reclass_status: 'Standard' }
    ];
    data._meta.nextId.parts = 13;
  } else {
    // ensure status fields on existing parts
    data.parts.forEach(p => {
      if (!p.status) p.status = 'Active';
      if (!p.reclass_status) p.reclass_status = 'Standard';
    });
  }

  if (!data.branch_stock.length) {
    const stockSeed = [
      [1,1,45,'A-01-03'],[1,2,12,'B-02-01'],[1,3,8,'C-03-05'],[1,4,30,'D-01-02'],
      [1,5,25,'A-02-08'],[1,6,2,'E-01-01'],[1,7,15,'B-03-04'],[1,8,40,'D-02-01'],
      [1,9,18,'F-01-01'],[1,10,4,'F-02-01'],[1,11,10,'D-03-01'],[1,12,6,'F-03-01'],
      [2,1,10,'A-01'],[2,2,3,'B-01'],[2,4,8,'D-01'],[2,8,12,'D-02'],[2,9,5,'F-01'],
      [3,1,6,'A-01'],[3,3,2,'C-01'],[3,4,4,'D-01'],[3,9,3,'F-01'],[3,10,1,'F-02'],
      [4,1,4,'A-01'],[4,2,2,'B-01'],[4,8,6,'D-01'],[4,9,2,'F-01']
    ];
    let bsId = 1;
    data.branch_stock = stockSeed.map(([branch_id, part_id, quantity, bin_location]) => ({
      id: bsId++, branch_id, part_id, quantity, bin_location, stock_on_order: 0, status: 'Available'
    }));
    data._meta.nextId.branch_stock = bsId;
  } else {
    data.branch_stock.forEach(s => { if (!s.status) s.status = 'Available'; });
  }

  if (!data.technicians.length) {
    data.technicians = [
      { id: 1, name: 'Pieter Botha', employee_code: 'TECH-001', branch_id: 1, phone: '082-111-2222', skill_level: 'Senior', active: 1 },
      { id: 2, name: 'Lerato Dlamini', employee_code: 'TECH-002', branch_id: 1, phone: '083-333-4444', skill_level: 'Intermediate', active: 1 },
      { id: 3, name: 'Ahmed Hassan', employee_code: 'TECH-003', branch_id: 2, phone: '084-555-6666', skill_level: 'Junior', active: 1 }
    ];
    data._meta.nextId.technicians = 4;
  }

  if (!data.service_types.length) {
    data.service_types = [
      { id: 1, code: 'SVC-500HR-WL', name: '500 Hour Service – Wheel Loader', asset_type: 'Wheel Loader', interval_hours: 500, interval_days: null, checklist: 'Engine oil & filter, Fuel filter, Air filter, Grease, Hydraulics, Bucket pins, Tyres' },
      { id: 2, code: 'SVC-1000HR-WL', name: '1000 Hour Service – Wheel Loader', asset_type: 'Wheel Loader', interval_hours: 1000, interval_days: null, checklist: 'Full 500hr + Transmission oil, Hydraulic sample, Coolant, Brakes' },
      { id: 3, code: 'SVC-250HR-EX', name: '250 Hour Service – Excavator', asset_type: 'Excavator', interval_hours: 250, interval_days: null, checklist: 'Engine oil & filter, Grease boom, Track tension, Hydraulics' }
    ];
    data._meta.nextId.service_types = 4;
  }

  if (!data.assets.length) {
    data.assets = [
      { id: 1, code: 'WL-001', name: 'CAT 950M Wheel Loader', asset_type: 'Wheel Loader', branch_id: 1, hour_meter: 4850, last_service_hours: 4500, status: 'Operational' },
      { id: 2, code: 'WL-002', name: 'CAT 966M Wheel Loader', asset_type: 'Wheel Loader', branch_id: 2, hour_meter: 2100, last_service_hours: 2000, status: 'Operational' },
      { id: 3, code: 'EX-001', name: 'CAT 320 Excavator', asset_type: 'Excavator', branch_id: 1, hour_meter: 3200, last_service_hours: 3000, status: 'Operational' }
    ];
    data._meta.nextId.assets = 4;
  }

  // BOMs / Service kits
  if (!data.boms.length) {
    data.boms = [
      { id: 1, code: 'BOM-500HR-WL', name: '500hr Wheel Loader Service Kit', service_type_id: 1, notes: 'Standard 500 hour kit', active: 1 },
      { id: 2, code: 'BOM-1000HR-WL', name: '1000hr Wheel Loader Service Kit', service_type_id: 2, notes: 'Includes 500hr items + extras', active: 1 },
      { id: 3, code: 'BOM-250HR-EX', name: '250hr Excavator Service Kit', service_type_id: 3, notes: '', active: 1 }
    ];
    data._meta.nextId.boms = 4;
    data.bom_items = [
      { id: 1, bom_id: 1, part_id: 11, quantity: 1 },
      { id: 2, bom_id: 1, part_id: 9, quantity: 1 },
      { id: 3, bom_id: 1, part_id: 12, quantity: 1 },
      { id: 4, bom_id: 1, part_id: 8, quantity: 4 },
      { id: 5, bom_id: 2, part_id: 11, quantity: 1 },
      { id: 6, bom_id: 2, part_id: 9, quantity: 1 },
      { id: 7, bom_id: 2, part_id: 12, quantity: 1 },
      { id: 8, bom_id: 2, part_id: 8, quantity: 6 },
      { id: 9, bom_id: 2, part_id: 4, quantity: 2 },
      { id: 10, bom_id: 3, part_id: 11, quantity: 1 },
      { id: 11, bom_id: 3, part_id: 9, quantity: 1 },
      { id: 12, bom_id: 3, part_id: 8, quantity: 3 }
    ];
    data._meta.nextId.bom_items = 13;
  }

  if (!data.job_cards.length) {
    data.job_cards = [
      { id: 1, job_number: 'JC-2026-001', title: '500hr Service – WL-001', description: 'Scheduled 500 hour service', asset_id: 1, service_type_id: 1, bom_id: 1, branch_id: 1, priority: 'High', status: 'ASSIGNED', technician_id: 1, scheduled_date: '2026-09-10', completed_date: null, estimated_hours: 6, actual_hours: null, created_by: 'Admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, job_number: 'JC-2026-002', title: 'Bucket pin replacement', description: 'Worn bucket pins', asset_id: 2, service_type_id: null, bom_id: null, branch_id: 2, priority: 'Critical', status: 'OPEN', technician_id: null, scheduled_date: '2026-09-08', completed_date: null, estimated_hours: 4, actual_hours: null, created_by: 'Admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    data._meta.nextId.job_cards = 3;
  }

  save(data);
  console.log('Seed complete. Login: admin@ghm.local / admin123');
}

const db = {
  hashPassword,
  makeToken,

  getAll(table) { return data[table] || []; },
  getById(table, id) { return (data[table] || []).find(r => r.id === Number(id)); },

  insert(table, record) {
    const id = data._meta.nextId[table]++;
    const row = { id, ...record };
    data[table].push(row);
    save(data);
    return row;
  },

  update(table, id, updates) {
    const idx = data[table].findIndex(r => r.id === Number(id));
    if (idx === -1) return null;
    data[table][idx] = { ...data[table][idx], ...updates };
    save(data);
    return data[table][idx];
  },

  remove(table, id) {
    const idx = data[table].findIndex(r => r.id === Number(id));
    if (idx === -1) return false;
    data[table].splice(idx, 1);
    save(data);
    return true;
  },

  nextTransferCode,

  // Auth
  findUserByEmail(email) {
    return data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase() && u.active);
  },

  createSession(userId) {
    const token = makeToken();
    const session = this.insert('sessions', {
      token,
      user_id: userId,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });
    return session;
  },

  getSession(token) {
    if (!token) return null;
    return data.sessions.find(s => s.token === token);
  },

  deleteSession(token) {
    const idx = data.sessions.findIndex(s => s.token === token);
    if (idx === -1) return false;
    data.sessions.splice(idx, 1);
    save(data);
    return true;
  },

  logLogin(userId, action, meta = {}) {
    return this.insert('login_logs', {
      user_id: userId,
      action, // LOGIN | LOGOUT
      at: new Date().toISOString(),
      ...meta
    });
  },

  getBranchStock(branchId) {
    return data.branch_stock
      .filter(s => s.branch_id === Number(branchId))
      .map(s => {
        const p = data.parts.find(x => x.id === s.part_id);
        return {
          ...s,
          part_number: p?.part_number,
          description: p?.description,
          category: p?.category,
          unit: p?.unit,
          unit_cost: p?.unit_cost,
          min_stock: p?.min_stock,
          max_stock: p?.max_stock,
          safety_stock: p?.safety_stock,
          supplier_id: p?.supplier_id,
          part_status: p?.status,
          reclass_status: p?.reclass_status
        };
      });
  },

  getStockRow(branchId, partId) {
    return data.branch_stock.find(s => s.branch_id === Number(branchId) && s.part_id === Number(partId));
  },

  ensureStockRow(branchId, partId, bin = null) {
    let row = this.getStockRow(branchId, partId);
    if (!row) {
      row = this.insert('branch_stock', {
        branch_id: Number(branchId),
        part_id: Number(partId),
        quantity: 0,
        bin_location: bin,
        stock_on_order: 0,
        status: 'Available'
      });
    }
    return row;
  },

  getPartsWithSupplier() {
    return data.parts.map(p => {
      const s = data.suppliers.find(x => x.id === p.supplier_id);
      return { ...p, supplier_name: s ? s.name : null };
    });
  },

  getJobsEnriched() {
    return data.job_cards.map(j => {
      const t = data.technicians.find(x => x.id === j.technician_id);
      const a = data.assets.find(x => x.id === j.asset_id);
      const st = data.service_types.find(x => x.id === j.service_type_id);
      const b = data.branches.find(x => x.id === j.branch_id);
      const bom = data.boms.find(x => x.id === j.bom_id);
      return {
        ...j,
        technician_name: t?.name || null,
        asset_name: a?.name || null,
        asset_code: a?.code || null,
        service_type_name: st?.name || null,
        branch_name: b?.name || null,
        branch_code: b?.code || null,
        bom_code: bom?.code || null,
        bom_name: bom?.name || null
      };
    });
  },

  getRequestsEnriched() {
    return data.part_requests.map(r => {
      const fromB = data.branches.find(x => x.id === r.from_branch_id);
      const toB = data.branches.find(x => x.id === r.to_branch_id);
      const p = data.parts.find(x => x.id === r.part_id);
      return {
        ...r,
        from_branch_name: fromB?.name,
        from_branch_code: fromB?.code,
        to_branch_name: toB?.name,
        part_number: p?.part_number,
        description: p?.description
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getMovementsEnriched() {
    return data.stock_movements.map(m => {
      const p = data.parts.find(x => x.id === m.part_id);
      const b = data.branches.find(x => x.id === m.branch_id);
      const u = m.user_id ? data.users.find(x => x.id === m.user_id) : null;
      return {
        ...m,
        part_number: p?.part_number,
        description: p?.description,
        branch_code: b?.code,
        branch_name: b?.name,
        user_name: u?.name || m.performed_by || null
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getPOsWithSupplier() {
    return data.purchase_orders.map(po => {
      const s = data.suppliers.find(x => x.id === po.supplier_id);
      return { ...po, supplier_name: s?.name || null };
    });
  },

  getBomsEnriched() {
    return data.boms.map(bom => {
      const st = data.service_types.find(x => x.id === bom.service_type_id);
      const items = data.bom_items.filter(i => i.bom_id === bom.id).map(i => {
        const p = data.parts.find(x => x.id === i.part_id);
        return {
          ...i,
          part_number: p?.part_number,
          description: p?.description,
          unit: p?.unit,
          unit_cost: p?.unit_cost
        };
      });
      return {
        ...bom,
        service_type_name: st?.name || null,
        service_type_code: st?.code || null,
        items,
        item_count: items.length
      };
    });
  },

  getForecast() {
    const mainId = data.branches.find(b => b.is_main)?.id || 1;
    const mainStock = this.getBranchStock(mainId);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return mainStock.map(s => {
      const issues = data.stock_movements.filter(m =>
        m.part_id === s.part_id &&
        ['ISSUE', 'TRANSFER_OUT', 'PICK'].includes(m.movement_type) &&
        new Date(m.created_at).getTime() > thirtyDaysAgo
      );
      const used30 = issues.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const avgDaily = used30 / 30;
      const daysOfCover = avgDaily > 0 ? Math.round(s.quantity / avgDaily) : 999;
      const suggestedOrder = Math.max(0, (s.max_stock || s.min_stock * 2) - s.quantity - (s.stock_on_order || 0));
      let urgency = 'OK';
      if (s.quantity <= (s.safety_stock || 0)) urgency = 'CRITICAL';
      else if (s.quantity <= (s.min_stock || 0)) urgency = 'LOW';
      else if (daysOfCover < 14 && avgDaily > 0) urgency = 'WATCH';
      return {
        part_id: s.part_id, part_number: s.part_number, description: s.description,
        quantity: s.quantity, min_stock: s.min_stock, safety_stock: s.safety_stock,
        max_stock: s.max_stock, stock_on_order: s.stock_on_order || 0,
        used_last_30_days: used30, avg_daily_use: Math.round(avgDaily * 100) / 100,
        days_of_cover: daysOfCover, suggested_order_qty: suggestedOrder, urgency
      };
    }).sort((a, b) => {
      const order = { CRITICAL: 0, LOW: 1, WATCH: 2, OK: 3 };
      return order[a.urgency] - order[b.urgency];
    });
  },

  // Reports
  getMovementReport(filters = {}) {
    let list = this.getMovementsEnriched();
    if (filters.from) list = list.filter(m => m.created_at >= filters.from);
    if (filters.to) list = list.filter(m => m.created_at <= filters.to + 'T23:59:59');
    if (filters.type) list = list.filter(m => m.movement_type === filters.type);
    if (filters.branch_id) list = list.filter(m => m.branch_id === Number(filters.branch_id));
    return list;
  },

  _data: () => data,
  _save: () => save(data)
};

module.exports = db;
