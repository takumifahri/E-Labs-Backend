import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../../models/auth';
import { HashPassword, verifyPassword, generateJWTToken, verifyJWTToken } from '../../utils/hash';
import { addToBlacklist } from '../../utils/jwt';
const prisma = new PrismaClient();

const Register = async (req: express.Request, res: express.Response) => {
    // decalare the request body type
    const { email, password, nama, roles }: RegisterRequest = req.body;
    const uniqueId = `USR-${uuidv4()}`;
    const hashPassword = await HashPassword(password);
    try {
        const findExistuser = await prisma.user.findUnique({
            where: { email }
        })

        if (findExistuser) {
            return res.status(400).json({
                message: "User already exists, please usee another email or Login"
            });
        }
        // set jika dia ga input roles dia auto user
        if (!roles) {
            req.body.roles = 'USER';
        }

        const registUser = await prisma.user.create({
            data: {
                uniqueId,
                email,
                password: hashPassword,
                nama,
                roles: roles || 'user', // set default role to USER if not provided
                createdAt: new Date(),
            }
        })

        if (!registUser) {
            return res.status(400).json({ message: "User registration failed" });
        }

        // Dto passby
        const responseRegist: RegisterResponse = {
            uniqueId: registUser.uniqueId,
            email: registUser.email,
            nama: registUser.nama,
            roles: registUser.roles,
            address: registUser.address ?? undefined,
            nim: registUser.nim ?? undefined,
            semester: registUser.semester ?? undefined,
            createdAt: registUser.createdAt
        }

        return res.status(201).json({
            message: "User registered successfully",
            data: responseRegist
        });
    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const Login = async (req: express.Request, res: express.Response) => {
    const { email, password } : LoginRequest = req.body;
    const ValidatingUser = await prisma.user.findUnique({
        where: { email }    
    });
    if (!ValidatingUser) {
        return res.status(400).json({ message: "Invalid email or password" });
    }

    try {
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
            roles: ValidatingUser.roles
        });

        // DTO passby
        const loginResponse: LoginResponse = {
            uniqueId: ValidatingUser.uniqueId,
            email: ValidatingUser.email,
            nama: ValidatingUser.nama,
            roles: ValidatingUser.roles,
            nim: ValidatingUser.nim ?? undefined,
            address: ValidatingUser.address ?? undefined,
            semester: ValidatingUser.semester ?? undefined,
            token: token,
            createdAt: ValidatingUser.createdAt,
            isActive: true
        };

        return res.status(200).json({
            message: "Login successful",
            data: loginResponse
        });

    }catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const Logout = async (req: express.Request, res: express.Response) => {
    // Implement logout logic if needed, e.g., invalidate token
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
}
const AuthController = {
    Register,
    Login,
    Logout
}

export default AuthController;