import { Request, Response, NextFunction } from "express";
import { verifyJWTToken } from "../utils/hash";
import { isBlacklisted } from "../utils/jwt";
import { roles } from "../models/user";
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
       const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];

    if (isBlacklisted(token)) {
        return res.status(401).json({ message: 'Token revoked' });
    }

    try {
        const decoded = await verifyJWTToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        (req as any).user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

 function Checkroles(requiredRole: roles[keyof roles]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.roles) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        // Jika roles array
        if (Array.isArray(user.roles) && user.roles.includes(requiredRole)) {
            return next();
        }
        // Jika roles string
        if (typeof user.roles === 'string' && user.roles === requiredRole) {
            return next();
        }
        next();
        // Jika tidak sesuai dengan role yang dibutuhkan
        return res.status(403).json({ message: 'Unauthorized, Access denied' });
    };
}

const AuthMiddleware = {
    authMiddleware,
    Checkroles
}

export default AuthMiddleware;