import { z } from 'zod';

// ── Person (base identity) ───────────────────────────
export const createPersonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  aadhaar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
  photo: z.string().optional(),
});
export const updatePersonSchema = createPersonSchema.partial();

// ── Student ──────────────────────────────────────────
export const createStudentSchema = z.object({
  // Person fields (inline creation)
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  aadhaar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
  // Student-specific fields
  admissionYear: z.number().min(2000).max(2100),
  category: z.string().optional(),
  quota: z.enum(['convener', 'management', 'nri']).optional(),
  rollNumber: z.string().optional(),
  status: z.enum(['prospective', 'active', 'year_back', 'detained', 'graduated', 'exited', 'alumni']).optional(),
});
export const updateStudentSchema = createStudentSchema.partial();

// ── Faculty ──────────────────────────────────────────
export const createFacultySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  aadhaar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
  employeeCode: z.string().min(1, 'Employee code required'),
  designation: z.string().min(1, 'Designation required'),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  contractType: z.enum(['regular', 'contract', 'adjunct', 'visiting']).optional(),
  status: z.enum(['active', 'on_leave', 'separated']).optional(),
});
export const updateFacultySchema = createFacultySchema.partial();

// ── Staff ────────────────────────────────────────────
export const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  aadhaar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
  employeeCode: z.string().min(1, 'Employee code required'),
  designation: z.string().min(1, 'Designation required'),
  staffType: z.string().min(1, 'Staff type required'),
  status: z.enum(['active', 'on_leave', 'separated']).optional(),
});
export const updateStaffSchema = createStaffSchema.partial();

// ── Parent ───────────────────────────────────────────
export const createParentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  relationship: z.enum(['father', 'mother', 'guardian']),
  linkedStudents: z.array(z.string()).optional(),
  primaryContact: z.boolean().optional(),
});
export const updateParentSchema = createParentSchema.partial();

// ── Organization ─────────────────────────────────────
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  address: z.string().optional(),
  contact: z.string().optional(),
});
export const updateOrganizationSchema = createOrganizationSchema.partial();
