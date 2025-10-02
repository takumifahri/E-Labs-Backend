import { Router } from "express";
import AuthMiddleware from "../../middleware/authmiddleware";
import PeminjamanItemController from "../../controller/api/user/Peminjaman/ItemController";
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
import PeminajmanItemTidakTerJadwaLController from "../../controller/api/user/Peminjaman/tidak-terjadwal/peminjamanItemController";

const PeminjamanRouter = Router();
const PeminjamanUpload = FileHandler.createUploadMiddleware(UploadCategory.PEMINJAMAN_ITEM, 'document', 'barang', 1, 'Dokumen');

PeminjamanRouter.post("/ajuan", AuthMiddleware.authMiddleware, PeminjamanUpload, PeminjamanItemController.AjuanPeminjamanItems);
PeminjamanRouter.post('/test', (req, res) => {
    res.json({ message: "Peminjaman route is working!" });
});

PeminjamanRouter.post("/ajuan-tidak-terjadwal", PeminajmanItemTidakTerJadwaLController.AjuanPeminjamanItemTidakTerjadwal);
export default PeminjamanRouter;