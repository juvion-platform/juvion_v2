import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createPersonSchema, updatePersonSchema,
  createStudentSchema, updateStudentSchema,
  createFacultySchema, updateFacultySchema,
  createStaffSchema, updateStaffSchema,
  createParentSchema, updateParentSchema,
  createOrganizationSchema, updateOrganizationSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Persons
router.get('/persons', ctrl.listPersons);
router.get('/persons/:id', ctrl.getPerson);
router.post('/persons', validate(createPersonSchema), ctrl.createPerson);
router.put('/persons/:id', validate(updatePersonSchema), ctrl.updatePerson);
router.delete('/persons/:id', ctrl.deletePerson);

// Students
router.get('/students', ctrl.listStudents);
router.get('/students/:id', ctrl.getStudent);
router.post('/students', validate(createStudentSchema), ctrl.createStudent);
router.put('/students/:id', validate(updateStudentSchema), ctrl.updateStudent);
router.delete('/students/:id', ctrl.deleteStudent);

// Faculty
router.get('/faculty', ctrl.listFaculty);
router.get('/faculty/:id', ctrl.getFaculty);
router.post('/faculty', validate(createFacultySchema), ctrl.createFaculty);
router.put('/faculty/:id', validate(updateFacultySchema), ctrl.updateFaculty);
router.delete('/faculty/:id', ctrl.deleteFaculty);

// Staff
router.get('/staff', ctrl.listStaff);
router.get('/staff/:id', ctrl.getStaff);
router.post('/staff', validate(createStaffSchema), ctrl.createStaff);
router.put('/staff/:id', validate(updateStaffSchema), ctrl.updateStaff);
router.delete('/staff/:id', ctrl.deleteStaff);

// Parents
router.get('/parents', ctrl.listParents);
router.post('/parents', validate(createParentSchema), ctrl.createParent);
router.put('/parents/:id', validate(updateParentSchema), ctrl.updateParent);

// Organizations
router.get('/organizations', ctrl.listOrganizations);
router.post('/organizations', validate(createOrganizationSchema), ctrl.createOrganization);
router.put('/organizations/:id', validate(updateOrganizationSchema), ctrl.updateOrganization);
router.delete('/organizations/:id', ctrl.deleteOrganization);

export default router;
