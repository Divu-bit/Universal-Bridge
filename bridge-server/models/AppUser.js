const mongoose = require('mongoose');
const crypto = require('crypto');

const AppUserSchema = new mongoose.Schema({
  appUserId: { 
    type: String, 
    required: true, 
    unique: true, 
    default: () => crypto.randomUUID() 
  },
  pushToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AppUser', AppUserSchema);
