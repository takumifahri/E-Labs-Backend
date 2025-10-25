import express from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../../../models/user';
import { AppError, asyncHandler } from '../../../middleware/error';
import { HashPassword } from '../../../utils/hash';
import { uploadMiddlewares, FileHandler, UploadCategory } from '../../../utils/FileHandler';

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
        include: { role: true, prodi: true }
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }
    // Calculate totalPeringatan based on boolean warning fields
    const warnings = [
        user.firstWarn ? 1 : 0,
        user.secondWarn ? 1 : 0,
        user.thirdWarn ? 1 : 0
    ];
    const totalPeringatan = warnings.reduce((sum, val) => sum + val, 0);

    // Generate profilUrl jika ada gambar profil
    const profilUrl = user.profil
        ? FileHandler.getFileUrl(UploadCategory.PROFILE, user.profil)
        : undefined;

    const userResponse: UserResponse = {
        id: user.id,
        uniqueId: user.uniqueId,
        nama: user.nama,
        email: user.email,
        NIM: user.NIM ?? undefined,
        semester: user.semester ?? undefined,
        profil: user.profil ?? undefined,
        profilUrl,
        NIP: user.NIP ?? undefined,
        isBlocked: user.isBlocked ?? false,
        prodiId: user.prodiId ?? undefined,
        prodi: user.prodiId && user.prodi ? user.prodi.kode_prodi : undefined,
        totalPeringatan,
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

// const updateUser = asyncHandler(async (req: express.Request, res: express.Response) => {
//     const { uniqueId } = req.params;
//     if (!uniqueId) {
//         throw new AppError("User ID is required", 400);
//     }

//     // Cek apakah ada data yang dikirim (body atau file)
//     const isBodyEmpty = (!req.file && (!req.body || Object.keys(req.body).length === 0));
//     if (isBodyEmpty) {
//         throw new AppError("Request body is missing", 400);
//     }

//     // Build dynamic update data
//     const updateData: any = { updatedAt: new Date() };
//     const allowedFields = ['nama', 'email', 'roleId', 'NIM', 'NIP', 'semester', 'isBlocked', 'prodiId'];
//     allowedFields.forEach(field => {
//         if (req.body && req.body[field] !== undefined && req.body[field] !== '' && req.body[field] !== 'undefined') {
//             // Konversi ke number jika field harus number
//             if (['roleId', 'prodiId'].includes(field)) {
//                 const val = req.body[field];
//                 if (val !== undefined && val !== '' && val !== 'undefined') {
//                     updateData[field] = Number(val);
//                 }
//             } else if (field === 'isBlocked') {
//                 // Konversi boolean
//                 updateData[field] = req.body[field] === 'true' || req.body[field] === true;
//             } else {
//                 updateData[field] = req.body[field];
//             }
//         }
//     });
//     allowedFields.forEach(field => {
//         if (req.body && req.body[field] !== undefined) {
//             updateData[field] = req.body[field];
//         }
//     });

//     // Jika ada file gambar dikirim
//     if (req.file) {
//         const user = await prisma.user.findUnique({ where: { uniqueId } });
//         if (user?.profil) {
//             await FileHandler.deleteFile(UploadCategory.PROFILE, user.profil);
//         }
//         updateData.profil = req.file.filename; // simpan nama file
//     }
//     const updatedUser = await prisma.user.update({
//         where: { uniqueId },
//         data: updateData,
//         include: { role: true, prodi: true }
//     });

//     const warnings = [
//         updatedUser.firstWarn ? 1 : 0,
//         updatedUser.secondWarn ? 1 : 0,
//         updatedUser.thirdWarn ? 1 : 0
//     ];
//     const totalPeringatan = warnings.reduce((sum, val) => sum + val, 0);

//     const profilUrl = updatedUser.profil
//         ? FileHandler.getFileUrl(UploadCategory.PROFILE, updatedUser.profil)
//         : undefined;
//     const userResponse: UserResponse = {
//         id: updatedUser.id,
//         uniqueId: updatedUser.uniqueId,
//         nama: updatedUser.nama,
//         email: updatedUser.email,
//         NIM: updatedUser.NIM ?? undefined,
//         semester: updatedUser.semester ?? undefined,
//         profil: updatedUser.profil ?? undefined,
//         profilUrl,
//         NIP: updatedUser.NIP ?? undefined,
//         isBlocked: updatedUser.isBlocked ?? false,
//         prodiId: updatedUser.prodiId ?? undefined,
//         prodi: updatedUser.prodiId && updatedUser.prodi ? updatedUser.prodi.kode_prodi : undefined,
//         totalPeringatan,
//         role: {
//             ...updatedUser.role,
//             deletedAt: updatedUser.role.deletedAt ?? undefined
//         },
//         createdAt: updatedUser.createdAt,
//         updatedAt: updatedUser.updatedAt,
//     };

//     return res.status(200).json({
//         message: "User updated successfully",
//         data: userResponse
//     });
// });

const updateUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { uniqueId } = req.params;
    if (!uniqueId) throw new AppError("User ID is required", 400);

    // Debug log
    console.log('🔍 Update User Debug:');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    // Ambil user lama
    const existing = await prisma.user.findUnique({ where: { uniqueId } });
    if (!existing) throw new AppError("User not found", 404);

    // Handle file upload (profil)
    let newProfil = existing.profil;
    if (req.file) {
        if (existing.profil) {
            await FileHandler.deleteFile(UploadCategory.PROFILE, existing.profil);
        }
        newProfil = req.file.filename;
        console.log(`📸 User profile image updated: ${newProfil}`);
    }

    // Build updateData robust (hanya field valid dan tipe benar)
    const updateData: any = { updatedAt: new Date() };
    if (req.body.nama !== undefined && req.body.nama !== '') updateData.nama = req.body.nama;
    if (req.body.email !== undefined && req.body.email !== '') updateData.email = req.body.email;
    if (req.body.roleId !== undefined && req.body.roleId !== '' && req.body.roleId !== 'undefined') {
        // Pastikan roleId number
        const roleId = Number(req.body.roleId);
        if (!isNaN(roleId)) updateData.roleId = roleId;
    }
    if (req.body.NIM !== undefined && req.body.NIM !== '') updateData.NIM = req.body.NIM;
    if (req.body.NIP !== undefined && req.body.NIP !== '') updateData.NIP = req.body.NIP;
    if (req.body.semester !== undefined && req.body.semester !== '') updateData.semester = Number(req.body.semester);
    if (req.body.prodiId !== undefined && req.body.prodiId !== '' && req.body.prodiId !== 'undefined') {
        const prodiId = Number(req.body.prodiId);
        if (!isNaN(prodiId)) updateData.prodiId = prodiId;
    }
    if (req.body.isBlocked !== undefined) {
        updateData.isBlocked = req.body.isBlocked === 'true' || req.body.isBlocked === true;
    }
    if (req.file) updateData.profil = newProfil;

    // Jika tidak ada data valid, error
    if (Object.keys(updateData).length === 1 && !req.file) {
        throw new AppError("No data provided to update", 400);
    }

    // Update user
    const updatedUser = await prisma.user.update({
        where: { uniqueId },
        data: updateData,
        include: { role: true, prodi: true }
    });

    // Build response dengan URL profil
    const profilUrl = updatedUser.profil
        ? FileHandler.getFileUrl(UploadCategory.PROFILE, updatedUser.profil)
        : undefined;

    const userResponse: UserResponse = {
        id: updatedUser.id,
        uniqueId: updatedUser.uniqueId,
        nama: updatedUser.nama,
        email: updatedUser.email,
        NIM: updatedUser.NIM ?? undefined,
        semester: updatedUser.semester ?? undefined,
        profil: updatedUser.profil ?? undefined,
        profilUrl,
        NIP: updatedUser.NIP ?? undefined,
        isBlocked: updatedUser.isBlocked ?? false,
        prodiId: updatedUser.prodiId ?? undefined,
        prodi: updatedUser.prodiId && updatedUser.prodi ? updatedUser.prodi.kode_prodi : undefined,
        role: {
            ...updatedUser.role,
            deletedAt: updatedUser.role.deletedAt ?? undefined
        },
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
    };

    res.status(200).json({
        message: "User updated successfully",
        data: userResponse,
        file_info: req.file ? {
            original_name: req.file.originalname,
            filename: newProfil,
            size: req.file.size,
            mime_type: req.file.mimetype
        } : null,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updatedAt')
    });
});
const ListUsers = asyncHandler(async (req: express.Request, res: express.Response) => {
    const users = await prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        
        include: { role: true, prodi: true }
    });

    if (users.length === 0) {
        return res.status(200).json({ 
            message: "No users found",
            data: []
        });
    }

    const userResponses: UserResponse[] = users.map((user) => {
        // Calculate totalPeringatan based on boolean warning fields
        const warnings = [
            user.firstWarn ? 1 : 0,
            user.secondWarn ? 1 : 0,
            user.thirdWarn ? 1 : 0
        ];
        const totalPeringatan = warnings.reduce((sum, val) => sum + val, 0);
        const profilUrl = user.profil
            ? FileHandler.getFileUrl(UploadCategory.PROFILE, user.profil)
            : undefined;

        return {
            id: user.id,
            uniqueId: user.uniqueId,
            nama: user.nama,
            email: user.email,
            NIM: user.NIM ?? undefined,
            semester: user.semester ?? undefined,
            profil: user.profil ?? undefined,
            profilUrl,
            NIP: user.NIP ?? undefined,
            isBlocked: user.isBlocked ?? false,
            prodiId: user.prodiId ?? undefined,
            prodi: user.prodiId && user.prodi ? user.prodi.kode_prodi : undefined,
            totalPeringatan,
            role: {
                ...user.role,
                deletedAt: user.role.deletedAt ?? undefined
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    });

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

const deactivatedUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    if (!id) {
        throw new AppError("User ID is required", 400);
    }
    try{
        // cek apakah user udah isBlocked True
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) }
        });
        if(user?.isBlocked){
            throw new AppError("User is already deactivated", 400);
        }
        await prisma.user.update({
            where: { id: parseInt(id) },
            data: { isBlocked: true }
        });
    } catch(error){
        throw new AppError("Failed to deactivate user", 500);
    }
    return res.status(200).json({ message: "User deactivated successfully" });
});

