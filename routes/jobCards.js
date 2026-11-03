const express = require('express');
const router = express.Router();
const db = require('../db/database');

function nextJobNumber() {
  const jobs = db.getAll('job_cards');
  if (!jobs.length) return 'JC-2026-0001';
  const last = jobs[jobs.length - 1].job_number;
  const num = parseInt(last.split('-').pop(), 10) + 1;
  return `JC-2026-${String(num).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  try {
    let jobs = db.getJobsWithTech();
    const { status, upcoming, past } = req.query;

    if (status) jobs = jobs.filter(j => j.status === status);
    if (upcoming === 'true') {
      jobs = jobs.filter(j => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(j.status));
    }
    if (past === 'true') {
      jobs = jobs.filter(j => ['COMPLETED', 'CANCELLED'].includes(j.status));
    }

    const priorityOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };
    jobs.sort((a, b) => {
      const pa = priorityOrder[a.priority] || 5;
      const pb = priorityOrder[b.priority] || 5;
      if (pa !== pb) return pa - pb;
      return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
    });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const job = db.getJobsWithTech().find(j => j.id === Number(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const parts = db.getAll('job_parts')
      .filter(jp => jp.job_id === job.id)
      .map(jp => {
        const p = db.getById('parts', jp.part_id);
        return { ...jp, part_number: p?.part_number, description: p?.description };
      });
    res.json({ ...job, parts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const {
    title, description, asset_name, asset_location,
    priority = 'Medium', technician_id, scheduled_date,
    estimated_hours, notes, created_by
  } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const job = db.insert('job_cards', {
      job_number: nextJobNumber(),
      title,
      description: description || null,
      asset_name: asset_name || null,
      asset_location: asset_location || null,
      priority,
      status: technician_id ? 'ASSIGNED' : 'OPEN',
      technician_id: technician_id ? Number(technician_id) : null,
      scheduled_date: scheduled_date || null,
      completed_date: null,
      estimated_hours: estimated_hours ? Number(estimated_hours) : null,
      actual_hours: null,
      notes: notes || null,
      created_by: created_by || 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    const job = db.update('job_cards', req.params.id, updates);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/issue-parts', (req, res) => {
  const { part_id, quantity, performed_by } = req.body;
  if (!part_id || !quantity) {
    return res.status(400).json({ error: 'part_id and quantity required' });
  }

  try {
    const part = db.getById('parts', part_id);
    if (!part) return res.status(404).json({ error: 'Part not found' });
    if (part.quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    db.insert('job_parts', {
      job_id: Number(req.params.id),
      part_id: Number(part_id),
      quantity_used: Number(quantity)
    });

    db.insert('stock_movements', {
      part_id: Number(part_id),
      movement_type: 'ISSUE',
      quantity: Number(quantity),
      from_bin: null,
      to_bin: null,
      reference: `Job ${req.params.id}`,
      notes: 'Issued to job card',
      performed_by: performed_by || 'System',
      created_at: new Date().toISOString()
    });

    db.update('parts', part_id, {
      quantity: part.quantity - Number(quantity),
      updated_at: new Date().toISOString()
    });

    res.json({ message: 'Parts issued successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
