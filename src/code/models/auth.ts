import { roles } from "./user";


export interface RegisterRequest {
    email: string;
    password: string;
    nama: string;
    roles: roles[keyof roles];
}

export interface RegisterResponse {
    uniqueId: string;
    email: string;
    nama: string;
    semester?: string;
    address?: string;
    nim?: string;
    roles: roles[keyof roles];
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
    roles: roles[keyof roles];
    semester?: string;
    address?: string;
    nim?: string; 
    isActive: boolean;
    token: string;
    createdAt: Date;
}