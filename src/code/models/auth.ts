import { Role } from "./user";


export interface RegisterRequest {
    email: string;
    password: string;
    nama: string;
    roles: Role[keyof Role];
    roleId?: number;
}

export interface RegisterResponse {
    uniqueId: string;
    email: string;
    nama: string;
    semester?: number;
    address?: string;
    NIP?: string;
    NIM?: string;
    roles: Role[keyof Role];
    createdAt: Date;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    uniqueId: string;
    email: string;
    nama: string;
    roles: Role[keyof Role];
    semester?: number;
    address?: string;
    NIM?: string;
    isActive: boolean;
    token: string;
    createdAt: Date;
}