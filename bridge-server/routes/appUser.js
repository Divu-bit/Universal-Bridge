const express = require('express');
const router = express.Router();
const AppUser = require('../models/AppUser');

// Register or fetch user
router.post('/register', async (req, res) => {
  try {
    const { appUserId, pushToken } = req.body;
    
    if (appUserId) {
      let user = await AppUser.findOne({ appUserId });
      if (user) {
        if (pushToken && user.pushToken !== pushToken) {
           user.pushToken = pushToken;
           user.updatedAt = Date.now();
           await user.save();
        }
        return res.status(200).json({ message: 'User updated/retrieved', appUserId: user.appUserId, pushToken: user.pushToken });
      }
    }

    // If appUserId wasn't provided (e.g. app restarted), check if we already have this pushToken
    if (pushToken) {
      let user = await AppUser.findOne({ pushToken });
      if (user) {
         // If they provided a new appUserId, update it (rare)
         if (appUserId && user.appUserId !== appUserId) {
             user.appUserId = appUserId;
             user.updatedAt = Date.now();
             await user.save();
         }
         return res.status(200).json({ message: 'User retrieved by pushToken', appUserId: user.appUserId, pushToken: user.pushToken });
      }
    }
    
    // Default fallback: Create a new user
    const newUser = new AppUser({ pushToken });
    if (appUserId) {
      newUser.appUserId = appUserId;
    }
    await newUser.save();
    res.status(201).json({ message: 'User created', appUserId: newUser.appUserId, pushToken: newUser.pushToken });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
