import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import BarangController from '../../controller/api/admin/barangController';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';

const master_ruangan_barang_router = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');

const AllRoles = ['superadmin', 'pengelola', 'mahasiswa', 'dosen'];

// RUANGAN ROUTES - Fixed order: auth -> roleCheck -> controller
master_ruangan_barang_router.post('/ruangan', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    RuanganController.CreateRuangan
);

master_ruangan_barang_router.get('/ruangan', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    RuanganController.GetRuanganMaster
);

master_ruangan_barang_router.get('/ruangan/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    RuanganController.GetRuanganById
);

master_ruangan_barang_router.patch('/ruangan/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    RuanganController.UpdateRuangan
);

master_ruangan_barang_router.delete('/ruangan/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    RuanganController.DeleteRuangan
);

master_ruangan_barang_router.post('/ruangan/warm-cache', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    RuanganController.WarmRuanganCache
);

master_ruangan_barang_router.post('/ruangan/generateQr/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']), 
    RuanganController.QRGenerator
);
master_ruangan_barang_router.delete('/ruangan/QR/delete/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']), 
    RuanganController.deleteImageQR
);


// BARANG ROUTES - Fixed order: auth -> roleCheck -> upload (if needed) -> controller
master_ruangan_barang_router.get('/barang', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    BarangController.getAllBarang
);

master_ruangan_barang_router.post('/barang', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    barangImageUpload,  // Upload middleware after role check
    BarangController.createBarang
);

master_ruangan_barang_router.get('/barang/dashboard', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    BarangController.getDashboardStats

);

master_ruangan_barang_router.get('/barang/kategori', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    BarangController.getAllKategori
);

master_ruangan_barang_router.get('/barang/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    BarangController.getBarangById
);

master_ruangan_barang_router.patch('/barang/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    barangImageUpload,  // Upload middleware after role check
    BarangController.updateBarang
);

master_ruangan_barang_router.delete('/barang/delete/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    BarangController.deleteBarang
);

master_ruangan_barang_router.patch('/barang/restore/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    BarangController.restoreBarang
);

master_ruangan_barang_router.post('/barang/warm-cache', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    BarangController.warmBarangCache
);

export default master_ruangan_barang_router;