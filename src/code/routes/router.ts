import express from 'express';
import UserController from '../controller/api/admin/userController';
import AdminUserRouter from './admin/users';
import authRouter from './auth/Auth';
import master_ruangan_barang_router from './admin/master_ruangan_barang';
import PeminjamanRouter from './user/Peminjaman';
import verfikasi_router from './admin/verifikasiPeminjaman';
import LogRouter from './user/logs';
import AdminMatkulRouter from './admin/matkul';
import barangRouter from './user/barang';
import ruanganRouter from './user/ruangan';

// import PlanRouter from './admin/plan';
const router = express.Router();

// Ktia coba router grouping
router.use('/admin/users', AdminUserRouter);

// Router Master Ruangan dan Barang
router.use('/admin/master', master_ruangan_barang_router);

// Router Verifikasi Peminjaman
router.use('/admin/verifikasi', verfikasi_router);

// Router Mata Kuliah
router.use('/admin/matkul', AdminMatkulRouter);

// router.use('/admin/plans', PlanRouter);
router.use('/auth', authRouter);

// Router Peminjaman Item
router.use('/peminjaman', PeminjamanRouter);

// Router Logs
router.use('/logs', LogRouter);

// Router Barang
router.use('/barang', barangRouter);

// Router Ruangan
router.use('/ruangan', ruanganRouter);

export default router;