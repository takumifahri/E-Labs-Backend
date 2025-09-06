import cors from 'cors';

const corsOptions: cors.CorsOptions = {
    origin: [
        'http://localhost:3000', 
        'http://localhost:5137', 
        
        'https://backend-takumifahri.vercel.app/'
    ],
    methods: [
        'GET', 
        'HEAD', 
        'PUT', 
        'PATCH', 
        'POST', 
        'DELETE'
    ],
    allowedHeaders: [
        'Content-Type', 
        'Authorization'
    ],
    credentials: true,
};

export default corsOptions;
