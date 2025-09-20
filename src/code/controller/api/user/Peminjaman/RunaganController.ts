import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { asyncHandler } from "../../../../middleware/error";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.LOCAL_DATABASE_URL
    }
  }
}).$extends(withAccelerate());

// Terjadwal
const PeminjamanRuanganTerjadwal = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    
})
