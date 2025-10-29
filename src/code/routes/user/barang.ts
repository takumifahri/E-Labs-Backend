import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import BarangController from '../../controller/api/admin/barangController';

import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';

const barangRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');



// BARANG ROUTES - Fixed order: auth -> roleCheck -> upload (if needed) -> controller
barangRouter.get('/', 
    BarangController.getAllBarang
);

barangRouter.get('/dashboard', 
    BarangController.getDashboardStats
);

barangRouter.get('/kategori', 
    BarangController.getAllKategori
);

barangRouter.get('/:id', 
    BarangController.getBarangById
);


export default barangRouter;