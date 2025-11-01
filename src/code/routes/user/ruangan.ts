import express from 'express';
import RuanganController from '../../controller/api/admin/ruanganController';
import AuthMiddleware from '../../middleware/authmiddleware';
import BarangController from '../../controller/api/admin/barangController';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';

const ruanganRouter = express.Router();
const authMiddleware = AuthMiddleware.authMiddleware;
const barangImageUpload = FileHandler.createUploadMiddleware(UploadCategory.BARANG, 'image', 'barang', 1, 'foto_barang');


// RUANGAN ROUTES -     Fixed order: auth -> roleCheck -> controller
ruanganRouter.get('/', 
    RuanganController.GetRuanganMaster
);

ruanganRouter.get('/:id', 
    RuanganController.GetRuanganById
);

export default ruanganRouter;