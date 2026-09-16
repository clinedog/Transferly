const { auditLogRepository } = require('../repositories/auditLogRepository');

async function log(entry, client) {
  await auditLogRepository.create(entry, client);
}

async function list(filters = {}) {
  return auditLogRepository.findMany(filters);
}

module.exports = {
  auditLogService: {
    log,
    list
  }
};
