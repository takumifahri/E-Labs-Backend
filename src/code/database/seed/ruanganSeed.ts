import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting ruangan seed...");

  const ruanganData = [
    {
      gedung: "Gedung A",
      nama_ruangan: "Ruang Kuliah 101",
      kode_ruangan: "A101"
    },
    {
      gedung: "Gedung A",
      nama_ruangan: "Ruang Kuliah 102",
      kode_ruangan: "A102"
    },
    {
      gedung: "Gedung B",
      nama_ruangan: "Laboratorium Komputer 1",
      kode_ruangan: "B201"
    },
    {
      gedung: "Gedung B",
      nama_ruangan: "Laboratorium Komputer 2",
      kode_ruangan: "B202"
    },
    {
      gedung: "Gedung C",
      nama_ruangan: "Ruang Seminar",
      kode_ruangan: "C301"
    },
    {
      gedung: "Gedung C",
      nama_ruangan: "Ruang Rapat",
      kode_ruangan: "C302"
    },
    {
      gedung: "Gedung D",
      nama_ruangan: "Auditorium",
      kode_ruangan: "D401"
    },
    {
      gedung: "Gedung A",
      nama_ruangan: "Ruang Kuliah 103",
      kode_ruangan: "A103"
    },
    {
      gedung: "Gedung B",
      nama_ruangan: "Laboratorium Fisika",
      kode_ruangan: "B203"
    },
    {
      gedung: "Gedung C",
      nama_ruangan: "Ruang Diskusi",
      kode_ruangan: "C303"
    }
  ];

  for (const ruangan of ruanganData) {
    const result = await prisma.ruangan.upsert({
      where: { kode_ruangan: ruangan.kode_ruangan },
      update: {
        gedung: ruangan.gedung,
        nama_ruangan: ruangan.nama_ruangan,
        updatedAt: new Date()
      },
      create: {
        ...ruangan,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Ruangan: ${ruangan.nama_ruangan} (${ruangan.kode_ruangan})`);
  }

  console.log("✅ Ruangan seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Ruangan seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });