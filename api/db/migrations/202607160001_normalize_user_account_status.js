module.exports = {
  id: '202607160001',
  name: 'normalize_user_account_status',
  async up(client) {
    await client.exec(`
      UPDATE users
      SET status = CASE
        WHEN lower(trim(status)) IN ('active', 'suspended', 'restricted', 'deleted')
          THEN lower(trim(status))
        ELSE 'restricted'
      END
    `);
    await client.exec(`
      CREATE TRIGGER IF NOT EXISTS validate_users_status_insert
      BEFORE INSERT ON users
      WHEN NEW.status IS NULL OR NEW.status NOT IN ('active', 'suspended', 'restricted', 'deleted')
      BEGIN
        SELECT RAISE(ABORT, 'users.status is invalid');
      END
    `);
    await client.exec(`
      CREATE TRIGGER IF NOT EXISTS validate_users_status_update
      BEFORE UPDATE OF status ON users
      WHEN NEW.status IS NULL OR NEW.status NOT IN ('active', 'suspended', 'restricted', 'deleted')
      BEGIN
        SELECT RAISE(ABORT, 'users.status is invalid');
      END
    `);
  }
};
