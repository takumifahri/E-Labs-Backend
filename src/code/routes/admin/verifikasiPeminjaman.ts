import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
import VerifikasiController from '../../controller/api/admin/peminjaman/barang/verifikasi-peminjaman';

const verfikasi_router = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');

const AllRoles = ['superadmin', 'pengelola', 'mahasiswa', 'dosen'];

verfikasi_router.get('/peminjaman-handset', 
    authMiddleware, 
    AuthMiddleware.Checkroles(AllRoles),
    VerifikasiController.getAllPengajuan
);

verfikasi_router.patch('/peminjaman-handset/:id', 
    authMiddleware, 
    AuthMiddleware.Checkroles(['superadmin', 'pengelola']),
    VerifikasiController.verifikasiPeminjamanHandset
);
export default verfikasi_router;