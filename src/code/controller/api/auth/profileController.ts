import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { ProfileDto, UpdateProfileDto } from "../../../models/profile";
import { HashPassword } from "../../../utils/hash";
import { AppError, asyncHandler } from "../../../middleware/error";

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

const prisma = new PrismaClient();

const WhoAmI = asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;

    if (!userPayload) {
        throw new AppError("Unauthorized - User not authenticated", 401);
    }

    const userData = await prisma.user.findUnique({
        where: { uniqueId: userPayload.uniqueId },
        include: {
            role: {
                select: {
                    id: true,
                    nama_role: true,
                    deskripsi: true
                }
            }
        }
    });

    if (!userData) {
        throw new AppError("User not found", 404);
    }

    if (!userData.isActive) {
        throw new AppError("Account is deactivated", 403);
    }

    const profileData: ProfileDto = {
        id: userData.id,
        uniqueId: userData.uniqueId,
        roleId: userData.roleId,
        semester: userData.semester || undefined,
        profil: userData.profil || undefined,
        email: userData.email,
        nama: userData.nama,
        NIM: userData.NIM || undefined,
        NIP: userData.NIP || undefined,
        isActive: userData.isActive,
        role: userData.role,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        deletedAt: userData.deletedAt || undefined,
    };

    res.status(200).json({
        message: "Profile retrieved successfully",
        data: profileData
    });
});

const UpdateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const updateData: UpdateProfileDto = req.body;

    if (!userPayload) {
        throw new AppError("Unauthorized - User not authenticated", 401);
    }

    const existingUser = await prisma.user.findUnique({
        where: { uniqueId: userPayload.uniqueId }
    });

    if (!existingUser) {
        throw new AppError("User not found", 404);
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
            where: { email: updateData.email }
        });

        if (emailExists) {
            throw new AppError("Email already in use", 409);
        }
    }

    const updatedUser = await prisma.user.update({
        where: { uniqueId: userPayload.uniqueId },
        data: {
            ...updateData,
            updatedAt: new Date()
        },
        include: {
            role: {
                select: {
                    id: true,
                    nama_role: true,
                    deskripsi: true
                }
            }
        }
    });

    const profileData: ProfileDto = {
        id: updatedUser.id,
        uniqueId: updatedUser.uniqueId,
        roleId: updatedUser.roleId,
        semester: updatedUser.semester || undefined,
        profil: updatedUser.profil || undefined,
        email: updatedUser.email,
        nama: updatedUser.nama,
        NIM: updatedUser.NIM || undefined,
        NIP: updatedUser.NIP || undefined,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        deletedAt: updatedUser.deletedAt || undefined,
        role: updatedUser.role
    };

    res.status(200).json({
        message: "Profile updated successfully",
        data: profileData
    });
});

const ChangePassword = asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!userPayload) {
        throw new AppError("Unauthorized - User not authenticated", 401);
    }

    if (!currentPassword || !newPassword) {
        throw new AppError("Current password and new password are required", 400);
    }

    const user = await prisma.user.findUnique({
        where: { uniqueId: userPayload.uniqueId }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    // Verify current password
    const { verifyPassword } = await import("../../../utils/hash");
    const isCurrentPasswordValid = await verifyPassword(user.password, currentPassword);

    if (!isCurrentPasswordValid) {
        throw new AppError("Current password is incorrect", 400);
    }

    // Hash new password
    const hashedNewPassword = await HashPassword(newPassword);

    await prisma.user.update({
        where: { uniqueId: userPayload.uniqueId },
        data: {
            password: hashedNewPassword,
            updatedAt: new Date()
        }
    });

    res.status(200).json({
        message: "Password changed successfully"
    });
});

const ProfileController = {
    WhoAmI,
    UpdateProfile,
    ChangePassword
}

export default ProfileController;