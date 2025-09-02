export type roles = {
    ADMIN: 'admin';
    USER: 'user';
}

export interface User {
    id: number;
    uniqueId: string;
    nama: string;
    email: string;
    password: string;
    isActive: boolean;
    role: roles[keyof roles];
    address?: string;
    nim?: string;
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
    role: roles[keyof roles];
}   

export interface UpdateUserRequest {
    nama?: string;
    email?: string;
    role?: roles[keyof roles];
    address?: string;
    nim?: string;
}

export interface UserResponse {
    uniqueId: string;
    nama: string;
    email: string;
    address?: string;
    nim?: string;
    roles: roles[keyof roles];
    createdAt: Date;
    updatedAt: Date;
}
