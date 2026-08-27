const express = require('express');
const cors = require('cors');
const path = require('path');
const apiHandler = require('./api/index.js');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// API Routes - Handles /api, /api/index, and any subpaths
app.use('/api', async (req, res, next) => {
  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_server_error', detail: err.message });
    }
  }
});

// Specific page routes
app.get('/result', (req, res) => {
  res.sendFile(path.join(__dirname, 'result.html'));
});

// Serve static files from root directory
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Fallback to index.html for root or unmatched GET routes
app.use((req, res) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'not_found' });
  }
});

app.listen(PORT, HOST, () => {
  console.log('===========================================================');
  console.log(`🌿 छाया AI (Chaya AI Smart Agricultural System)`);
  console.log(`📡 Server running on http://${HOST}:${PORT}`);
  console.log(`📁 Static files served from: ${__dirname}`);
  console.log('===========================================================');
});
