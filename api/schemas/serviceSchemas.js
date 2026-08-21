const { z } = require('zod');
const { SERVICE_STATUS_VALUES } = require('../constants/serviceCatalogue');

const SERVICE_EXECUTION_MODE_VALUES = Object.freeze([
  'production',
  'sandbox',
  'training'
]);

const SERVICE_TEMPLATE_STATUS_VALUES = Object.freeze([
  'draft',
  'active',
  'disabled',
  'archived'
]);

const jsonObjectSchema = z.record(z.unknown());
const serviceStatusSchema = z.enum(SERVICE_STATUS_VALUES);
const serviceExecutionModeSchema = z.enum(SERVICE_EXECUTION_MODE_VALUES);
const serviceTemplateStatusSchema = z.enum(SERVICE_TEMPLATE_STATUS_VALUES);

const serviceManifestRecordSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  pointPrice: z.number().int().min(0),
  badge: z.string().trim().max(40).nullable(),
  status: serviceStatusSchema,
  generatorKey: z.string().trim().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*$/).nullable(),
  generatorVersion: z.string().trim().min(1).max(32).regex(/^[a-z0-9][a-z0-9._-]*$/i).nullable(),
  inputSchema: jsonObjectSchema,
  outputType: z.string().trim().min(1).max(80).nullable(),
  configuration: jsonObjectSchema,
  permissions: z.array(z.string().trim().min(1).max(80)).max(32),
  queueBehavior: jsonObjectSchema,
  retentionDays: z.number().int().min(0).nullable(),
  executionMode: serviceExecutionModeSchema,
  version: z.string().trim().min(1).max(32).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  featureFlag: z.string().trim().min(1).max(80).regex(/^[A-Z][A-Z0-9_]*$/).nullable(),
  receiptType: z.string().trim().min(1).max(80).nullable(),
  isPaymentProvider: z.boolean(),
  displayOrder: z.number().int().min(0),
  metadata: jsonObjectSchema
}).superRefine((service, context) => {
  if (Boolean(service.generatorKey) !== Boolean(service.generatorVersion)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: service.generatorKey ? ['generatorVersion'] : ['generatorKey'],
      message: 'Generator key and version must be configured together.'
    });
  }

  if (service.status === 'sandbox' && service.executionMode !== 'sandbox') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['executionMode'],
      message: 'Sandbox services must use sandbox execution mode.'
    });
  }
});

const serviceTemplateRecordSchema = z.object({
  serviceId: z.string().trim().min(1).max(128),
  templateKey: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  status: serviceTemplateStatusSchema,
  receiptType: z.string().trim().min(1).max(80).nullable(),
  costPoints: z.number().int().min(0).nullable(),
  inputSchema: jsonObjectSchema,
  rendererConfig: jsonObjectSchema,
  previewAsset: z.string().trim().min(1).max(500).nullable(),
  version: z.string().trim().min(1).max(32).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  metadata: jsonObjectSchema
});

const serviceLaneActionIntentSchema = z.object({
  intent: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(40).optional(),
  metadata: z.record(z.unknown()).optional()
});

module.exports = {
  SERVICE_EXECUTION_MODE_VALUES,
  SERVICE_STATUS_VALUES,
  SERVICE_TEMPLATE_STATUS_VALUES,
  serviceManifestRecordSchema,
  serviceTemplateRecordSchema,
  serviceLaneActionIntentSchema
};
