import express from 'express';
import UserController from '../../controller/api/admin/userController';
import AuthMiddleware from '../../middleware/authmiddleware';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
const AdminUserRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const userUpload = FileHandler.createUploadMiddleware(UploadCategory.PROFILE, 'image', 'profile', 1, 'foto_profile');
const AccessRoles = ['superadmin', 'pengelola'];

AdminUserRouter.get('/prodi', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.getListProdi);

AdminUserRouter.get('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.getUserById);

AdminUserRouter.patch(
    '/:uniqueId',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    userUpload, // <--- middleware upload harus sebelum controller
    UserController.updateUser
);

AdminUserRouter.post(
    '/',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    userUpload, // <--- jika create user bisa upload foto
    UserController.CreateUser
);
AdminUserRouter.delete('/:uniqueId', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.deleteUser);

AdminUserRouter.get('/', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.ListUsers);


AdminUserRouter.get('/dashboard/stats', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.getDashboardStats);

AdminUserRouter.patch('/:id/deactivate', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.deactivatedUser);
AdminUserRouter.patch('/:id/reactivate', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.reactivatedUser);

AdminUserRouter.post('/:uniqueId/warning', authMiddleware, AuthMiddleware.Checkroles(AccessRoles), UserController.giveWarning);

export default AdminUserRouter;
