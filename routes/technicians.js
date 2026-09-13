const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const techs = db.getAll('technicians')
      .filter(t => t.active)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, employee_code, phone, email, skill_level } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const tech = db.insert('technicians', {
      name,
      employee_code: employee_code || null,
      phone: phone || null,
      email: email || null,
      skill_level: skill_level || 'Junior',
      active: 1,
      created_at: new Date().toISOString()
    });
    res.status(201).json(tech);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
