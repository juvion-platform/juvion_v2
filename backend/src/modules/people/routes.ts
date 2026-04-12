import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
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
router.get('/stats', authorize('people', 'read'), ctrl.dashboardStats);

// Persons
router.get('/persons', authorize('people', 'read'), ctrl.listPersons);
router.get('/persons/:id', authorize('people', 'read'), ctrl.getPerson);
router.post('/persons', authorize('people', 'create'), validate(createPersonSchema), ctrl.createPerson);
router.put('/persons/:id', authorize('people', 'update'), validate(updatePersonSchema), ctrl.updatePerson);
router.delete('/persons/:id', authorize('people', 'delete'), ctrl.deletePerson);

// Students
router.get('/students', authorize('people', 'read'), ctrl.listStudents);
router.get('/students/:id', authorize('people', 'read'), ctrl.getStudent);
router.post('/students', authorize('people', 'create'), validate(createStudentSchema), ctrl.createStudent);
router.put('/students/:id', authorize('people', 'update'), validate(updateStudentSchema), ctrl.updateStudent);
router.delete('/students/:id', authorize('people', 'delete'), ctrl.deleteStudent);

// Faculty
router.get('/faculty', authorize('people', 'read'), ctrl.listFaculty);
router.get('/faculty/:id', authorize('people', 'read'), ctrl.getFaculty);
router.post('/faculty', authorize('people', 'create'), validate(createFacultySchema), ctrl.createFaculty);
router.put('/faculty/:id', authorize('people', 'update'), validate(updateFacultySchema), ctrl.updateFaculty);
router.delete('/faculty/:id', authorize('people', 'delete'), ctrl.deleteFaculty);

// Staff
router.get('/staff', authorize('people', 'read'), ctrl.listStaff);
router.get('/staff/:id', authorize('people', 'read'), ctrl.getStaff);
router.post('/staff', authorize('people', 'create'), validate(createStaffSchema), ctrl.createStaff);
router.put('/staff/:id', authorize('people', 'update'), validate(updateStaffSchema), ctrl.updateStaff);
router.delete('/staff/:id', authorize('people', 'delete'), ctrl.deleteStaff);

// Parents
router.get('/parents', authorize('people', 'read'), ctrl.listParents);
router.get('/parents/:id', authorize('people', 'read'), ctrl.getParent);
router.post('/parents', authorize('people', 'create'), validate(createParentSchema), ctrl.createParent);
router.put('/parents/:id', authorize('people', 'update'), validate(updateParentSchema), ctrl.updateParent);
router.delete('/parents/:id', authorize('people', 'delete'), ctrl.deleteParent);

// Organizations
router.get('/organizations', authorize('people', 'read'), ctrl.listOrganizations);
router.get('/organizations/:id', authorize('people', 'read'), ctrl.getOrganization);
router.post('/organizations', authorize('people', 'create'), validate(createOrganizationSchema), ctrl.createOrganization);
router.put('/organizations/:id', authorize('people', 'update'), validate(updateOrganizationSchema), ctrl.updateOrganization);
router.delete('/organizations/:id', authorize('people', 'delete'), ctrl.deleteOrganization);

export default router;
