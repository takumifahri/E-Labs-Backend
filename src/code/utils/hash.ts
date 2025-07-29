import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { error } from 'console';
import dotenv from 'dotenv';

dotenv.config();
type SignOptions = {
    expiresIn?: string | number;
}

const jwtSecret = process.env.JWT_SECRET;

export async function HashPassword(password: string): Promise<string> {
    try {
        const hashedPassword = await argon2.hash(password);
        return hashedPassword;
    } catch (error) {
        throw new Error('Error hashing password');
    }
}

export async function verifyPassword(hashPassword: string, password: string): Promise<boolean> {
    try {
        const isMatch = await argon2.verify(hashPassword, password);
        return isMatch;
    } catch (error) {
        throw new Error('Error verifying password');
    }
}

export async function generateJWTToken(payload: string | object, expiresIn: string | number = '2d'): Promise<string> {
    if (!jwtSecret) {
        throw new Error('JWT secret is not defined');
    }
    return new Promise((resolve, reject) => {
        jwt.sign(payload, jwtSecret, { expiresIn: expiresIn as any }, (err, token) => {
            if (err || !token) {
                reject(new Error('Error generating JWT token'));
            } else {
                resolve(token);
            }
        });
    });
}

export async function verifyJWTToken(token: string): Promise<object | null> {
    if (!jwtSecret) {
        throw new Error('JWT secret is not defined');
    }
    return new Promise((resolve, reject) => {
        jwt.verify(token, jwtSecret, (err, decoded) => {
            if (err) {
                reject(new Error('Invalid JWT token'));
            } else {
                resolve(decoded as object);
            }
        });
    });
}