import express from 'express';
import AuthController from '../../controller/auth/Authcontroller';

const authRouter = express.Router();

authRouter.post('/register', AuthController.Register);
authRouter.post('/login', AuthController.Login);
authRouter.post('/logout', AuthController.Logout);


export default authRouter;