import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { ProfileDto, UpdateProfileDto } from "../../models/profile";
import { HashPassword, verifyPassword } from "../../utils/hash";
import { AppError, asyncHandler } from "../../middleware/error";
import { UpdatePassword } from "../../models/user";
import { addToBlacklist } from "../../utils/jwt";
import { transporter } from "../../utils/Mail.config";
import crypto from "crypto";
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
    console.log("User Payload:", userPayload);
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
    console.log("User Data from DB:", userData);
    if (!userData) {
        throw new AppError("User not found", 404);
    }

    // if (userData.isActive) {
    //     throw new AppError("Account is deactivated", 403);
    // }

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

// Function untuk mengirim token reset password
const RequestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        throw new AppError("Email is required to request password reset", 400);
    }

    const user = await prisma.user.findUnique({
        where: { email: email }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    // Generate random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Save token and expiry to user
    await prisma.user.update({
        where: { email: email },
        data: {
            resetPasswordToken: token,
            resetPasswordExpires: expiresAt
        }
    });

    // Send email with token (bukan link, hanya token)
    await transporter.sendMail({
        from: '"Admin E-Labs+" <support@yourdomain.com>',
        to: user.email,
        subject: "Password Reset Token",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Reset Request</h2>
                <p>You requested a password reset for your account.</p>
                <p>Use the following token to reset your password:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <strong style="font-size: 18px; letter-spacing: 2px;">${token}</strong>
                </div>
                <p><strong>This token will expire in 15 minutes.</strong></p>
                <p>If you did not request this password reset, please ignore this email.</p>
            </div>
        `
    });

    res.status(200).json({
        message: "Password reset token sent to email",
        expiresIn: 15 * 60 // seconds
    });
});

// Function untuk verify token dan reset password
const VerifyTokenAndResetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email, token, newPassword, confirmPassword } = req.body;

    // Validasi input
    if (!email || !token || !newPassword || !confirmPassword) {
        throw new AppError("Email, token, new password, and confirm password are required", 400);
    }

    if (newPassword !== confirmPassword) {
        throw new AppError("New password and confirm password do not match", 400);
    }

    // Validasi panjang password
    if (newPassword.length < 6) {
        throw new AppError("Password must be at least 6 characters long", 400);
    }

    // Cari user dengan email dan token yang valid
    const user = await prisma.user.findUnique({
        where: { email: email }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    // Verifikasi token
    if (user.resetPasswordToken !== token) {
        throw new AppError("Invalid token", 400);
    }

    // Cek apakah token sudah expired
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        throw new AppError("Token has expired", 400);
    }

    // Hash password baru
    const hashedNewPassword = await HashPassword(newPassword);

    // Update password dan hapus token
    await prisma.user.update({
        where: { email: email },
        data: {
            password: hashedNewPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            updatedAt: new Date()
        }
    });
    // extract token from Authorization header and add to blacklist if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        addToBlacklist(token);
    }

    res.status(200).json({
        message: "Password reset successfully",
        user: {
            email: user.email,
            name: user.nama
        }
    });
});

const ChangePassword = asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const { oldPassword, newPassword, confirmPassword }: UpdatePassword = req.body;

    if (!userPayload) {
        throw new AppError("Unauthorized - User not authenticated", 401);
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
        throw new AppError("Old password, new password and confirm password are required", 400);
    }

    if (newPassword !== confirmPassword) {
        throw new AppError("New password and confirm password do not match", 400);
    }

    const user = await prisma.user.findUnique({
        where: { uniqueId: userPayload.uniqueId }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    // Verify old password
    const isOldPasswordValid = await verifyPassword(user.password, oldPassword);

    if (!isOldPasswordValid) {
        throw new AppError("Old password is incorrect", 400);
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

    // extract token from Authorization header and add to blacklist if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        addToBlacklist(token);
    }

    res.status(200).json({
        message: "Password changed successfully"
    });
});

const ProfileController = {
    WhoAmI,
    UpdateProfile,
    RequestPasswordReset,
    VerifyTokenAndResetPassword,
    ChangePassword
}

export default ProfileController;