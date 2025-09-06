import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';

const RuanganRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;

RuanganRouter.post('/', authMiddleware, RuanganController.CreateRuangan, AuthMiddleware.Checkroles('superadmin'));
RuanganRouter.get('/', authMiddleware, RuanganController.GetRuanganMaster, AuthMiddleware.Checkroles('superadmin'));
RuanganRouter.get('/:id', authMiddleware, RuanganController.GetRuanganById, AuthMiddleware.Checkroles('superadmin'));
RuanganRouter.put('/:id', authMiddleware, RuanganController.UpdateRuangan, AuthMiddleware.Checkroles('superadmin'));
RuanganRouter.delete('/:id', authMiddleware, RuanganController.DeleteRuangan, AuthMiddleware.Checkroles('superadmin'));
RuanganRouter.post('/warm-cache', authMiddleware, RuanganController.WarmRuanganCache, AuthMiddleware.Checkroles('superadmin'));

export default RuanganRouter;