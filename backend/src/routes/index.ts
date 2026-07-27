import { Router } from 'express';

import admissionsRouter from '../modules/admissions/routes';
import admissionsWorkflowRouter from '../modules/admissions/workflow.routes';
import peopleRouter from '../modules/people/routes';
import academicsRouter from '../modules/academics/routes';
import financeRouter from '../modules/finance/routes';
import hrRouter from '../modules/hr/routes';
import welfareRouter from '../modules/welfare/routes';
import placementRouter from '../modules/placement/routes';
import campusOpsRouter from '../modules/campus-ops/routes';
import studentDevRouter from '../modules/student-dev/routes';
import complianceRouter from '../modules/compliance/routes';
import governanceRouter from '../modules/governance/routes';
import platformRouter from '../modules/platform/routes';
import juviRouter from '../modules/juvi/routes';
import collegesRouter from '../modules/colleges/routes';
import { listContextMiddleware } from '../shared/request-context';

const router = Router();

// Makes `?search=` available to paginate() on every list endpoint below.
// See shared/request-context.ts for why this is ambient rather than threaded.
router.use(listContextMiddleware);

// M01–M12 + Juvi module routes
router.use('/admissions', admissionsRouter);    // M01
router.use('/admissions/workflow', admissionsWorkflowRouter);  // W01 Workflow
router.use('/people', peopleRouter);            // M02
router.use('/academics', academicsRouter);      // M03
router.use('/finance', financeRouter);          // M04
router.use('/hr', hrRouter);                    // M05
router.use('/welfare', welfareRouter);          // M06
router.use('/placement', placementRouter);      // M07
router.use('/campus', campusOpsRouter);         // M08
router.use('/student-dev', studentDevRouter);   // M09
router.use('/compliance', complianceRouter);    // M10
router.use('/governance', governanceRouter);    // M11
router.use('/platform', platformRouter);        // M12
router.use('/juvi', juviRouter);                // Juvi
router.use('/colleges', collegesRouter);        // College Management (superadmin)

export default router;
