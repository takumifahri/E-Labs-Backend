import express from 'express';
import UserController from '../../controller/api/admin/userController';
import AuthMiddleware from '../../middleware/authmiddleware';

const AdminUserRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
AdminUserRouter.post('/', authMiddleware, AuthMiddleware.Checkroles('admin'), UserController.CreateUser);
AdminUserRouter.get('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles('admin'), UserController.getUserById);
AdminUserRouter.patch('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles('admin'), UserController.updateUser);
AdminUserRouter.delete('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles('admin'), UserController.deleteUser);

AdminUserRouter.get('/', authMiddleware, AuthMiddleware.Checkroles('admin'), UserController.ListUsers);

export default AdminUserRouter;
