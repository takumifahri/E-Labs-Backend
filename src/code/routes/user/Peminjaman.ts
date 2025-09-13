import { Router } from "express";
import AuthMiddleware from "../../middleware/authmiddleware";
import PeminjamanItemController from "../../controller/api/user/Peminjaman/ItemController";
const PeminjamanRouter = Router();

PeminjamanRouter.post("/ajuan", AuthMiddleware.authMiddleware, PeminjamanItemController.AjuanPeminjamanItems);
PeminjamanRouter.post('/test', (req, res) => {
    res.json({ message: "Peminjaman route is working!" });
});
export default PeminjamanRouter;