const quotaWatcher = require('./monitoring/healthWatcher');

function startQuotaWatcher() {
  quotaWatcher.start();
}

module.exports = { startQuotaWatcher, quotaWatcher };

if (require.main === module) {
  startQuotaWatcher();
}
