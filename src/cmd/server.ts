import app from "./app";
import http from 'http';
import { Server } from 'socket.io';
import config from "../code/config/config";
import { PrismaClient } from "@prisma/client";
import { initBookingScheduler } from '../code/utils/scheduler';
import { RoomManager } from '../code/utils/roomManager';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty'
});
prisma.$connect()
    .then(async () => {
        console.log('✅ Database connected successfully');
        await RoomManager.init();
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error);
    });
    
initBookingScheduler();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User Disconnected:', socket.id);
  });
});

app.set('socketio', io);

const PORT = config.port || 3000;

server.listen(PORT, () => {
    // Pindahkan log yang tadi di atas ke sini
    if (config.nodeEnv === 'development') {
        console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode with Socket.io`);
        console.log(`Running at http://${config.host}:${PORT}`);
    }
    if (config.nodeEnv === 'production') {
        console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode with Socket.io`);
        console.log(`Running at https://${config.host}:${PORT}`);
    }
});