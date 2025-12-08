// small helper to show a clear message if a dependency is missing
const safeRequire = (moduleName) => {
  try {
    return require(moduleName);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.error(`\nERROR: Missing module "${moduleName}".\nRun "npm install" in the project root to install dependencies and try again.\n`);
      process.exit(1);
    }
    throw err;
  }
};

const express = safeRequire('express'); 
const cors = safeRequire('cors');
const morgan = safeRequire('morgan');
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

// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:5173', 'https://techstahr-khaki.vercel.app', 'https://techstahr.com', 'https://dashboard.techstahr.com', 'https://usetechstarhr.vercel.app', 'app://']
// }));
app.use(cors({
  origin: '*' 
}));

// Log ALL requests before any parsing
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  
  // Special logging for webhook endpoint
  if (req.originalUrl.includes('flutterwave-webhook')) {
    console.log('🔔 WEBHOOK REQUEST DETECTED!');
  }
  next();
});

app.use(morgan('dev'));
// Increase body size limit for webhooks (Flutterwave can send large payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log body after parsing for webhook
app.use((req, res, next) => {
  if (req.originalUrl.includes('flutterwave-webhook')) {
    console.log('📦 Parsed Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});
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

app.get('/', (req, res) => {
  res.send('Techstahr backend is live 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
