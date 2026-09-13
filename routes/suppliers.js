const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const suppliers = db.getAll('suppliers').sort((a, b) => a.name.localeCompare(b.name));
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (db.getAll('suppliers').some(s => s.name === name)) {
    return res.status(400).json({ error: 'Supplier name already exists' });
  }
  try {
    const supplier = db.insert('suppliers', {
      name,
      contact_person: contact_person || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      created_at: new Date().toISOString()
    });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
