module.exports = {
  id: '202609150005',
  name: 'organizations',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'suspended', 'archived')),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS organization_memberships (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, user_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_org_memberships_user_status
        ON organization_memberships(user_id, status);
    `);
    await client.exec(`
      INSERT OR IGNORE INTO organizations (id, name, created_by, created_at, updated_at)
      SELECT 'personal:' || id, COALESCE(display_name, email) || '''s workspace', id, created_at, updated_at
      FROM users;
      INSERT OR IGNORE INTO organization_memberships
        (id, organization_id, user_id, role, created_at, updated_at)
      SELECT 'membership:personal:' || id, 'personal:' || id, id,
        CASE WHEN id IN (SELECT user_id FROM profiles WHERE is_admin = 1) THEN 'ADMINISTRATOR' ELSE 'OWNER' END,
        created_at, updated_at
      FROM users;
    `);
  }
};
