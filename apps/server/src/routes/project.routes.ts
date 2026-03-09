import { Router } from 'express';
import * as projectCtrl from '../controllers/project.controller';
import * as mimicCtrl from '../controllers/mimic.controller';
import * as transferCtrl from '../controllers/project-transfer.controller';
import { authenticate } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project CRUD
router.post('/', auditLog('CREATE_PROJECT', 'project'), projectCtrl.createProject);
router.get('/', projectCtrl.getProjects);
router.get('/:id', projectCtrl.getProject);
router.put('/:id', auditLog('UPDATE_PROJECT', 'project'), projectCtrl.updateProject);
router.delete('/:id', auditLog('DELETE_PROJECT', 'project'), projectCtrl.deleteProject);

// Project Export / Import
router.get('/:id/export', transferCtrl.exportProject);
router.post('/import', transferCtrl.importProject);

// Mimic Pages
router.get('/:id/pages', mimicCtrl.getPages);
router.get('/:id/pages/:pageId', mimicCtrl.getPage);
router.post('/:id/pages', auditLog('CREATE_PAGE', 'mimic_page'), mimicCtrl.createPage);
router.put('/:id/pages/:pageId', auditLog('UPDATE_PAGE', 'mimic_page'), mimicCtrl.updatePage);
router.delete('/:id/pages/:pageId', auditLog('DELETE_PAGE', 'mimic_page'), mimicCtrl.deletePage);

// Project Members
router.get('/:id/members', projectCtrl.getMembers);
router.post('/:id/members', auditLog('ADD_MEMBER', 'project_member'), projectCtrl.addMember);
router.put('/:id/members/:memberId', auditLog('UPDATE_MEMBER', 'project_member'), projectCtrl.updateMember);
router.delete('/:id/members/:memberId', auditLog('REMOVE_MEMBER', 'project_member'), projectCtrl.removeMember);

export default router;
