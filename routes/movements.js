const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    let movements = db.getMovementsWithPart();
    const { part_id, type, limit = 100 } = req.query;
    if (part_id) movements = movements.filter(m => m.part_id === Number(part_id));
    if (type) movements = movements.filter(m => m.movement_type === type);
    res.json(movements.slice(0, Number(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const {
    part_id, movement_type, quantity,
    from_bin, to_bin, reference, notes, performed_by
  } = req.body;

  if (!part_id || !movement_type || quantity === undefined) {
    return res.status(400).json({ error: 'part_id, movement_type and quantity are required' });
  }

  const validTypes = ['RECEIVE', 'ADJUST', 'TRANSFER', 'ISSUE', 'RETURN'];
  if (!validTypes.includes(movement_type)) {
    return res.status(400).json({ error: 'Invalid movement_type' });
  }

  try {
    const part = db.getById('parts', part_id);
    if (!part) return res.status(404).json({ error: 'Part not found' });

    const qty = Number(quantity);
    let newQty = part.quantity;
    let newBin = part.bin_location;

    if (movement_type === 'RECEIVE' || movement_type === 'RETURN') {
      newQty += Math.abs(qty);
    } else if (movement_type === 'ISSUE') {
      newQty -= Math.abs(qty);
      if (newQty < 0) return res.status(400).json({ error: 'Insufficient stock' });
    } else if (movement_type === 'ADJUST') {
      newQty = qty;
    } else if (movement_type === 'TRANSFER') {
      if (to_bin) newBin = to_bin;
    }

    const movement = db.insert('stock_movements', {
      part_id: Number(part_id),
      movement_type,
      quantity: qty,
      from_bin: from_bin || null,
      to_bin: to_bin || null,
      reference: reference || null,
      notes: notes || null,
      performed_by: performed_by || 'System',
      created_at: new Date().toISOString()
    });

    const updates = { updated_at: new Date().toISOString() };
    if (movement_type === 'TRANSFER') {
      updates.bin_location = newBin;
    } else {
      updates.quantity = newQty;
    }
    db.update('parts', part_id, updates);

    const full = db.getMovementsWithPart().find(m => m.id === movement.id);
    res.status(201).json(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
