const express = require('express');
const router = express.Router();
const db = require('../db/database');

function nextPONumber() {
  const pos = db.getAll('purchase_orders');
  if (!pos.length) return 'PO-2026-0001';
  const last = pos[pos.length - 1].po_number;
  const num = parseInt(last.split('-').pop(), 10) + 1;
  return `PO-2026-${String(num).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  try {
    let pos = db.getPOsWithSupplier();
    if (req.query.status) pos = pos.filter(p => p.status === req.query.status);
    pos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const po = db.getPOsWithSupplier().find(p => p.id === Number(req.params.id));
    if (!po) return res.status(404).json({ error: 'PO not found' });
    const items = db.getAll('po_items')
      .filter(i => i.po_id === po.id)
      .map(i => {
        const p = db.getById('parts', i.part_id);
        return { ...i, part_number: p?.part_number, description: p?.description };
      });
    res.json({ ...po, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { supplier_id, expected_date, notes, created_by, items = [] } = req.body;
  if (!supplier_id || !items.length) {
    return res.status(400).json({ error: 'supplier_id and at least one item required' });
  }

  try {
    const total = items.reduce((sum, i) => sum + (i.quantity_ordered * (i.unit_cost || 0)), 0);
    const po = db.insert('purchase_orders', {
      po_number: nextPONumber(),
      supplier_id: Number(supplier_id),
      status: 'DRAFT',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: expected_date || null,
      total_amount: total,
      notes: notes || null,
      created_by: created_by || 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    for (const item of items) {
      db.insert('po_items', {
        po_id: po.id,
        part_id: Number(item.part_id),
        quantity_ordered: Number(item.quantity_ordered),
        quantity_received: 0,
        unit_cost: Number(item.unit_cost) || 0
      });
      const part = db.getById('parts', item.part_id);
      if (part) {
        db.update('parts', item.part_id, {
          stock_on_order: (part.stock_on_order || 0) + Number(item.quantity_ordered),
          updated_at: new Date().toISOString()
        });
      }
    }

    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const po = db.update('purchase_orders', req.params.id, {
      status,
      updated_at: new Date().toISOString()
    });
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json({ message: 'Status updated', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
