module.exports = {
  id: '202609150006',
  name: 'organization_invitations',
  async up(client) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS organization_invitations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER')),
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
        invited_by TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_by TEXT,
        accepted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_org_invitations_email_status
        ON organization_invitations(email, status);
      CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status
        ON organization_invitations(organization_id, status);
    `);
  }
};
