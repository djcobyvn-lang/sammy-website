const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const webhookRoutes = require('./routes/webhook');
const courseRoutes  = require('./routes/course');
const orderRoutes   = require('./routes/order');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth',    authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/course',  courseRoutes);
app.use('/api/order',   orderRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
