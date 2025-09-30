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
        console.error('Error hashing password:', error);
        throw new Error('Error hashing password');
    }
}

export async function verifyPassword(hashPassword: string, password: string): Promise<boolean> {
    try {
        // Pastikan parameter tidak null/undefined
        if (!hashPassword || !password) {
            console.error('Hash or password is empty');
            return false;
        }
        
        // argon2.verify(hash, plaintext)
        const isMatch = await argon2.verify(hashPassword, password);
        return isMatch;
    } catch (error) {
        console.error('Error verifying password:', error);
        // Return false instead of throwing error untuk better UX
        return false;
    }
}

<<<<<<< HEAD
export async function generateJWTToken(payload: string | object, expiresIn: string | number = '6h'): Promise<string> {
=======
export async function generateJWTToken(payload: string | object, expiresIn: string | number = '10m'): Promise<string> {
>>>>>>> 90ceb5e2229d4035932ddbdc9b06061bd84ec155
    if (!jwtSecret) {
        throw new Error('JWT secret is not defined');
    }
    return new Promise((resolve, reject) => {
        jwt.sign(payload, jwtSecret, { expiresIn: expiresIn as any }, (err, token) => {
            if (err || !token) {
                console.error('Error generating JWT token:', err);
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
                console.error('Error verifying JWT token:', err);
                reject(new Error('Invalid JWT token'));
            } else {
                resolve(decoded as object);
            }
        });
    });
}