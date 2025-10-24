import { Router } from "express";
import AuthMiddleware from "../../middleware/authmiddleware";
import PeminjamanItemController from "../../controller/api/user/Peminjaman/terjadwal/ItemController";
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../utils/FileHandler';
import PeminajmanItemTidakTerJadwaLController from "../../controller/api/user/Peminjaman/tidak-terjadwal/peminjamanItemController";
import PeminjamanRuanganController from "../../controller/api/user/Peminjaman/terjadwal/RuanganController";

const PeminjamanRouter = Router();
const PeminjamanUpload = FileHandler.createUploadMiddleware(UploadCategory.PEMINJAMAN_ITEM, 'document', 'barang', 1, 'Dokumen');

// Grouping route
// Peminjaman item
PeminjamanRouter.post("/barang/pengajuan", AuthMiddleware.authMiddleware, PeminjamanUpload, PeminjamanItemController.AjuanPeminjamanItems);
PeminjamanRouter.post('/test', (req, res) => {
    res.json({ message: "Peminjaman route is working!" });
});
// Tidak terjadwal. dia tidak perlu login
PeminjamanRouter.post("/barang/ajuan-tidak-terjadwal", PeminajmanItemTidakTerJadwaLController.AjuanPeminjamanItemTidakTerjadwal);

// Peminjaman ruangan
// Peminjaman ruangan tidak perlu login
PeminjamanRouter.post("/ruangan/terjadwal", PeminjamanRuanganController.PeminjamanRuanganTerjadwal);


// Available ruangan
PeminjamanRouter.get("/ruangan/list", PeminjamanRuanganController.getAllRuangan);
PeminjamanRouter.get("/ruangan/:id", PeminjamanRuanganController.getDetailRuangan);
PeminjamanRouter.post("/ruangan/peminjaman/aktivasi/:id", PeminjamanRuanganController.aktivasiPeminjamanRuanganTerjadwal);
export default PeminjamanRouter;