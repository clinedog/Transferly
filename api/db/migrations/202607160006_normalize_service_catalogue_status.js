const CANONICAL_STATUSES_SQL = "'draft', 'preview', 'sandbox', 'active', 'maintenance', 'disabled'";

module.exports = {
  id: '202607160006',
  name: 'normalize_service_catalogue_status',
  async up(client) {
    await client.exec(`
      UPDATE services
      SET status = CASE
        WHEN lower(trim(status)) IN (${CANONICAL_STATUSES_SQL})
          THEN lower(trim(status))
        WHEN lower(trim(status)) = 'comingsoon'
          THEN 'preview'
        ELSE 'disabled'
      END
    `);
    await client.exec(`
      CREATE TRIGGER IF NOT EXISTS validate_services_status_insert
      BEFORE INSERT ON services
      WHEN NEW.status IS NULL OR NEW.status NOT IN (${CANONICAL_STATUSES_SQL})
      BEGIN
        SELECT RAISE(ABORT, 'services.status is invalid');
      END
    `);
    await client.exec(`
      CREATE TRIGGER IF NOT EXISTS validate_services_status_update
      BEFORE UPDATE OF status ON services
      WHEN NEW.status IS NULL OR NEW.status NOT IN (${CANONICAL_STATUSES_SQL})
      BEGIN
        SELECT RAISE(ABORT, 'services.status is invalid');
      END
    `);
  }
};
