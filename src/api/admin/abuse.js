const AbuseLog = require('../../models/abuseLog');

module.exports = async (req, res) => {
  try {
    const logs = await AbuseLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
