import express from 'express';
import UserController from '../controller/api/admin/userController';
import AdminUserRouter from './admin/users';
import authRouter from './auth/Auth';
import master_ruangan_barang_router from './admin/master_ruangan_barang';
import PeminjamanRouter from './user/Peminjaman';
import verfikasi_router from './admin/verifikasiPeminjaman';
import LogRouter from './user/logs';
// import PlanRouter from './admin/plan';
const router = express.Router();

// Ktia coba router grouping
router.use('/admin/users', AdminUserRouter);
router.use('/admin/master', master_ruangan_barang_router);
router.use('/admin/verifikasi', verfikasi_router);

// router.use('/admin/plans', PlanRouter);
router.use('/auth', authRouter);
// Router Peminjaman Item
router.use('/peminjaman', PeminjamanRouter);

// Router Logs
router.use('/logs', LogRouter);



export default router;