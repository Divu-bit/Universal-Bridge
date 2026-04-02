const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  targetUserId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  interactiveSchema: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema);
