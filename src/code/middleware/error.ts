import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

interface CustomError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: CustomError | PrismaClientKnownRequestError | PrismaClientValidationError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal Server Error';

    // Handle Prisma errors
    if (err instanceof PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                statusCode = 409;
                const field = err.meta?.target as string[] | undefined;
                message = `Duplicate entry for ${field ? field.join(', ') : 'field'}`;
                break;
            case 'P2025':
                statusCode = 404;
                message = 'Record not found';
                break;
            case 'P2003':
                statusCode = 400;
                message = 'Foreign key constraint violation';
                break;
            case 'P2014':
                statusCode = 400;
                message = 'The change you are trying to make would violate the required relation';
                break;
            default:
                statusCode = 400;
                message = 'Database operation failed';
        }
    } else if (err instanceof PrismaClientValidationError) {
        statusCode = 400;
        message = 'Invalid data provided';
    } else {
        // Handle custom errors
        statusCode = (err as CustomError).statusCode || 500;
        message = err.message || 'Internal Server Error';
    }

    // Log error for debugging
    console.error(`Error ${statusCode}: ${message}`);
    console.error(err.stack);

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            ...(process.env.NODE_ENV === 'development' && { 
                stack: err.stack,
                details: err instanceof PrismaClientKnownRequestError ? {
                    code: err.code,
                    meta: err.meta
                } : undefined
            })
        }
    });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
    const error = new AppError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};