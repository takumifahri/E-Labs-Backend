import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../../models/auth';
import { HashPassword, verifyPassword, generateJWTToken, verifyJWTToken } from '../../utils/hash';
import { addToBlacklist } from '../../utils/jwt';
import { AppError, asyncHandler } from '../../middleware/error';
import { logActivity } from '../api/user/LogController';
const prisma = new PrismaClient();

const Register = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password, nama, roleId }: RegisterRequest = req.body;

    // Validation
    if (!email || !password || !nama) {
        throw new AppError("Email, password, and name are required", 400);
    }

    // Determine prefix based on roleId
    let prefix = 'USR'; // default
    if (roleId === 1) prefix = 'MHS'; // Mahasiswa
    else if (roleId === 2) prefix = 'DSN'; // Dosen
    else if (roleId === 3) prefix = 'TKS'; // Teknisi
    else if (roleId === 4) prefix = 'ADM'; // Superadmin

    const uniqueId = `${prefix}-${uuidv4()}`;
    const hashPassword = await HashPassword(password);

    const findExistuser = await prisma.user.findUnique({
        where: { email }
    });

    if (findExistuser) {
        throw new AppError("User already exists, please use another email or Login", 400);
    }

    // Set default roleId jika tidak ada
    const defaultRoleId = roleId || 1;

    const registUser = await prisma.user.create({
        data: {
            uniqueId,
            email,
            password: hashPassword,
            nama,
            roleId: defaultRoleId,
            createdAt: new Date(),
        },
        include: { role: true }
    });

    const responseRegist: RegisterResponse = {
        uniqueId: registUser.uniqueId,
        email: registUser.email,
        nama: registUser.nama,
        roles: registUser.role.nama_role,
        NIM: registUser.NIM ?? undefined,
        NIP: registUser.NIP ?? undefined,
        semester: registUser.semester ?? undefined,
        createdAt: registUser.createdAt
    };
    // await logActivity({
    //     user_id: registUser.id,
    //     pesan: `Registrasi akun baru (${registUser.email})`,
    //     aksi: 'REGISTER',
    //     tabel_terkait: 'User'
    // });
    return res.status(201).json({
        message: "User registered successfully",
        data: responseRegist
    });
});

const Login = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password }: LoginRequest = req.body;

    // Validation
    if (!email || !password) {
        throw new AppError("Email and password are required", 400);
    }

    const ValidatingUser = await prisma.user.findUnique({
        where: { email },
        include: { role: true }
    });

    if (!ValidatingUser) {
        throw new AppError("Invalid email or password", 401);
    }

    const comparePassword = await verifyPassword(ValidatingUser.password, password);
    if (!comparePassword) {
        throw new AppError("Invalid email or password", 401);
    }

    // Check if user is deleted
    if (ValidatingUser.deletedAt) {
        throw new AppError("Account has been deactivated", 403);
    }

    // Set isActive to true on login
    await prisma.user.update({
        where: { email },
        data: { isActive: true }
    });

    const token = await generateJWTToken({
        id: ValidatingUser.id,
        uniqueId: ValidatingUser.uniqueId,
        nama: ValidatingUser.nama,
        email: ValidatingUser.email,
        roleId: ValidatingUser.roleId,
        nama_role: ValidatingUser.role.nama_role
    });

    const loginResponse: LoginResponse = {
        uniqueId: ValidatingUser.uniqueId,
        email: ValidatingUser.email,
        nama: ValidatingUser.nama,
        roles: ValidatingUser.role.nama_role,
        NIM: ValidatingUser.NIM ?? undefined,
        semester: ValidatingUser.semester ?? undefined,
        token: token,
        createdAt: ValidatingUser.createdAt,
        isActive: true
    };

    // await logActivity({
    //     user_id: ValidatingUser.id,
    //     pesan: `Login ke sistem (${ValidatingUser.email})`,
    //     aksi: 'LOGIN',
    //     tabel_terkait: 'User'
    // });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 6 * 60 * 60 * 1000 // 6 hours
    });
    return res.status(200).json({
        message: "Login successful",
        data: loginResponse
    });
});

const Logout = asyncHandler(async (req: express.Request, res: express.Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        try {
            const decodedToken = await verifyJWTToken(token) as { uniqueId: string; email: string; roleId: number; nama_role: string };
            if (!decodedToken || !decodedToken.uniqueId) {
                throw new AppError("Invalid token", 401);
            }

            await prisma.user.update({
                where: { uniqueId: decodedToken.uniqueId },
                data: { isActive: false }
            });
            addToBlacklist(token);
        } catch (error) {
            throw new AppError("Invalid token", 401);
        }
    }

    return res.status(200).json({ message: "Logout successful" });
});

const AuthController = {
    Register,
    Login,
    Logout
};

export default AuthController;