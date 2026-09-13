import { z } from 'zod';
import { badRequest } from '../utils/httpError.js';

/**
 * Middleware factory: validates req.body, req.query, and/or req.params
 * against Zod schemas.  Rejects with 400 + structured details on failure.
 *
 * Usage:
 *   router.post('/', validate({ body: loginSchema }), handler)
 *   router.get('/', validate({ query: listSchema }), handler)
 */
export function validate(schemas = {}) {
  return (req, res, next) => {
    const errors = [];
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            source,
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          });
        }
      } else {
        // Replace with parsed (coerced / defaulted) values
        req[source] = result.data;
      }
    }
    if (errors.length) throw badRequest('Validation failed', errors);
    next();
  };
}

// ─── Common reusable schemas ────────────────────────────────────────────────

export const uuidParam = z.string().uuid('Invalid ID format');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const idBody = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// ─── User schemas ───────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens'),
  fullName: z.string().min(1).max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  designation: z.string().max(255).optional().nullable(),
  divisionIds: z.array(z.string().uuid()).optional().default([]),
  sectionIds: z.array(z.string().uuid()).optional().default([]),
  roleIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  designation: z.string().max(255).optional().nullable(),
  divisionIds: z.array(z.string().uuid()).optional(),
  sectionIds: z.array(z.string().uuid()).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

// ─── Purchase Order schemas ─────────────────────────────────────────────────

export const createPOSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  divisionId: z.string().uuid('Invalid division ID'),
  departmentId: z.string().uuid('Invalid department ID'),
  sectionId: z.string().uuid('Invalid section ID'),
  expectedDeliveryDate: z.string().max(50).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
  taxScheme: z.enum(['GST_INTRA', 'GST_INTER', 'IGST', 'NONE']).default('GST_INTRA'),
  paymentTerms: z.string().max(255).optional().nullable(),
  deliveryTerms: z.string().max(255).optional().nullable(),
  lines: z.array(z.object({
    productId: z.string().uuid('Invalid product ID'),
    colourId: z.string().uuid().optional().nullable(),
    purchasePrice: z.coerce.number().min(0, 'Purchase price must be non-negative'),
    marginPercent: z.coerce.number().min(0).max(1000).optional().default(0),
    discountType: z.enum(['percent', 'amount', null]).optional().nullable(),
    discountValue: z.coerce.number().min(0).optional().default(0),
    quantities: z.array(z.object({
      sizeLabel: z.string().max(50),
      quantity: z.coerce.number().int().min(0),
    })).min(1, 'At least one size/quantity entry is required'),
  })).min(1, 'At least one product line is required'),
});

// ─── Brand schemas ──────────────────────────────────────────────────────────

export const createBrandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required').max(255),
  brandCode: z.string().max(50).optional().nullable(),
  manufacturer: z.string().max(255).optional().nullable(),
});

// ─── Division / Section / Department schemas ────────────────────────────────

export const createDivisionSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const createSectionSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  departmentId: z.string().uuid('Invalid department ID'),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  status: z.enum(['active', 'inactive']).default('active'),
});

// ─── Supplier schemas ───────────────────────────────────────────────────────

export const createSupplierSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  code: z.string().min(1).max(50),
  contactPerson: z.string().max(255).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  divisionIds: z.array(z.string().uuid()).optional().default([]),
  paymentTerms: z.string().max(255).optional().nullable(),
});

// ─── Colour schemas ─────────────────────────────────────────────────────────

export const createColourSchema = z.object({
  name: z.string().min(1, 'Colour name is required').max(100),
  hex: z.string().max(7).optional().nullable(),
  isCustom: z.boolean().optional().default(false),
});

// ─── Settings schemas ───────────────────────────────────────────────────────

export const updateSettingsSchema = z.record(z.string(), z.any());

// ─── Search schemas ─────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(255),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Report schemas ─────────────────────────────────────────────────────────

export const reportQuerySchema = z.object({
  from: z.string().max(50).optional().nullable(),
  to: z.string().max(50).optional().nullable(),
  divisionId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
