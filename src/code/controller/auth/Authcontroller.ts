import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../../models/auth';
import { HashPassword, verifyPassword, generateJWTToken, verifyJWTToken } from '../../utils/hash';
import { addToBlacklist } from '../../utils/jwt';

const prisma = new PrismaClient();

const Register = async (req: express.Request, res: express.Response) => {
    const { email, password, nama, roleId }: RegisterRequest = req.body;
    // Determine prefix based on roleId
    let prefix = 'USR'; // default
    if (roleId === 1) prefix = 'MHS'; // Mahasiswa
    else if (roleId === 2) prefix = 'DSN'; // Dosen
    else if (roleId === 3) prefix = 'TKS'; // Teknisi
    else if (roleId === 4) prefix = 'ADM'; // Superadmin
    
    const uniqueId = `${prefix}-${uuidv4()}`;
    const hashPassword = await HashPassword(password);
    
    try {
        const findExistuser = await prisma.user.findUnique({
            where: { email }
        });

        if (findExistuser) {
            return res.status(400).json({
                message: "User already exists, please use another email or Login"
            });
        }

        // Set default roleId jika tidak ada (misal roleId 1 untuk USER)
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

        if (!registUser) {
            return res.status(400).json({ message: "User registration failed" });
        }

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

        return res.status(201).json({
            message: "User registered successfully",
            data: responseRegist
        });
    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const Login = async (req: express.Request, res: express.Response) => {
    const { email, password }: LoginRequest = req.body;
    
    try {
        const ValidatingUser = await prisma.user.findUnique({
            where: { email },
            include: { role: true }
        });

        if (!ValidatingUser) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const comparePassword = await verifyPassword(ValidatingUser.password, password);
        if (!comparePassword) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Set isActive to true on login
        await prisma.user.update({
            where: { email },
            data: { isActive: true }
        });

        const token = await generateJWTToken({
            uniqueId: ValidatingUser.uniqueId,
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

        return res.status(200).json({
            message: "Login successful",
            data: loginResponse
        });

    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const Logout = async (req: express.Request, res: express.Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        let decodedToken: any;
        try {
            decodedToken = await verifyJWTToken(token);
            if (!decodedToken || !decodedToken.uniqueId) {
                return res.status(401).json({ message: "Unauthorized, invalid token" });
            }
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
        
        await prisma.user.update({
            where: { uniqueId: decodedToken.uniqueId },
            data: { isActive: false }
        });
        addToBlacklist(token);
    }
    return res.status(200).json({ message: "Logout successful" });
};

const AuthController = {
    Register,
    Login,
    Logout
};

export default AuthController;