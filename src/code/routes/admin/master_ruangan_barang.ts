import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import BarangController from '../../controller/api/admin/barangController';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';

const master_ruangan_barang_router = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');

master_ruangan_barang_router.post('/ruangan', authMiddleware, RuanganController.CreateRuangan, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.get('/ruangan', authMiddleware, RuanganController.GetRuanganMaster, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.get('/ruangan/:id', authMiddleware, RuanganController.GetRuanganById, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.put('/ruangan/:id', authMiddleware, RuanganController.UpdateRuangan, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.delete('/ruangan/:id', authMiddleware, RuanganController.DeleteRuangan, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.post('/ruangan/warm-cache', authMiddleware, RuanganController.WarmRuanganCache, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));

master_ruangan_barang_router.get('/barang', authMiddleware, BarangController.getAllBarang, AuthMiddleware.Checkroles(['superadmin','pengelola']));
master_ruangan_barang_router.post('/barang', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    barangImageUpload,  // Custom middleware for 'foto_barang' field
    BarangController.createBarang
);
master_ruangan_barang_router.get('/barang/:id', authMiddleware, BarangController.getBarangById, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));

master_ruangan_barang_router.patch('/barang/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    barangImageUpload,  // Custom middleware for 'foto_barang' field
    BarangController.updateBarang
);

master_ruangan_barang_router.delete('/barang/delete/:id', authMiddleware, BarangController.deleteBarang, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.post('/barang/restore/:id', authMiddleware, BarangController.restoreBarang, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));
master_ruangan_barang_router.post('/barang/warm-cache', authMiddleware, BarangController.warmBarangCache, AuthMiddleware.Checkroles(['superadmin', 'pengelola']));

export default master_ruangan_barang_router;