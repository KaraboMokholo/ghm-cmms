const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    let parts = db.getPartsWithSupplier();
    const { search, category, lowStock, bin } = req.query;

    if (search) {
      const q = search.toLowerCase();
      parts = parts.filter(p =>
        p.part_number.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    if (category) parts = parts.filter(p => p.category === category);
    if (bin) parts = parts.filter(p => (p.bin_location || '').includes(bin));
    if (lowStock === 'true') parts = parts.filter(p => p.quantity <= p.min_stock);

    parts.sort((a, b) => a.part_number.localeCompare(b.part_number));
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const part = db.getPartsWithSupplier().find(p => p.id === Number(req.params.id));
    if (!part) return res.status(404).json({ error: 'Part not found' });
    res.json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const {
      part_number, description, bin_location, quantity = 0,
      min_stock = 0, max_stock = 0, safety_stock = 0,
      stock_on_order = 0, unit_cost = 0, supplier_id,
      category, unit = 'EA', notes
    } = req.body;

    if (!part_number || !description) {
      return res.status(400).json({ error: 'part_number and description are required' });
    }
    if (db.getAll('parts').some(p => p.part_number === part_number)) {
      return res.status(400).json({ error: 'Part number already exists' });
    }

    const part = db.insert('parts', {
      part_number, description, bin_location: bin_location || null,
      quantity: Number(quantity), min_stock: Number(min_stock),
      max_stock: Number(max_stock), safety_stock: Number(safety_stock),
      stock_on_order: Number(stock_on_order), unit_cost: Number(unit_cost),
      supplier_id: supplier_id ? Number(supplier_id) : null,
      category: category || null, unit, notes: notes || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    res.status(201).json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    const part = db.update('parts', req.params.id, updates);
    if (!part) return res.status(404).json({ error: 'Part not found' });
    res.json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    if (!db.remove('parts', req.params.id)) {
      return res.status(404).json({ error: 'Part not found' });
    }
    res.json({ message: 'Part deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
