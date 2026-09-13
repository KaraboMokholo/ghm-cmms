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
  purchase_requests: [],
  purchase_request_items: [],
  quotations: [],
  quotation_items: [],
  stock_takes: [],
  stock_take_lines: [],

  boms: [],
  bom_items: [],
  service_history: [],
  downtime_events: [],
  _meta: {
    nextId: {
      users: 1, login_logs: 1, sessions: 1,
      branches: 1, suppliers: 1, parts: 1, branch_stock: 1,
      stock_movements: 1, purchase_orders: 1, po_items: 1,
      technicians: 1, job_cards: 1, job_parts: 1,
      service_types: 1, assets: 1, part_requests: 1,
      invoices: 1, invoice_items: 1, supplier_orders: 1, supplier_order_items: 1, purchase_requests: 1, purchase_request_items: 1, quotations: 1, quotation_items: 1, stock_takes: 1, stock_take_lines: 1,
      boms: 1, bom_items: 1, service_history: 1, downtime_events: 1
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

// Always normalise alternate_numbers on parts
(data.parts || []).forEach(p => {
  if (!Array.isArray(p.alternate_numbers)) {
    p.alternate_numbers = p.alternate_numbers ? [String(p.alternate_numbers)] : [];
  }
});
// Normalise assets warranty fields
(data.assets || []).forEach(a => {
  if (a.warranty_expiry === undefined) a.warranty_expiry = a.warranty_expiry || null;
  if (a.warranty_notes === undefined) a.warranty_notes = null;
  if (a.serial_number === undefined) a.serial_number = null;
  if (a.purchase_date === undefined) a.purchase_date = null;
  if (a.location_detail === undefined) a.location_detail = null;
});
if (!data.service_history) data.service_history = [];
if (!data.downtime_events) data.downtime_events = [];
if (!data.purchase_requests) data.purchase_requests = [];
if (!data.purchase_request_items) data.purchase_request_items = [];
if (!data.quotations) data.quotations = [];
if (!data.quotation_items) data.quotation_items = [];
if (!data.stock_takes) data.stock_takes = [];
if (!data.stock_take_lines) data.stock_take_lines = [];
if (!data._meta.nextId.purchase_requests) data._meta.nextId.purchase_requests = 1;
if (!data._meta.nextId.purchase_request_items) data._meta.nextId.purchase_request_items = 1;
if (!data._meta.nextId.quotations) data._meta.nextId.quotations = 1;
if (!data._meta.nextId.quotation_items) data._meta.nextId.quotation_items = 1;
if (!data._meta.nextId.stock_takes) data._meta.nextId.stock_takes = 1;
if (!data._meta.nextId.stock_take_lines) data._meta.nextId.stock_take_lines = 1;
// purchase_requests normalise

if (!data._meta.nextId.service_history) data._meta.nextId.service_history = 1;
if (!data._meta.nextId.downtime_events) data._meta.nextId.downtime_events = 1;


function nextTransferCode(prefix = 'TR') {
  data._meta.transferSeq = (data._meta.transferSeq || 1000) + 1;
  const seq = String(data._meta.transferSeq).padStart(6, '0');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  save(data);
  return `${prefix}-${date}-${seq}`;
}

// Seed if no users (fresh or upgraded)
if (!data.users.length || !(data.parts && data.parts.length >= 100)) {
  console.log('Seeding large realistic demo dataset (this may take a moment)...');
  // Reset core collections when upgrading from tiny demo
  if (data.parts && data.parts.length < 100) {
    console.log('Old small dataset detected (' + (data.parts||[]).length + ' parts) — replacing with full demo...');
  }


  data.users = [
    { id: 1, email: 'admin@ghm.local', password: hashPassword('admin123'), name: 'Karabo Mokholo', role: 'admin', branch_id: 1, active: 1, created_at: new Date().toISOString() },
    { id: 2, email: 'store@ghm.local', password: hashPassword('store123'), name: 'Main Storeman', role: 'store', branch_id: 1, active: 1, created_at: new Date().toISOString() },
    { id: 3, email: 'cpt@ghm.local', password: hashPassword('branch123'), name: 'CPT Branch User', role: 'branch', branch_id: 2, active: 1, created_at: new Date().toISOString() },
    { id: 4, email: 'tech@ghm.local', password: hashPassword('tech123'), name: 'Pieter Botha', role: 'technician', branch_id: 1, active: 1, created_at: new Date().toISOString() }
  ];
  data._meta.nextId.users = 5;

  data.branches = [
    { id: 1, code: 'MAIN', name: 'Main Branch (Head Office)', is_main: true, address: 'Johannesburg', phone: '011-000-0001', active: 1 },
    { id: 2, code: 'CPT', name: 'Cape Town Depot', is_main: false, address: 'Bellville', phone: '021-000-0002', active: 1 },
    { id: 3, code: 'DBN', name: 'Durban Depot', is_main: false, address: 'Pinetown', phone: '031-000-0003', active: 1 },
    { id: 4, code: 'PLK', name: 'Polokwane Depot', is_main: false, address: 'Polokwane', phone: '015-000-0004', active: 1 },
    { id: 5, code: 'BFN', name: 'Bloemfontein Depot', is_main: false, address: 'Bloemfontein', phone: '051-000-0005', active: 1 },
    { id: 6, code: 'PE', name: 'Gqeberha Depot', is_main: false, address: 'Gqeberha', phone: '041-000-0006', active: 1 }
  ];
  data._meta.nextId.branches = 7;

  const supplierNames = [
    'Bearing World SA', 'Industrial Belts Ltd', 'Hydraulics Direct', 'Caterpillar Parts SA',
    'Komatsu Genuine Parts', 'SANY Southern Africa', 'Volvo CE Parts', 'Toyota Material Handling',
    'Hyster Parts Hub', 'Jungheinrich SA', 'Donaldson Filters', 'Fleetguard / Cummins',
    'Bosch Automotive', 'SKF South Africa', 'Timken Africa', 'Gates Belts & Hoses',
    'Parker Hannifin', 'Shell Lubricants', 'Castrol Industrial', 'TotalEnergies Lubes',
    'Goodyear Tyres Industrial', 'Bridgestone OTR', 'Atlas Copco Parts', 'Sandvik Mining Parts',
    'Liebherr Components', 'Hitachi Construction', 'JCB Parts Centre', 'Manitou Parts SA',
    'Crown Forklift Parts', 'Linde Material Handling'
  ];
  data.suppliers = supplierNames.map((name, i) => ({
    id: i + 1,
    name,
    contact_person: 'Parts Desk',
    email: 'parts' + (i + 1) + '@supplier.example',
    phone: '011-555-' + String(1000 + i).padStart(4, '0')
  }));
  data._meta.nextId.suppliers = supplierNames.length + 1;

  // ---- 520+ parts ----
  const categories = [
    ['Bearings', 'BRG', 45, 220, 15, 80, 8],
    ['Belts', 'BLT', 80, 350, 10, 50, 5],
    ['Filters', 'FIL', 60, 450, 8, 40, 4],
    ['Hydraulics', 'HYD', 200, 2800, 3, 20, 2],
    ['Seals', 'SEAL', 25, 120, 12, 60, 6],
    ['Lubricants', 'LUB', 50, 950, 6, 30, 3],
    ['Electrical', 'ELC', 90, 1800, 4, 25, 2],
    ['Undercarriage', 'UC', 400, 5500, 2, 12, 1],
    ['Brakes', 'BRK', 150, 2200, 4, 18, 2],
    ['Cooling', 'CLG', 120, 1600, 5, 24, 2],
    ['Fasteners', 'FST', 5, 45, 50, 200, 20],
    ['Hoses', 'HSE', 180, 1200, 4, 22, 2],
    ['Pumps', 'PMP', 2500, 18000, 1, 6, 1],
    ['Motors', 'MTR', 3500, 25000, 1, 5, 1],
    ['Tyres-OTR', 'TYR', 8000, 45000, 1, 8, 1],
    ['Cabin', 'CBN', 200, 3500, 2, 15, 1],
    ['Attachments', 'ATT', 1500, 12000, 1, 6, 1],
    ['Sensors', 'SNS', 350, 2800, 3, 16, 2],
    ['Batteries', 'BAT', 900, 4500, 2, 10, 1],
    ['Chains', 'CHN', 200, 900, 5, 30, 3]
  ];
  const descriptors = [
    'Standard', 'Heavy Duty', 'OEM Spec', 'Aftermarket', 'High Temp', 'Low Profile',
    'Reinforced', 'Metric', 'Imperial', 'Long Life', 'Premium', 'Economy',
    'Sealed', 'Open', 'Double Row', 'Single', 'Kit', 'Assembly'
  ];
  data.parts = [];
  let pid = 1;
  for (const [cat, prefix, costLo, costHi, minS, maxS, safety] of categories) {
    for (let n = 1; n <= 26; n++) {
      const cost = Math.round((costLo + (costHi - costLo) * (n / 26)) * 100) / 100;
      const desc = descriptors[n % descriptors.length] + ' ' + cat.slice(0, -1) + ' ' + n;
      const part_number = prefix + '-' + String(1000 + n) + (n % 3 === 0 ? '-HD' : '');
      const alt1 = prefix + String(n).padStart(3, '0');
      const alt2 = 'OEM-' + prefix + '-' + (5000 + n);
      data.parts.push({
        id: pid++,
        part_number,
        description: desc,
        category: cat,
        unit: cat === 'Lubricants' ? 'L' : (cat === 'Tyres-OTR' ? 'EA' : 'EA'),
        unit_cost: cost,
        supplier_id: ((pid + n) % supplierNames.length) + 1,
        min_stock: minS,
        max_stock: maxS,
        safety_stock: safety,
        status: 'Active',
        reclass_status: cost > 5000 ? 'Capital' : 'Standard',
        alternate_numbers: [alt1, alt2]
      });
    }
  }
  // pad to at least 520
  while (data.parts.length < 520) {
    const n = data.parts.length + 1;
    data.parts.push({
      id: pid++,
      part_number: 'GEN-' + String(n).padStart(4, '0'),
      description: 'General spare item ' + n,
      category: 'General',
      unit: 'EA',
      unit_cost: 50 + (n % 200),
      supplier_id: (n % supplierNames.length) + 1,
      min_stock: 5,
      max_stock: 40,
      safety_stock: 2,
      status: 'Active',
      reclass_status: 'Standard',
      alternate_numbers: ['ALT-' + n, 'SUP-' + (10000 + n)]
    });
  }
  data._meta.nextId.parts = pid;

  // Branch stock for all parts at MAIN + sample at other branches
  data.branch_stock = [];
  let bsId = 1;
  const branchIds = data.branches.map(b => b.id);
  for (const part of data.parts) {
    // Main always has stock
    const qtyMain = Math.max(0, Math.floor(Math.random() * (part.max_stock + 5)));
    // force ~8% below min for realistic reorder alerts
    const finalQty = (part.id % 12 === 0) ? Math.max(0, part.min_stock - 2) : qtyMain;
    data.branch_stock.push({
      id: bsId++,
      branch_id: 1,
      part_id: part.id,
      quantity: finalQty,
      bin_location: String.fromCharCode(65 + (part.id % 6)) + '-' + String((part.id % 20) + 1).padStart(2, '0') + '-' + String((part.id % 8) + 1).padStart(2, '0'),
      stock_on_order: 0,
      status: 'Available'
    });
    // Other branches: subset of parts
    if (part.id % 3 === 0) {
      for (const bid of branchIds) {
        if (bid === 1) continue;
        if (part.id % (bid + 2) !== 0) continue;
        data.branch_stock.push({
          id: bsId++,
          branch_id: bid,
          part_id: part.id,
          quantity: Math.floor(Math.random() * Math.max(1, Math.floor(part.min_stock * 1.5))),
          bin_location: 'B' + bid + '-' + (part.id % 10),
          stock_on_order: 0,
          status: 'Available'
        });
      }
    }
  }
  data._meta.nextId.branch_stock = bsId;

  data.technicians = [
    { id: 1, name: 'Pieter Botha', employee_code: 'TECH-001', branch_id: 1, phone: '082-111-2222', skill_level: 'Senior', active: 1 },
    { id: 2, name: 'Lerato Dlamini', employee_code: 'TECH-002', branch_id: 1, phone: '083-333-4444', skill_level: 'Intermediate', active: 1 },
    { id: 3, name: 'Ahmed Hassan', employee_code: 'TECH-003', branch_id: 2, phone: '084-555-6666', skill_level: 'Junior', active: 1 },
    { id: 4, name: 'Thabo Molefe', employee_code: 'TECH-004', branch_id: 3, phone: '082-777-8888', skill_level: 'Senior', active: 1 },
    { id: 5, name: 'Sarah Naidoo', employee_code: 'TECH-005', branch_id: 4, phone: '083-999-0000', skill_level: 'Intermediate', active: 1 },
    { id: 6, name: 'Johan van Wyk', employee_code: 'TECH-006', branch_id: 5, phone: '084-111-3333', skill_level: 'Senior', active: 1 },
    { id: 7, name: 'Nomsa Khumalo', employee_code: 'TECH-007', branch_id: 6, phone: '082-222-4444', skill_level: 'Junior', active: 1 },
    { id: 8, name: 'Chris Petersen', employee_code: 'TECH-008', branch_id: 1, phone: '083-333-5555', skill_level: 'Senior', active: 1 }
  ];
  data._meta.nextId.technicians = 9;

  data.service_types = [
    { id: 1, code: 'SVC-250HR', name: '250 Hour Service', asset_type: 'General', interval_hours: 250, interval_days: null, checklist: 'Oil, filters, grease, inspection' },
    { id: 2, code: 'SVC-500HR', name: '500 Hour Service', asset_type: 'General', interval_hours: 500, interval_days: null, checklist: 'Full 250hr + hydraulics sample' },
    { id: 3, code: 'SVC-1000HR', name: '1000 Hour Service', asset_type: 'General', interval_hours: 1000, interval_days: null, checklist: 'Major service' },
    { id: 4, code: 'SVC-500HR-WL', name: '500 Hour Service – Wheel Loader', asset_type: 'Wheel Loader', interval_hours: 500, interval_days: null, checklist: 'Engine oil & filter, Fuel filter, Air filter, Grease, Hydraulics, Bucket pins' },
    { id: 5, code: 'SVC-500HR-FK', name: '500 Hour Service – Forklift', asset_type: 'Forklift', interval_hours: 500, interval_days: null, checklist: 'Mast, chains, forks, hydraulics, battery/L-gas' },
    { id: 6, code: 'SVC-500HR-RS', name: '500 Hour Service – Reach Stacker', asset_type: 'Reach Stacker', interval_hours: 500, interval_days: null, checklist: 'Boom, spreader, hydraulics, tyres' },
    { id: 7, code: 'SVC-500HR-DT', name: '500 Hour Service – Dump Truck', asset_type: 'Dump Truck', interval_hours: 500, interval_days: null, checklist: 'Engine, transmission, bin, suspension' },
    { id: 8, code: 'SVC-ANNUAL', name: 'Annual Inspection', asset_type: 'General', interval_hours: null, interval_days: 365, checklist: 'Statutory / safety inspection' }
  ];
  data._meta.nextId.service_types = 9;

  // ---- ~100 assets ----
  const fleets = [
    { type: 'Wheel Loader', brand: 'CAT', models: ['950M', '966M', '980M', '950GC'], count: 12 },
    { type: 'Wheel Loader', brand: 'Volvo', models: ['L120H', 'L150H', 'L180H'], count: 8 },
    { type: 'Forklift', brand: 'Toyota', models: ['8FG25', '8FG30', '8FBMT25'], count: 18 },
    { type: 'Forklift', brand: 'Hyster', models: ['H2.5XT', 'H3.0XT', 'J2.5XN'], count: 10 },
    { type: 'Reach Stacker', brand: 'Kalmar', models: ['DRG450', 'DRG420'], count: 6 },
    { type: 'Reach Stacker', brand: 'SANY', models: ['SRC450', 'SRC400'], count: 5 },
    { type: 'Dump Truck', brand: 'CAT', models: ['770G', '772G', '777E'], count: 10 },
    { type: 'Dump Truck', brand: 'Bell', models: ['B30E', 'B40E', 'B50E'], count: 8 },
    { type: 'Excavator', brand: 'CAT', models: ['320', '323', '336'], count: 10 },
    { type: 'Excavator', brand: 'Komatsu', models: ['PC210', 'PC300'], count: 6 },
    { type: 'Telehandler', brand: 'JCB', models: ['540-140', '535-95'], count: 5 },
    { type: 'Telehandler', brand: 'Manitou', models: ['MT1840', 'MT1440'], count: 4 }
  ];
  data.assets = [];
  let aid = 1;
  const yards = ['Yard 1', 'Yard 2', 'Plant A', 'Plant B', 'Workshop', 'Bay 1', 'Bay 2', 'Pit side', 'Stockyard', 'Quay'];
  for (const fleet of fleets) {
    for (let i = 0; i < fleet.count; i++) {
      const model = fleet.models[i % fleet.models.length];
      const code = fleet.type.replace(/\s/g, '').slice(0, 3).toUpperCase() + '-' + fleet.brand.slice(0, 3).toUpperCase() + '-' + String(aid).padStart(3, '0');
      const hours = 800 + Math.floor(Math.random() * 9000);
      const lastSvc = hours - (200 + Math.floor(Math.random() * 400));
      const year = 2016 + (i % 9);
      const purchase = year + '-' + String((i % 12) + 1).padStart(2, '0') + '-15';
      const wExp = (year + 5) + '-12-31';
      data.assets.push({
        id: aid,
        code,
        name: fleet.brand + ' ' + model + ' ' + fleet.type,
        asset_type: fleet.type,
        branch_id: ((aid - 1) % data.branches.length) + 1,
        hour_meter: hours,
        last_service_hours: Math.max(0, lastSvc),
        status: aid % 17 === 0 ? 'Down' : 'Operational',
        serial_number: fleet.brand.slice(0, 3).toUpperCase() + year + String(1000 + aid),
        purchase_date: purchase,
        warranty_expiry: wExp,
        warranty_notes: (year + 5) >= 2026 ? 'Standard OEM warranty' : 'Out of warranty',
        location_detail: yards[aid % yards.length] + ' – ' + data.branches[(aid - 1) % data.branches.length].code
      });
      aid++;
    }
  }
  data._meta.nextId.assets = aid;

  // Sample downtime for some Down assets
  data.downtime_events = [];
  let did = 1;
  for (const a of data.assets.filter(x => x.status === 'Down').slice(0, 8)) {
    data.downtime_events.push({
      id: did++,
      asset_id: a.id,
      started_at: new Date(Date.now() - (a.id % 48) * 3600000).toISOString(),
      ended_at: null,
      reason: 'Breakdown',
      notes: 'Awaiting parts',
      opened_by: 'System Seed',
      job_id: null
    });
  }
  data._meta.nextId.downtime_events = did;

  // BOMs
  data.boms = [
    { id: 1, code: 'BOM-500HR-GEN', name: '500hr General Service Kit', service_type_id: 2, notes: 'Generic', active: 1 },
    { id: 2, code: 'BOM-500HR-WL', name: '500hr Wheel Loader Kit', service_type_id: 4, notes: '', active: 1 },
    { id: 3, code: 'BOM-500HR-FK', name: '500hr Forklift Kit', service_type_id: 5, notes: '', active: 1 },
    { id: 4, code: 'BOM-500HR-RS', name: '500hr Reach Stacker Kit', service_type_id: 6, notes: '', active: 1 },
    { id: 5, code: 'BOM-500HR-DT', name: '500hr Dump Truck Kit', service_type_id: 7, notes: '', active: 1 }
  ];
  data._meta.nextId.boms = 6;
  data.bom_items = [];
  let bi = 1;
  for (const bom of data.boms) {
    for (let k = 0; k < 6; k++) {
      const part = data.parts[(bom.id * 7 + k * 11) % data.parts.length];
      data.bom_items.push({ id: bi++, bom_id: bom.id, part_id: part.id, quantity: 1 + (k % 3) });
    }
  }
  data._meta.nextId.bom_items = bi;

  // Sample job cards
  data.job_cards = [];
  for (let j = 1; j <= 25; j++) {
    const asset = data.assets[j % data.assets.length];
    data.job_cards.push({
      id: j,
      job_number: 'JC-2026-' + String(j).padStart(4, '0'),
      title: (j % 3 === 0 ? 'PM: ' : 'Repair: ') + asset.name,
      description: 'Seeded work order',
      asset_id: asset.id,
      service_type_id: (j % 8) + 1,
      bom_id: (j % 5) + 1,
      branch_id: asset.branch_id,
      priority: ['Low', 'Medium', 'High', 'Critical'][j % 4],
      status: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OPEN'][j % 5],
      technician_id: (j % 8) + 1,
      scheduled_date: '2026-09-' + String((j % 28) + 1).padStart(2, '0'),
      completed_date: j % 5 === 3 ? '2026-09-01' : null,
      estimated_hours: 2 + (j % 6),
      actual_hours: j % 5 === 3 ? 3 + (j % 4) : null,
      labour_rate: 450,
      created_by: 'Seed',
      pm_auto: j % 3 === 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  data._meta.nextId.job_cards = 26;

  // Service history samples
  data.service_history = [];
  let hid = 1;
  for (let i = 0; i < 40; i++) {
    const asset = data.assets[i % data.assets.length];
    data.service_history.push({
      id: hid++,
      asset_id: asset.id,
      job_id: null,
      service_type_id: (i % 8) + 1,
      date: '2026-0' + String(1 + (i % 8)) + '-' + String(10 + (i % 18)).padStart(2, '0'),
      hour_meter: Math.max(0, (asset.hour_meter || 0) - 200 - i * 3),
      summary: 'Scheduled service',
      performed_by: data.technicians[i % data.technicians.length].name,
      notes: ''
    });
  }
  data._meta.nextId.service_history = hid;

  // Sample movements with names/dates
  data.stock_movements = [];
  let mid = 1;
  const movers = ['Karabo Mokholo', 'Main Storeman', 'CPT Branch User', 'Pieter Botha'];
  const mtypes = ['RECEIVE', 'ISSUE', 'PICK', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUST'];
  for (let i = 0; i < 80; i++) {
    const part = data.parts[i % 50];
    const mt = mtypes[i % mtypes.length];
    data.stock_movements.push({
      id: mid++,
      transfer_code: 'SEED-' + String(1000 + i),
      part_id: part.id,
      branch_id: (i % 4) + 1,
      movement_type: mt,
      quantity: 1 + (i % 10),
      from_bin: 'A-01',
      to_bin: mt === 'RECEIVE' ? 'A-01' : null,
      reference: 'SEED',
      notes: 'Demo movement',
      performed_by: movers[i % movers.length],
      user_id: (i % 3) + 1,
      related_request_id: null,
      job_id: null,
      created_at: new Date(Date.now() - i * 3600000 * 5).toISOString()
    });
  }
  data._meta.nextId.stock_movements = mid;
  data._meta.transferSeq = 2000;

  data.part_requests = [];
  data.purchase_orders = [];
  data.po_items = [];
  data.invoices = [];
  data.invoice_items = [];
  data.supplier_orders = [];
  data.supplier_order_items = [];
  data.purchase_requests = [];
  data.purchase_request_items = [];
  data.quotations = [];
  data.quotation_items = [];
  data.stock_takes = [];
  data.stock_take_lines = [];
  data.job_parts = [];
  data.login_logs = [];
  data.sessions = [];

  save(data);
  console.log('Seed complete:', data.parts.length, 'parts,', data.assets.length, 'assets,', data.suppliers.length, 'suppliers');
  console.log('Login: admin@ghm.local / admin123');
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
          reclass_status: p?.reclass_status,
          alternate_numbers: Array.isArray(p?.alternate_numbers) ? p.alternate_numbers : []
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
      const alts = Array.isArray(p.alternate_numbers) ? p.alternate_numbers : [];
      return { ...p, alternate_numbers: alts, supplier_name: s ? s.name : null };
    });
  },

  /** Find part by main number OR any alternate number */
  findPartByAnyNumber(num) {
    const q = String(num).trim().toLowerCase();
    if (!q) return null;
    return data.parts.find(p => {
      if ((p.part_number || '').toLowerCase() === q) return true;
      const alts = Array.isArray(p.alternate_numbers) ? p.alternate_numbers : [];
      return alts.some(a => String(a).toLowerCase() === q);
    }) || null;
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
      const who = (u?.name || m.performed_by || 'Unknown').trim();
      const actionWords = {
        RECEIVE: 'received in',
        RETURN: 'returned to stock',
        ISSUE: 'booked out',
        PICK: 'picked',
        TRANSFER_OUT: 'transferred out',
        TRANSFER_IN: 'transferred in',
        ADJUST: 'adjusted stock to'
      };
      const action = actionWords[m.movement_type] || String(m.movement_type || '').toLowerCase();
      const when = m.created_at ? new Date(m.created_at).toLocaleString() : '';
      const summary = `${who} ${action} ${Math.abs(m.quantity)} × ${p?.part_number || 'item'}${p?.description ? ' (' + p.description + ')' : ''} on ${when}`;
      return {
        ...m,
        part_number: p?.part_number,
        description: p?.description,
        branch_code: b?.code,
        branch_name: b?.name,
        user_name: who,
        summary
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


  getAssetEnriched(id) {
    const a = this.getById('assets', id);
    if (!a) return null;
    const b = data.branches.find(x => x.id === a.branch_id);
    const history = (data.service_history || [])
      .filter(h => h.asset_id === Number(id))
      .map(h => {
        const st = data.service_types.find(x => x.id === h.service_type_id);
        const job = h.job_id ? data.job_cards.find(x => x.id === h.job_id) : null;
        return { ...h, service_type_name: st?.name, job_number: job?.job_number };
      })
      .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const openDowntime = (data.downtime_events || []).filter(d => d.asset_id === Number(id) && !d.ended_at);
    const warrantyActive = a.warranty_expiry ? (a.warranty_expiry >= new Date().toISOString().slice(0, 10)) : false;
    return {
      ...a,
      branch_name: b?.name,
      branch_code: b?.code,
      service_history: history,
      open_downtime: openDowntime,
      warranty_active: warrantyActive
    };
  },

  /** Create PM jobs for assets that are due and don't already have an open PM job for that service type */
  runPreventiveMaintenance() {
    const created = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const asset of data.assets) {
      const types = data.service_types.filter(st =>
        st.asset_type === asset.asset_type || st.asset_type === 'General'
      );
      for (const st of types) {
        let due = false;
        if (st.interval_hours && asset.hour_meter != null) {
          const since = (asset.hour_meter || 0) - (asset.last_service_hours || 0);
          if (since >= st.interval_hours) due = true;
        }
        // day-based: use last history date or purchase_date
        if (st.interval_days) {
          const hist = (data.service_history || [])
            .filter(h => h.asset_id === asset.id && h.service_type_id === st.id)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          const last = hist[0]?.date || asset.purchase_date;
          if (last) {
            const lastD = new Date(last);
            const diff = (Date.now() - lastD.getTime()) / (1000 * 60 * 60 * 24);
            if (diff >= st.interval_days) due = true;
          }
        }
        if (!due) continue;
        // skip if open job already exists for this asset + service type
        const exists = data.job_cards.some(j =>
          j.asset_id === asset.id &&
          j.service_type_id === st.id &&
          !['COMPLETED', 'CANCELLED'].includes(j.status)
        );
        if (exists) continue;

        const all = data.job_cards;
        let jn = 'JC-2026-0001';
        if (all.length) {
          const last = all[all.length - 1].job_number;
          jn = `JC-2026-${String(parseInt(last.split('-').pop(), 10) + 1).padStart(4, '0')}`;
        }
        const bom = data.boms.find(b => b.service_type_id === st.id);
        const job = this.insert('job_cards', {
          job_number: jn,
          title: `PM: ${st.name} – ${asset.code}`,
          description: `Auto-generated preventive maintenance for ${asset.name}`,
          asset_id: asset.id,
          service_type_id: st.id,
          bom_id: bom ? bom.id : null,
          branch_id: asset.branch_id || 1,
          priority: 'Medium',
          status: 'OPEN',
          technician_id: null,
          scheduled_date: today,
          completed_date: null,
          estimated_hours: null,
          actual_hours: null,
          created_by: 'PM Scheduler',
          pm_auto: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        created.push(job);
      }
    }
    return created;
  },

  getMaintenanceKpis() {
    const jobs = data.job_cards || [];
    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const open = jobs.filter(j => !['COMPLETED', 'CANCELLED'].includes(j.status));
    const downtime = data.downtime_events || [];
    let totalDowntimeHours = 0;
    const now = Date.now();
    for (const d of downtime) {
      const start = new Date(d.started_at).getTime();
      const end = d.ended_at ? new Date(d.ended_at).getTime() : now;
      if (!isNaN(start)) totalDowntimeHours += Math.max(0, (end - start) / 3600000);
    }
    const openDowntime = downtime.filter(d => !d.ended_at).length;
    // repairs = completed jobs that are not PM-only optional; count all completed as repairs/services
    const repairsCompleted = completed.length;
    const pmJobs = jobs.filter(j => j.pm_auto || (j.title || '').startsWith('PM:'));
    const avgHours = completed.length
      ? completed.reduce((s, j) => s + (Number(j.actual_hours) || Number(j.estimated_hours) || 0), 0) / completed.length
      : 0;
    // simple MTTR proxy: average downtime hours per closed downtime event
    const closedDt = downtime.filter(d => d.ended_at);
    const mttr = closedDt.length
      ? closedDt.reduce((s, d) => {
          const hrs = (new Date(d.ended_at) - new Date(d.started_at)) / 3600000;
          return s + (hrs > 0 ? hrs : 0);
        }, 0) / closedDt.length
      : 0;
    return {
      open_work_orders: open.length,
      completed_repairs: repairsCompleted,
      pm_jobs_total: pmJobs.length,
      pm_jobs_open: pmJobs.filter(j => !['COMPLETED', 'CANCELLED'].includes(j.status)).length,
      total_downtime_hours: Math.round(totalDowntimeHours * 10) / 10,
      open_downtime_events: openDowntime,
      mttr_hours: Math.round(mttr * 10) / 10,
      avg_job_hours: Math.round(avgHours * 10) / 10,
      assets_count: (data.assets || []).length,
      assets_under_warranty: (data.assets || []).filter(a => a.warranty_expiry && a.warranty_expiry >= new Date().toISOString().slice(0, 10)).length
    };
  },

  _data: () => data,
  _save: () => save(data)
};

module.exports = db;
