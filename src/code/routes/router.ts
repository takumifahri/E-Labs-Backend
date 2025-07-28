import express from 'express';
import UserController from '../controller/api/admin/user';
import AdminUserRouter from './admin/users';

const router = express.Router();

// Ktia coba router grouping
router.use('/admin/users', AdminUserRouter);

export default router;