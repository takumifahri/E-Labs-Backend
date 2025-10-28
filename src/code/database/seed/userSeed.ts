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
    await prisma.masterProdi.upsert({
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
    // 15 Mahasiswa (roleId: 1) - password = NIM with first letter lowercased
    {
      uniqueId: "MHS-001",
      email: "mhs1@example.com",
      nama: "Mahasiswa Satu",
      password: "j0403231001",
      roleId: 1,
      prodiId: 1,
      NIM: "J0403231001",
      semester: 5,
    },
    {
      uniqueId: "MHS-002",
      email: "mhs2@example.com",
      nama: "Mahasiswa Dua",
      password: "k0403231002",
      roleId: 1,
      prodiId: 2,
      NIM: "K0403231002",
      semester: 3,
    },
    {
      uniqueId: "MHS-003",
      email: "mhs3@example.com",
      nama: "Mahasiswa Tiga",
      password: "l0403231003",
      roleId: 1,
      prodiId: 3,
      NIM: "L0403231003",
      semester: 7,
    },
    {
      uniqueId: "MHS-004",
      email: "mhs4@example.com",
      nama: "Mahasiswa Empat",
      password: "m0403231004",
      roleId: 1,
      prodiId: 4,
      NIM: "M0403231004",
      semester: 2,
    },
    {
      uniqueId: "MHS-005",
      email: "mhs5@example.com",
      nama: "Mahasiswa Lima",
      password: "n0403231005",
      roleId: 1,
      prodiId: 5,
      NIM: "N0403231005",
      semester: 6,
    },
    {
      uniqueId: "MHS-006",
      email: "mhs6@example.com",
      nama: "Mahasiswa Enam",
      password: "o0403231006",
      roleId: 1,
      prodiId: 6,
      NIM: "O0403231006",
      semester: 4,
    },
    {
      uniqueId: "MHS-007",
      email: "mhs7@example.com",
      nama: "Mahasiswa Tujuh",
      password: "p0403231007",
      roleId: 1,
      prodiId: 7,
      NIM: "P0403231007",
      semester: 1,
    },
    {
      uniqueId: "MHS-008",
      email: "mhs8@example.com",
      nama: "Mahasiswa Delapan",
      password: "q0403231008",
      roleId: 1,
      prodiId: 8,
      NIM: "Q0403231008",
      semester: 8,
    },
    {
      uniqueId: "MHS-009",
      email: "mhs9@example.com",
      nama: "Mahasiswa Sembilan",
      password: "r0403231009",
      roleId: 1,
      prodiId: 9,
      NIM: "R0403231009",
      semester: 5,
    },
    {
      uniqueId: "MHS-010",
      email: "mhs10@example.com",
      nama: "Mahasiswa Sepuluh",
      password: "s0403231010",
      roleId: 1,
      prodiId: 10,
      NIM: "S0403231010",
      semester: 3,
    },
    {
      uniqueId: "MHS-011",
      email: "mhs11@example.com",
      nama: "Mahasiswa Sebelas",
      password: "t0403231011",
      roleId: 1,
      prodiId: 11,
      NIM: "T0403231011",
      semester: 2,
    },
    {
      uniqueId: "MHS-012",
      email: "mhs12@example.com",
      nama: "Mahasiswa Dua Belas",
      password: "u0403231012",
      roleId: 1,
      prodiId: 12,
      NIM: "U0403231012",
      semester: 6,
    },
    {
      uniqueId: "MHS-013",
      email: "mhs13@example.com",
      nama: "Mahasiswa Tiga Belas",
      password: "v0403231013",
      roleId: 1,
      prodiId: 13,
      NIM: "V0403231013",
      semester: 4,
    },
    {
      uniqueId: "MHS-014",
      email: "mhs14@example.com",
      nama: "Mahasiswa Empat Belas",
      password: "w0403231014",
      roleId: 1,
      prodiId: 14,
      NIM: "W0403231014",
      semester: 7,
    },
    {
      uniqueId: "MHS-015",
      email: "mhs15@example.com",
      nama: "Mahasiswa Lima Belas",
      password: "x0403231015",
      roleId: 1,
      prodiId: 15,
      NIM: "X0403231015",
      semester: 1,
    },

    // 3 Dosen (roleId: 2) - have NIP
    {
      uniqueId: "DSN-001",
      email: "dosen1@example.com",
      nama: "Dosen Satu",
      password: "dosenpass1",
      roleId: 2,
      NIP: "1987654321",
    },
    {
      uniqueId: "DSN-002",
      email: "dosen2@example.com",
      nama: "Dosen Dua",
      password: "dosenpass2",
      roleId: 2,
      NIP: "1976543210",
    },
    {
      uniqueId: "DSN-003",
      email: "dosen3@example.com",
      nama: "Dosen Tiga",
      password: "dosenpass3",
      roleId: 2,
      NIP: "1965432109",
    },

    // 1 Pengelola (roleId: 3) - has NIP
    {
      uniqueId: "PGL-001",
      email: "pengelola@example.com",
      nama: "Pengelola Satu",
      password: "pengelolapass",
      roleId: 3,
      NIP: "1954321098",
    },

    // 1 Superadmin (roleId: 4) - no NIM, no NIP
    {
      uniqueId: "ADM-001",
      email: "admin@example.com",
      nama: "Super Admin",
      password: "superadminpass",
      roleId: 4,
    },
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