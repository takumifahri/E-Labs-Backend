import express from 'express';
import PlanController from '../../controller/api/admin/planController';
import AuthMiddleware from '../../middleware/authmiddleware';

const PlanRouter = express.Router();

PlanRouter.post('/create', AuthMiddleware.authMiddleware, AuthMiddleware.Checkroles('admin'), PlanController.createPlanForUser);
PlanRouter.patch('/update/:uniqueId', AuthMiddleware.authMiddleware, PlanController.updatePlanById);
export default PlanRouter;