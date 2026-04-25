const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const ORDERS_PATH = path.join(__dirname, '../data/orders.json');

function readOrders() {
  if (!fs.existsSync(ORDERS_PATH)) {
    fs.mkdirSync(path.dirname(ORDERS_PATH), { recursive: true });
    fs.writeFileSync(ORDERS_PATH, '[]');
  }
  return JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
}
function writeOrders(data) {
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(data, null, 2));
}

// Tìm đơn pending gần nhất theo gói
function findPendingOrder(pkgId) {
  const orders = readOrders();
  return [...orders].reverse().find(o =>
    o.packageId === pkgId &&
    (o.status === 'pending_verification' || o.status === 'pending')
  ) || null;
}

// Đánh dấu đơn đã hoàn thành
function completeOrder(orderId) {
  const orders = readOrders();
  const idx    = orders.findIndex(o => o.id === orderId);
  if (idx > -1) {
    orders[idx].status      = 'completed';
    orders[idx].completedAt = new Date().toISOString();
    writeOrders(orders);
    return orders[idx];
  }
  return null;
}

// POST /api/order/confirm — Khách bấm "Tôi đã chuyển khoản"
router.post('/confirm', (req, res) => {
  try {
    const { packageId, packageName, price, customerName, email, zalo, confirmedAt } = req.body;
    const orders = readOrders();
    const order  = {
      id: Date.now().toString(),
      packageId, packageName, price,
      customerName, email, zalo,
      status:      'pending_verification',
      confirmedAt: confirmedAt || new Date().toISOString()
    };
    orders.push(order);
    writeOrders(orders);
    console.log(`[Order] ${customerName} xác nhận CK — ${packageName}`);
    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// GET /api/order/list
router.get('/list', (req, res) => {
  res.json(readOrders());
});

module.exports = router;
module.exports.findPendingOrder = findPendingOrder;
module.exports.completeOrder    = completeOrder;
