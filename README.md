# Backend Manajemen Proyek Teknologi Informasi

Backend ini dibangun menggunakan **Node.js**, **Express**, dan **TypeScript** dengan pendekatan Clean Architecture. Database utama menggunakan **PostgreSQL** dan ORM **Prisma**.

## Fitur Utama
- Struktur folder clean architecture (domain, usecase, infrastructure, controller, routes, dll)
- Otentikasi JWT
- Seeder dan migrasi database dengan Prisma
- Konfigurasi environment menggunakan dotenv
- Middleware CORS dan custom

## Instalasi

1. **Clone repository**
   ```
   git clone <repo-url>
   cd backend
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Konfigurasi environment**
   - Buat file `.env` di root project
   - Contoh isi:
     ```
     DATABASE_URL="postgresql://user:password@localhost:5432/nama_database"
     PROJECT_URL_SUPABASE="https://your-project.supabase.co"
     API_KEY_SUPABASE="your-api-key"
     ```

4. **Generate Prisma Client**
   ```
   npm run generate
   ```

5. **Migrasi dan seed database**
   ```
   npm run migrate
   npm run seed
   ```

6. **Jalankan server**
   ```
   npm run dev
   ```
## Struktur Folder

```
src
│
├── cmd/                  # Entry point server & app
│
├── code/
│   ├── config/           # Konfigurasi aplikasi (env, cors, dll)
│   ├── controller/       # Controller HTTP (API & Auth)
│   ├── database/         # Koneksi DB, Supabase, seed
│   ├── middleware/       # Middleware custom (auth, error, dll)
│   ├── models/           # Tipe data & DTO
│   ├── routes/           # Routing aplikasi (grouping, admin, auth)
│   └── utils/            # Helper, hash, jwt, validator
│
└── generated/
    └── prisma/           # Prisma client & engine
```

## Script Penting

- `npm run dev` — Jalankan server development
- `npm run build` — Build TypeScript
- `npm run migrate` — Migrasi database
- `npm run migrate:fresh` — Reset dan migrasi ulang database
- `npm run seed` — Jalankan seeder
- `npm run generate` — Generate Prisma Client

## Kontribusi

Silakan buat pull request atau issue jika ingin berkontribusi atau menemukan bug.

---

**Solusi Trimitra Persada Backend**  
Dibangun dengan Clean Architecture & TypeScript