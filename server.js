const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const ConnectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const myTaskRoutes = require('./routes/myTaskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const productivityRoutes = require('./routes/productivityRoutes');
const projectRoutes = require('./routes/projectRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const billingRoutes = require('./routes/billingRoutes');
const screenshotRoutes = require('./routes/screenshotRoutes');
const timeRoutes = require('./routes/timeRoutes');

require('./cron/deadline-reminder');
require('./cron/screenshot-worker');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://techstahr-khaki.vercel.app', 'https://techstahr.com', 'https://dashboard.techstahr.com']
}));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 5000;

ConnectDB();

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/task', myTaskRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/productivity', productivityRoutes);
app.use('/api/v1/project', projectRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/people', peopleRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/screenshot', screenshotRoutes);
app.use('/api/v1/time', timeRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});