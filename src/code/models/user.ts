export interface Role {
    id: number;
    nama_role: string;
    deskripsi: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface User {
    id: number;
    uniqueId: string;
    nama: string;
    email: string;
    password: string;
    roleId: number;
    role: Role;

    NIM?: string;
    semester?: number;

    NIP?: string;

    profil?: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateUserRequest {
    nama: string;
    email: string;
    password: string;
    roleId?: number; // Optional since it has default value 1
}

export interface UpdateUserRequest {
    nama?: string;
    email?: string;
    roleId?: number;
    NIM?: string;
    NIP?: string;
    semester?: number;
    profil?: string;
}

export interface UserResponse {
    id: number;
    uniqueId: string;
    nama: string;
    email: string;

    NIM?: string;
    semester?: number;
    profilUrl?: string;
    profil?: string;
    NIP?: string;
    isBlocked?: boolean;
    prodiId?: number;
    prodi?: string;

    totalPeringatan?: number;

    role: Role;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdatePassword {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
}