const reactivatedUser = asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    if (!id) {
        throw new AppError("User ID is required", 400);
    }
    try{
        // cek apakah user udah isBlocked True
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) }
        });
        if(user?.isBlocked === false){
            throw new AppError("User is already reactivated", 400);
        }
        await prisma.user.update({
            where: { id: parseInt(id) },
            data: { isBlocked: false }
        });
    } catch(error){
        throw new AppError("Failed to reactivate user", 500);
    }
    return res.status(200).json({ message: "User reactivated successfully" });
});

const getDashboardStats = asyncHandler(async (req: express.Request, res: express.Response) => {
    // Hitung total user per role
    const totalMahasiswa = await prisma.user.count({
        where: { deletedAt: null, role: { nama_role: 'mahasiswa' } }
    });
    const totalDosen = await prisma.user.count({
        where: { deletedAt: null, role: { nama_role: 'dosen' } }
    });
    const totalPengelola = await prisma.user.count({
        where: { deletedAt: null, role: { nama_role: 'pengelola' } }
    });

    // Hitung total user aktif & terblokir
    const totalActive = await prisma.user.count({
        where: { deletedAt: null, isBlocked: false }
    });
    const totalBlocked = await prisma.user.count({
        where: { deletedAt: null, isBlocked: true }
    });

    // User yang paling sering meminjam barang
    const topBarangUser = await prisma.peminjaman_Handset.groupBy({
        by: ['user_id'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
    });

    // User yang paling sering meminjam ruangan
    const topRuanganUser = await prisma.peminjaman_Ruangan.groupBy({
        by: ['user_id'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
    });

    // Ambil detail user untuk top peminjam
    const topBarangUserDetails = await Promise.all(
        topBarangUser.map(async (u) => {
            const user = await prisma.user.findUnique({ where: { id: u.user_id } });
            return {
                user_id: u.user_id,
                nama: user?.nama,
                email: user?.email,
                total_peminjaman_barang: u._count.id
            };
        })
    );

    const topRuanganUserDetails = await Promise.all(
        topRuanganUser.map(async (u) => {
            const user = await prisma.user.findUnique({ where: { id: u.user_id } });
            return {
                user_id: u.user_id,
                nama: user?.nama,
                email: user?.email,
                total_peminjaman_ruangan: u._count.id
            };
        })
    );

    return res.status(200).json({
        message: "Dashboard statistics",
        data: {
            totalMahasiswa,
            totalDosen,
            totalPengelola,
            totalActive,
            totalBlocked,
            topBarangUser: topBarangUserDetails,
            topRuanganUser: topRuanganUserDetails
        }
    });
});
const UserController = {
    CreateUser,
    getUserById,
    updateUser,
    deleteUser,
    ListUsers,

    deactivatedUser,
    getDashboardStats,
    reactivatedUser
};

export default UserController;