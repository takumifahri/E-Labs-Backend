# Backend Manajemen Proyek Teknologi Informasi

Backend ini dibangun menggunakan **Node.js**, **Express**, dan **TypeScript** dengan pendekatan Clean Architecture. Database utama menggunakan **PostgreSQL** dan ORM **Prisma**.

## Fitur Utama
- Struktur folder clean architecture (domain, usecase, infrastructure, controller, routes, dll)
- Otentikasi JWT
- Seeder dan migrasi database dengan Prisma
- Konfigurasi environment menggunakan dotenv
- Middleware CORS dan custom
- CRUD Logic User Management, Ruangan Master Manajemen
- Auth, Profile

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

## Glosarium

| Istilah | Deskripsi |
|---------|-----------|
| **Clean Architecture** | Arsitektur perangkat lunak yang memisahkan concerns dan membuat kode lebih maintainable |
| **Controller** | Layer yang menangani HTTP request dan response |
| **DTO (Data Transfer Object)** | Objek untuk transfer data antar layer aplikasi |
| **JWT (JSON Web Token)** | Standard untuk autentikasi berbasis token |
| **Middleware** | Fungsi yang dijalankan di antara request dan response |
| **Migration** | Script untuk mengubah struktur database |
| **ORM (Object Relational Mapping)** | Tool untuk mapping database ke objek |
| **Prisma** | ORM modern untuk Node.js dan TypeScript |
| **Seeder** | Script untuk mengisi database dengan data awal |
| **Supabase** | Platform Backend-as-a-Service dengan PostgreSQL |
| **TypeScript** | Superset JavaScript dengan static typing |  

## Kontribusi

Silakan buat pull request atau issue jika ingin berkontribusi atau menemukan bug.

---

**Backend E-Labs+**  
Dibangun dengan Clean Architecture & TypeScript
