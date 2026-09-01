const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const errorHandler = require('./middleware/errorHandler');

// Sync user uploaded and generated images to frontend/images folder
try {
  const srcDir = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\252c177c-e82d-4ed9-88ad-104527bae301';
  const dstDir = path.resolve(__dirname, '../../../frontend/images');
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const fileMap = {
    'media__1786512340775.jpg': 'flag-procession.jpg',
    'media__1786512340926.jpg': 'youth-worship.jpg',
    'media__1786512341000.jpg': 'youth-march.jpg',
    'media__1786512341075.jpg': 'group-photo.jpg',
    'media__1786512341085.jpg': 'matron-celine.jpg',
    'media__1786514321055.jpg': 'leader-nomiya-banner.jpg',
    'media__1786514321093.jpg': 'matron-white-peach.jpg',
    'media__1786514321214.jpg': 'member-blue-doors.jpg',
    'media__1786514321222.jpg': 'member-tunic-indoor.jpg',
    'media__1786514321342.jpg': 'member-holding-flag.jpg'
  };

  for (const [src, dst] of Object.entries(fileMap)) {
    const srcPath = path.join(srcDir, src);
    const dstPath = path.join(dstDir, dst);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, dstPath);
      // Also save with raw source name as fallback
      fs.copyFileSync(srcPath, path.join(dstDir, src));
    }
  }
} catch (err) {
  console.error('Image sync error:', err.message);
}

const app = express();

// `credentials: true` + dynamic origin matching allows requests from
// any frontend port (e.g. http://localhost:8000, http://127.0.0.1:5500, etc.)
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ service: 'mkdy-auth-service', status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/membership', membershipRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
