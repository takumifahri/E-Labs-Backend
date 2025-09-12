import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';

const master_ruangan_barang_router = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;

master_ruangan_barang_router.post('/', authMiddleware, RuanganController.CreateRuangan, AuthMiddleware.Checkroles(['superadmin']));
master_ruangan_barang_router.get('/', authMiddleware, RuanganController.GetRuanganMaster, AuthMiddleware.Checkroles(['superadmin']));
master_ruangan_barang_router.get('/:id', authMiddleware, RuanganController.GetRuanganById, AuthMiddleware.Checkroles(['superadmin']));
master_ruangan_barang_router.put('/:id', authMiddleware, RuanganController.UpdateRuangan, AuthMiddleware.Checkroles(['superadmin']));
master_ruangan_barang_router.delete('/:id', authMiddleware, RuanganController.DeleteRuangan, AuthMiddleware.Checkroles(['superadmin']));
master_ruangan_barang_router.post('/warm-cache', authMiddleware, RuanganController.WarmRuanganCache, AuthMiddleware.Checkroles(['superadmin']));

export default master_ruangan_barang_router;