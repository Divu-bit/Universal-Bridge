const mongoose = require('mongoose');
const crypto = require('crypto');

const DeveloperSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  apiKey: { 
    type: String, 
    default: () => crypto.randomUUID(), 
    unique: true 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Developer', DeveloperSchema);
