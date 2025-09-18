const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Note: In real apps, never store plain text passwords
  role: { type: String, default: 'admin' }
});

module.exports = mongoose.model('Admin', AdminSchema);