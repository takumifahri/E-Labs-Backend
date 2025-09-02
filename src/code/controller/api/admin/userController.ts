import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserRequest } from '../../../models/user';
import { UserResponse, User as Users } from '../../../models/user';

import { error } from 'console';
// Disini ktia akan buat logic crud 

const prisma = new PrismaClient();

const CreateUser = async (req: express.Request, res: express.Response) => {
    const { nama, email, password, role }: CreateUserRequest = req.body;
    const uniqueId = `USR-${uuidv4()}`;
    try {
        const addUser = await prisma.user.create({
            data: {
                uniqueId,
                nama,
                email,
                password,
                roles: role,
                createdAt: new Date(),
            }
        });
        if (!addUser) {
            console.log("User creation failed:", error); // Log the error for debugging
            return res.status(400).json({ message: "User creation failed", error: error });
        }
        return res.status(201).json({
            message: "User created successfully",
            data: {
                uniqueId: addUser.uniqueId,
                nama: addUser.nama,
                email: addUser.email,
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
            where: { uniqueId }
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Mapping ke DTO
        const userResponse: UserResponse = {
            uniqueId: user.uniqueId,
            nama: user.nama,
            email: user.email,
            address: user.address ?? undefined,
            nim: user.nim ?? undefined,
            roles: user.roles,
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
    const { nama, email, address, role, nim } = req.body;
    try {
        const updatedUser = await prisma.user.update({
            where: { uniqueId },
            data: {
                nama: nama,
                email,
                address,
                nim: nim,
                roles: role,
                updatedAt: new Date()
            }
        });
        return res.status(200).json({
            message: "User updated successfully",
            data: updatedUser
        });
    } catch (err) {
        console.error("Error updating user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const deleteUser = async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    try {
        const deletedUser = await prisma.user.update({
            where: { uniqueId },
            data: { deletedAt: new Date() }
        });
        return res.status(200).json({ message: "User soft deleted successfully" });
    } catch (err) {
        console.error("Error soft deleting user:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const ListUsers = async (req: express.Request, res: express.Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' }
        });

        if (users.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }

        const userResponses: UserResponse[] = users.map((user: { uniqueId: any; nama: any; email: any; address: any; nim: any; roles: any; createdAt: any; updatedAt: any; }) => ({
            uniqueId: user.uniqueId,
            nama: user.nama,
            email: user.email,
            address: user.address ?? undefined,
            nim: user.nim ?? undefined,
            roles: user.roles,
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

const UserController = {
    CreateUser,
    getUserById,
    updateUser,
    deleteUser,
    ListUsers
}

export default UserController;