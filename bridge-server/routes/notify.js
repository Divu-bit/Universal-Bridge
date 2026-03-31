const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const Developer = require('../models/Developer');
const AppUser = require('../models/AppUser');

router.post('/', async (req, res) => {
  try {
    // 1. Authenticate the developer
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API Key missing' });
    
    const dev = await Developer.findOne({ apiKey });
    if (!dev) return res.status(403).json({ error: 'Invalid API Key' });

    // 2. Validate payload
    const { targetUserId, title, body, interactiveSchema } = req.body;
    if (!targetUserId || !title) {
        return res.status(400).json({ error: 'targetUserId and title are required' });
    }

    // 3. Find the AppUser
    const user = await AppUser.findOne({ appUserId: targetUserId });
    if (!user || !user.pushToken) {
        return res.status(404).json({ error: 'User not found or has no active push token' });
    }

    // 4. Construct message for Expo Push API since we are using Expo Go for testing
    const message = {
      to: user.pushToken,
      sound: 'default',
      title: title,
      body: body || '',
      data: {
        interactiveSchema: interactiveSchema ? JSON.stringify(interactiveSchema) : ''
      }
    };

    // 5. Send Notification via Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    res.status(200).json({ success: true, messageId: result });

  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

module.exports = router;
