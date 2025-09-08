import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../cmd/app';
import { v4 as uuidv4 } from 'uuid';
import AuthController from '../../code/controller/api/auth/Authcontroller';
// import AuthController from '../controller/auth/Authcontroller';
import { Request, Response, NextFunction } from 'express';

// Helper untuk mock response
function mockResponse() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  return res as Response;
}

// Helper untuk mock next function
function mockNext() {
  return vi.fn() as NextFunction;
}

describe('AuthController', () => {
  it('Register: should return 400 if user already exists', async () => {
    const req = { body: { email: 'existing@email.com', password: '123456', name: 'Test', roles: 'user' } } as Request;
    const res = mockResponse();
    const next = mockNext();
    await AuthController.Register(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('Login: should return 400 if user not found', async () => {
    const req = { body: { email: 'notfound@email.com', password: 'wrongpass' } } as Request;
    const res = mockResponse();
    const next = mockNext();
    await AuthController.Login(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('Logout: should return 200 even if no token', async () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = mockNext();
    await AuthController.Logout(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Logout successful" });
  });
  it('Logout: should return 200 even if no token', async () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = mockNext();
    await AuthController.Logout(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Logout successful" });
  });
});