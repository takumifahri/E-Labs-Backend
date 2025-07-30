import express from 'express';
import PlanController from '../../controller/api/admin/planController';
import AuthMiddleware from '../../middleware/authmiddleware';

const PlanRouter = express.Router();

PlanRouter.post('/create', AuthMiddleware.authMiddleware, AuthMiddleware.Checkroles('admin'), PlanController.createPlanForUser);
PlanRouter.patch('/update/:uniqueId', AuthMiddleware.authMiddleware, PlanController.updatePlanById);
PlanRouter.get('/:uniqueId', AuthMiddleware.authMiddleware, PlanController.getPlanById);
PlanRouter.get('/', AuthMiddleware.authMiddleware, PlanController.getAllPlans);
PlanRouter.delete('/:uniqueId', AuthMiddleware.authMiddleware, AuthMiddleware.Checkroles('admin'), PlanController.deletePlanById);
PlanRouter.delete('/permanently/:uniqueId', AuthMiddleware.authMiddleware, AuthMiddleware.Checkroles('admin'), PlanController.deletePermanentlyPlanById);

export default PlanRouter;