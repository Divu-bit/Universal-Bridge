const express = require('express');
const router = express.Router();
const Developer = require('../models/Developer');

// Register a new developer to get an API key
router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    // Check if developer already exists
    let dev = await Developer.findOne({ email });
    if (dev) {
       return res.status(200).json({ message: 'Developer exists', apiKey: dev.apiKey });
    }
    
    dev = new Developer({ email });
    await dev.save();
    res.status(201).json({ message: 'Developer registered', apiKey: dev.apiKey });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
