'use strict';

const { z } = require('zod');

const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120)
}).strict();

const organizationRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER'])
}).strict();

const organizationInvitationSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['ADMINISTRATOR', 'FINANCE_MANAGER', 'OPERATIONS', 'ACCOUNTANT', 'VIEWER']),
  expiresInDays: z.number().int().min(1).max(30).default(7)
}).strict();

const organizationInvitationAcceptSchema = z.object({
  token: z.string().trim().min(20).max(200)
}).strict();

module.exports = {
  organizationCreateSchema,
  organizationInvitationAcceptSchema,
  organizationInvitationSchema,
  organizationRoleSchema
};
