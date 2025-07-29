import express from 'express';
import UserController from '../controller/api/admin/user';
import AdminUserRouter from './admin/users';
import authRouter from './auth/Auth';
const router = express.Router();

// Ktia coba router grouping
router.use('/admin/users', AdminUserRouter);
router.use('/auth', authRouter);
export default router;