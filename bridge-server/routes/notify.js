const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const Developer = require('../models/Developer');
const AppUser = require('../models/AppUser');
const Notification = require('../models/Notification');

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

    // 4. Save notification to database
    const savedNotif = await Notification.create({
      targetUserId,
      title,
      body: body || '',
      interactiveSchema: interactiveSchema || null,
      status: 'pending',
    });

    // 5. Construct message for Expo Push API
    const message = {
      to: user.pushToken,
      sound: 'default',
      title: title,
      body: body || '',
      data: {
        notificationId: savedNotif._id.toString(),
        interactiveSchema: interactiveSchema ? JSON.stringify(interactiveSchema) : '',
        createdAt: savedNotif.createdAt.toISOString(),
      }
    };

    // 6. Send Notification via Expo Push Service
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
    res.status(200).json({ success: true, messageId: result, notificationId: savedNotif._id });

  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// GET — Fetch all notifications for a user (mobile app calls this on startup)
router.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ targetUserId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH — Mark a notification as completed
router.patch('/:notificationId/complete', async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      { status: 'completed' },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// DELETE — Remove a notification permanently
router.delete('/:notificationId', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.notificationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;

