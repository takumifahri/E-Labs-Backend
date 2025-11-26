import cors from 'cors';

const corsOptions: cors.CorsOptions = {
    origin: [
        'http://localhost:3000', 
        'http://localhost:5137', 
        'https://e-labs-backup.vercel.app', // ✅ Hapus trailing slash
        'https://elabs-api.takumifahri.my.id', // ✅ Hapus trailing slash
        'https://backend-takumifahri.vercel.app', // ✅ Hapus trailing slash
        'https://elabs.takumifahri.my.id'
    ],
    methods: [
        'GET', 
        'HEAD', 
        'PUT', 
        'PATCH', 
        'POST', 
        'DELETE',
        'OPTIONS' // ✅ Tambahkan OPTIONS untuk preflight
    ],
    allowedHeaders: [
        'Content-Type', 
        'Authorization'
    ],
    credentials: true,
    preflightContinue: false, // ✅ Tambahkan ini
    optionsSuccessStatus: 204 // ✅ Tambahkan ini untuk legacy browsers
};

export default corsOptions;