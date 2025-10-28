import express from 'express';
import MataKuliahController from '../../controller/api/admin/mataKuliahController';
import AuthMiddleware from '../../middleware/authmiddleware';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
const AdminMatkulRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const AccessRoles = ['superadmin', 'pengelola'];

AdminMatkulRouter.post(
    '/',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    MataKuliahController.createMatkul
);

AdminMatkulRouter.get(
    '/list',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    MataKuliahController.getAllMatkul
);

AdminMatkulRouter.get(
    '/:id',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    MataKuliahController.getMatkulById
);

AdminMatkulRouter.patch(
    '/:id',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    MataKuliahController.updateMatkul
);

AdminMatkulRouter.delete(
    '/:id',
    authMiddleware,
    AuthMiddleware.Checkroles(AccessRoles),
    MataKuliahController.deleteMatkul
);

export default AdminMatkulRouter;