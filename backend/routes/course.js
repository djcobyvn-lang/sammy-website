const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('./auth');
const { findStudent } = require('../db');

// GET /api/course/verify — Kiểm tra quyền truy cập khóa học
router.get('/verify', authMiddleware, (req, res) => {
  const student = findStudent(req.user.email);
  if (!student || !student.activated) {
    return res.status(403).json({ access: false, message: 'Chưa kích hoạt' });
  }
  res.json({
    access:   true,
    name:     student.fullName,
    email:    student.email,
    paidAt:   student.paidAt
  });
});

module.exports = router;
