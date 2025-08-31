export interface Role {
    id: number;
    roleName: string;
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
    isActive: boolean;
    address?: string;
    roleId: number;
    role: Role;
    nim?: string;
    nip?: string;
    semester?: string;
    photoProfile?: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

export interface CreateUserRequest {
    nama: string;
    email: string;
    password: string;
    roleId: number;
}

export interface UpdateUserRequest {
    nama?: string;
    email?: string;
    roleId?: number;
    address?: string;
    nim?: string;
    nip?: string;
    semester?: string;
}

export interface UserResponse {
    uniqueId: string;
    nama: string;
    email: string;
    address?: string;
    nim?: string;
    nip?: string;
    semester?: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}
