const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const developerRoutes = require('./routes/developer');
const appUserRoutes = require('./routes/appUser');
const notifyRoutes = require('./routes/notify');

// Routes
app.use('/api/developers', developerRoutes);
app.use('/api/users', appUserRoutes);
app.use('/api/notify', notifyRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.send({ status: 'Universal Bridge Server is running' });
});

// Test webhook to receive buttons
app.post('/test-webhook', (req, res) => {
  console.log('\n--- 🎉 WEBHOOK RECEIVED FROM PHONE 🎉 ---');
  console.log('Action:', req.body.action);
  console.log('Form Data:', req.body.data);
  console.log('-----------------------------------------\n');
  res.json({ success: true });
});

// Start Server First (For Render Hibernate Wake)
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Database Connection
    if (process.env.MONGODB_URI) {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('MongoDB connected');
        } catch (err) {
            console.error('MongoDB connection error:', err);
        }
    } else {
        console.log('No MONGODB_URI provided in .env');
    }
});
