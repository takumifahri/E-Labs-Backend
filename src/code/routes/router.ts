import express from 'express';
import UserController from '../controller/api/admin/userController';
import AdminUserRouter from './admin/users';
import authRouter from './auth/Auth';
import PlanRouter from './admin/plan';
const router = express.Router();

// Ktia coba router grouping
router.use('/admin/users', AdminUserRouter);
router.use('/admin/plans', PlanRouter);
router.use('/auth', authRouter);
export default router;