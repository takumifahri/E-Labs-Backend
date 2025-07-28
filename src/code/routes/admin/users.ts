import express from 'express';
import UserController from '../../controller/api/admin/user';

const AdminUserRouter = express.Router();

AdminUserRouter.post('/', UserController.CreateUser);
AdminUserRouter.get('/:uniqueId', UserController.getUserById);
AdminUserRouter.patch('/:uniqueId', UserController.updateUser);
AdminUserRouter.delete('/:uniqueId', UserController.deleteUser);
AdminUserRouter.get('/', UserController.ListUsers);

export default AdminUserRouter;
