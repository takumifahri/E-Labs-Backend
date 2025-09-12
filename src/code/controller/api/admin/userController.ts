import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../../../models/user';
import { AppError, asyncHandler } from '../../../middleware/error';
import { HashPassword } from '../../../utils/hash';

const prisma = new PrismaClient();

const CreateUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { nama, email, password, roleId }: CreateUserRequest = req.body;

    if (!nama || !email || !password) {
        throw new AppError("Name, email, and password are required", 400);
    }

    const uniqueId = `USR-${uuidv4()}`;
    const hashedPassword = await HashPassword(password);

    const addUser = await prisma.user.create({
        data: {
            uniqueId,
            nama,
            email,
            password: hashedPassword,
            roleId: roleId || 1,
            createdAt: new Date(),
        },
        include: { role: true }
    });

    return res.status(201).json({
        message: "User created successfully",
        data: {
            uniqueId: addUser.uniqueId,
            nama: addUser.nama,
            email: addUser.email,
            role: addUser.role,
            createdAt: addUser.createdAt
        }
    });
});

const getUserById = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;

    if (!uniqueId) {
        throw new AppError("User ID is required", 400);
    }

    const user = await prisma.user.findUnique({
        where: { uniqueId },
        include: { role: true }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const userResponse: UserResponse = {
        uniqueId: user.uniqueId,
        nama: user.nama,
        email: user.email,
        NIM: user.NIM ?? undefined,
        NIP: user.NIP ?? undefined,
        semester: user.semester ?? undefined,
        role: {
            ...user.role,
            deletedAt: user.role.deletedAt ?? undefined
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };

    return res.status(200).json({
        message: "User retrieved successfully",
        data: userResponse
    });
});

const updateUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    const { nama, email, roleId, NIM, NIP, semester }: UpdateUserRequest = req.body;

    if (!uniqueId) {
        throw new AppError("User ID is required", 400);
    }

    const updatedUser = await prisma.user.update({
        where: { uniqueId },
        data: {
            nama,
            email,
            roleId,
            NIM,
            NIP,
            semester,
            updatedAt: new Date()
        },
        include: { role: true }
    });

    const userResponse: UserResponse = {
        uniqueId: updatedUser.uniqueId,
        nama: updatedUser.nama,
        email: updatedUser.email,
        NIM: updatedUser.NIM ?? undefined,
        NIP: updatedUser.NIP ?? undefined,
        semester: updatedUser.semester ?? undefined,
        role: {
            ...updatedUser.role,
            deletedAt: updatedUser.role.deletedAt ?? undefined
        },
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
    };

    return res.status(200).json({
        message: "User updated successfully",
        data: userResponse
    });
});

const ListUsers = asyncHandler(async (req: express.Request, res: express.Response) => {
    const users = await prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { role: true }
    });

    if (users.length === 0) {
        return res.status(200).json({ 
            message: "No users found",
            data: []
        });
    }

    const userResponses: UserResponse[] = users.map((user) => ({
        uniqueId: user.uniqueId,
        nama: user.nama,
        email: user.email,
        NIM: user.NIM ?? undefined,
        NIP: user.NIP ?? undefined,
        semester: user.semester ?? undefined,
        role: {
            ...user.role,
            deletedAt: user.role.deletedAt ?? undefined
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }));

    return res.status(200).json({
        message: "Users retrieved successfully",
        data: userResponses
    });
});

const deleteUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;

    if (!uniqueId) {
        throw new AppError("User ID is required", 400);
    }

    await prisma.user.update({
        where: { uniqueId },
        data: { deletedAt: new Date() }
    });

    return res.status(200).json({ message: "User deleted successfully" });
});

const UserController = {
    CreateUser,
    getUserById,
    updateUser,
    deleteUser,
    ListUsers
}

export default UserController;