const mongoose = require('mongoose');

const abuseLogSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  userId: { type: String, default: null },
  tipo: { type: String, required: true, enum: ['rate-limit', 'conteudo-proibido', 'injection', 'outro'] },
  detalhes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'abuseLogs', timestamps: false });

module.exports = mongoose.model('AbuseLog', abuseLogSchema);
