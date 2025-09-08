import express from 'express';
import UserController from '../../controller/api/admin/userController';
import AuthMiddleware from '../../middleware/authmiddleware';

const AdminUserRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
AdminUserRouter.post('/', authMiddleware, AuthMiddleware.Checkroles(['superadmin']), UserController.CreateUser);
AdminUserRouter.get('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles(['superadmin']), UserController.getUserById);
AdminUserRouter.patch('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles(['superadmin']), UserController.updateUser);
AdminUserRouter.delete('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles(['superadmin']), UserController.deleteUser);

AdminUserRouter.get('/', authMiddleware, AuthMiddleware.Checkroles(['superadmin']), UserController.ListUsers);

export default AdminUserRouter;
