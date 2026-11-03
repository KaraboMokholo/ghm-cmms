const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const parts = db.getAll('parts');
    const jobs = db.getJobsWithTech();
    const pos = db.getAll('purchase_orders');

    const totalParts = parts.length;
    const lowStock = parts.filter(p => p.quantity <= p.min_stock).length;
    const openJobs = jobs.filter(j => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(j.status)).length;
    const criticalJobs = jobs.filter(j => j.priority === 'Critical' && !['COMPLETED', 'CANCELLED'].includes(j.status)).length;
    const openPOs = pos.filter(p => !['RECEIVED', 'CANCELLED'].includes(p.status)).length;
    const inventoryValue = parts.reduce((sum, p) => sum + (p.quantity * p.unit_cost), 0);

    const lowStockItems = parts
      .filter(p => p.quantity <= p.min_stock)
      .sort((a, b) => (b.min_stock - b.quantity) - (a.min_stock - a.quantity))
      .slice(0, 10)
      .map(p => ({
        part_number: p.part_number,
        description: p.description,
        quantity: p.quantity,
        min_stock: p.min_stock,
        bin_location: p.bin_location
      }));

    const upcomingJobs = jobs
      .filter(j => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(j.status))
      .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
      .slice(0, 8)
      .map(j => ({
        job_number: j.job_number,
        title: j.title,
        priority: j.priority,
        scheduled_date: j.scheduled_date,
        status: j.status,
        technician_name: j.technician_name
      }));

    res.json({
      summary: {
        totalParts,
        lowStock,
        openJobs,
        criticalJobs,
        openPOs,
        inventoryValue: Math.round(inventoryValue * 100) / 100
      },
      lowStockItems,
      upcomingJobs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
