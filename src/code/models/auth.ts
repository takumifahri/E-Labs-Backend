import { roles } from "./user";


export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    roles: roles[keyof roles];
}

export interface RegisterResponse {
    uniqueId: string;
    email: string;
    name: string;
    createdAt: Date;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    uniqueId: string;
    email: string;
    name: string;
    roles: roles[keyof roles];
    token: string;
    createdAt: Date;
}