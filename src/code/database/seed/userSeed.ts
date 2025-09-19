import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { HashPassword } from "../../utils/hash";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting user seed...");

  // Upsert roles (create or update if exists)
  const roles = [
    { id: 1, nama_role: "mahasiswa", deskripsi: "Role untuk mahasiswa" },
    { id: 2, nama_role: "dosen", deskripsi: "Role untuk dosen" },
    { id: 3, nama_role: "pengelola", deskripsi: "Role untuk pengelola" },
    { id: 4, nama_role: "superadmin", deskripsi: "Role untuk superadmin" }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        nama_role: role.nama_role,
        deskripsi: role.deskripsi,
        updatedAt: new Date()
      },
      create: {
        id: role.id,
        nama_role: role.nama_role,
        deskripsi: role.deskripsi,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }
  // Upsert prodi (create or update if exists)
  const prodi = [
    { id: 1, nama_prodi: "Komunikasi Digital dan Media", kode_prodi: "KMN" },
    { id: 2, nama_prodi: "Ekowisata", kode_prodi: "EKW" },
    { id: 3, nama_prodi: "Teknologi Rekayasa Perangkat Lunak", kode_prodi: "TRPL" },
    { id: 4, nama_prodi: "Teknologi Rekayasa Komputer", kode_prodi: "TRK" },
    { id: 5, nama_prodi: "Supervisor Jaminan Mutu Pangan", kode_prodi: "SJMP" },
    { id: 6, nama_prodi: "Manajemen Industri Jasa Makanan dan Gizi", kode_prodi: "GZI" },
    { id: 7, nama_prodi: "Teknologi dan Manajemen Pembenihan Ikan", kode_prodi: "IKN" },
    { id: 8, nama_prodi: "Teknologi dan Manajemen Ternak", kode_prodi: "TNK" },
    { id: 9, nama_prodi: "Manajemen Agribisnis", kode_prodi: "MAB" },
    { id: 10, nama_prodi: "Manajemen Industri", kode_prodi: "MNI" },
    { id: 11, nama_prodi: "Analisis Kimia", kode_prodi: "ANKIM" },
    { id: 12, nama_prodi: "Teknik dan Manajemen Lingkungan", kode_prodi: "LNK" },
    { id: 13, nama_prodi: "Akuntansi", kode_prodi: "AKN" },
    { id: 14, nama_prodi: "Paramedik Veteriner", kode_prodi: "PVT" },
    { id: 15, nama_prodi: "Teknologi dan Manajemen Produksi Perkebunan", kode_prodi: "TMP" },
    { id: 16, nama_prodi: "Teknologi Produksi dan Pengembangan Masyarakat Pertanian", kode_prodi: "TIB" },
  ];
  for (const pd of prodi) {
    await prisma.prodi.upsert({
      where: { id: pd.id },
      update: {
        nama_prodi: pd.nama_prodi,
        kode_prodi: pd.kode_prodi,
        updatedAt: new Date()
      },
      create: {
        id: pd.id,
        nama_prodi: pd.nama_prodi,
        kode_prodi: pd.kode_prodi,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }

  console.log("✅ Prodi seed completed!");
  // Check and create users only if they don't exist
  const users = [
    {
      uniqueId: "MHS-001",
      email: "user1@example.com",
      nama: "User One",
      password: "password1",
      roleId: 1,
      prodiId: 1,
      NIM: "123456789",
      semester: "5",
    },
    {
      uniqueId: "DSN-001",
      email: "user2@example.com",
      nama: "User Two",
      password: "password2",
      roleId: 2,
      NIP: "987654321",
    },
    {
      uniqueId: "PGL-001",
      email: "user3@example.com",
      nama: "User Three",
      password: "password3",
      NIP: "192837465",
      roleId: 3,
    },
    {
      uniqueId: "ADM-001",
      email: "user4@example.com",
      nama: "User Four",
      password: "password4",
      roleId: 4,
    },
    {
      uniqueId: "MHS-002",
      email: "user5@example.com",
      nama: "User Five",
      password: "password5",
      roleId: 1,
      prodiId: 2,
      NIM: "123456790",
      semester: "3",
    }
  ];

  for (const userData of users) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userData.email },
          { uniqueId: userData.uniqueId }
        ]
      }
    });

    if (!existingUser) {
      const hashedPassword = await HashPassword(userData.password);
      await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
      console.log(`✅ Created user: ${userData.nama}`);
    } else {
      console.log(`⏭️  User already exists: ${userData.nama}`);
    }
  }

  console.log("✅ User seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ User seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });