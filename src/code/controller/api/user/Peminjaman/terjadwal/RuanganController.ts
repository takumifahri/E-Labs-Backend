import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler } from "../../../../../middleware/error";
import { CreateRuanganRequest } from "../../../../../models/Ruangan";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.LOCAL_DATABASE_URL
    }
  }
})

// Terjadwal, Dia ga perlu login
const PeminjamanRuanganTerjadwal = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
  const { gedung, nama_ruangan, kode_ruangan }: CreateRuanganRequest = req.body;

})
