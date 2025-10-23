import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
import VerifikasiController from '../../controller/api/admin/peminjaman/barang/verifikasi-peminjaman';
import verifikasiPeminjamanRuanganController from '../../controller/api/admin/peminjaman/ruangan/verifikasi-peminjaman-ruangan';
const verfikasi_router = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');

const Role = ['superadmin', 'pengelola', 'mahasiswa', 'dosen'];

verfikasi_router.get('/peminjaman-handset/list', 
    authMiddleware, 
    AuthMiddleware.Checkroles(Role),
    VerifikasiController.getAllPengajuan
);

verfikasi_router.patch('/peminjaman-handset/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    VerifikasiController.verifikasiPeminjamanHandset
);

verfikasi_router.get('/peminjaman-ruangan/list',
    authMiddleware,
    AuthMiddleware.Checkroles(Role),
    verifikasiPeminjamanRuanganController.getAllPeminjamanRuangan
);

verfikasi_router.get('/peminjaman-ruangan/:id',
    authMiddleware,
    AuthMiddleware.Checkroles(Role),
    verifikasiPeminjamanRuanganController.getDetailPeminjamanRuangan
);

verfikasi_router.patch('/peminjaman-ruangan/:id',
    authMiddleware,
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    verifikasiPeminjamanRuanganController.verifikasiAjuanPeminjamanRuangan
);

export default verfikasi_router;