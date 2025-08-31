import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserRequest, UpdateUserRequest } from '../../../models/user';
import { UserResponse, User as Users } from '../../../models/user';

import { error } from 'console';
// Disini ktia akan buat logic crud 

const prisma = new PrismaClient();
const CreateUser = async (req: express.Request, res: express.Response) => {
    const { nama, email, password, roleId }: CreateUserRequest = req.body;
    const uniqueId = `USR-${uuidv4()}`;
    try {
        const addUser = await prisma.user.create({
            data: {
                uniqueId,
                nama,
                email,
                password,
                roleId,
                createdAt: new Date(),
            },
            include: { role: true }
        });
        if (!addUser) {
            return res.status(400).json({ message: "User creation failed" });
        }
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
    } catch (err) {
        console.error("Error creating user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getUserById = async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { uniqueId },
            include: { role: true }
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const userResponse: UserResponse = {
            uniqueId: user.uniqueId,
            nama: user.nama,
            email: user.email,
            address: user.address ?? undefined,
            nim: user.nim ?? undefined,
            nip: user.nip ?? undefined,
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
    } catch (err) {
        console.error("Error retrieving user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const updateUser = async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    const { nama, email, address, roleId, nim, nip, semester }: UpdateUserRequest = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { uniqueId },
            data: {
                nama,
                email,
                address,
                roleId,
                nim,
                nip,
                semester,
                updatedAt: new Date()
            },
            include: { role: true }
        });
        const userResponse: UserResponse = {
            uniqueId: updatedUser.uniqueId,
            nama: updatedUser.nama,
            email: updatedUser.email,
            address: updatedUser.address ?? undefined,
            nim: updatedUser.nim ?? undefined,
            nip: updatedUser.nip ?? undefined,
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
    } catch (err) {
        console.error("Error updating user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const ListUsers = async (req: express.Request, res: express.Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { role: true }
        });

        if (users.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }

        const userResponses: UserResponse[] = users.map((user) => ({
            uniqueId: user.uniqueId,
            nama: user.nama,
            email: user.email,
            address: user.address ?? undefined,
            nim: user.nim ?? undefined,
            nip: user.nip ?? undefined,
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
    } catch (err) {
        console.error("Error retrieving users:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const deleteUser = async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    try {
        const deletedUser = await prisma.user.update({
            where: { uniqueId },
            data: { deletedAt: new Date() },
            include: { role: true }
        });
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const UserController = {
    CreateUser,
    getUserById,
    updateUser,
    deleteUser,
    ListUsers
}

export default UserController;