import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting barang seed...");

  // Check if data already exists
  const existingKategori = await prisma.kategori_Barang.count();
  const existingBarang = await prisma.barang.count();

  if (existingKategori > 0 && existingBarang > 0) {
    console.log("⏭️  Barang seed data already exists, skipping...");
    return;
  }

  // Upsert categories
  const categories = [
    { nama_kategori: "Elektronik" },
    { nama_kategori: "Proyektor" },
    { nama_kategori: "AC & Pendingin" },
    { nama_kategori: "Furniture" },
    { nama_kategori: "Alat Tulis & Papan" }
  ];

  const createdCategories: { [key: string]: any } = {};
  for (const category of categories) {
    const existingCategory = await prisma.kategori_Barang.findFirst({
      where: { nama_kategori: category.nama_kategori }
    });
    
    const result = existingCategory || await prisma.kategori_Barang.create({
      data: category
    });
    
    createdCategories[category.nama_kategori] = result;
    console.log(`✅ Category: ${category.nama_kategori}`);
  }

  // Check and create barang
  const barangData = [
    {
      kategori: "Elektronik",
      kode_barang: "LP001",
      nama_barang: "Laptop Dell Inspiron 15",
      merek: "Dell",
      kondisi: "Baik",
      status: "Tersedia"
    },
    {
      kategori: "Elektronik",
      kode_barang: "LP002",
      nama_barang: "Laptop HP Pavilion",
      merek: "HP",
      kondisi: "Baik",
      status: "Tersedia"
    },
    {
      kategori: "Proyektor",
      kode_barang: "PR001",
      nama_barang: "Proyektor Epson EB-X41",
      merek: "Epson",
      kondisi: "Sangat Baik",
      status: "Tersedia"
    },
    {
      kategori: "Proyektor",
      kode_barang: "PR002",
      nama_barang: "Proyektor BenQ MX550",
      merek: "BenQ",
      kondisi: "Baik",
      status: "Dipinjam"
    },
    {
      kategori: "AC & Pendingin",
      kode_barang: "AC001",
      nama_barang: "AC Sharp 1.5 PK",
      merek: "Sharp",
      kondisi: "Baik",
      status: "Tersedia"
    },
    {
      kategori: "AC & Pendingin",
      kode_barang: "AC002",
      nama_barang: "AC Daikin 2 PK",
      merek: "Daikin",
      kondisi: "Rusak Ringan",
      status: "Perbaikan"
    },
    {
      kategori: "Furniture",
      kode_barang: "MJ001",
      nama_barang: "Meja Kantor Kayu",
      merek: "Chitose",
      kondisi: "Baik",
      status: "Tersedia"
    },
    {
      kategori: "Furniture",
      kode_barang: "KS001",
      nama_barang: "Kursi Kantor Ergonomis",
      merek: "Indachi",
      kondisi: "Sangat Baik",
      status: "Tersedia"
    },
    {
      kategori: "Alat Tulis & Papan",
      kode_barang: "WB001",
      nama_barang: "Whiteboard 120x90",
      merek: "Sakana",
      kondisi: "Baik",
      status: "Tersedia"
    },
    {
      kategori: "Elektronik",
      kode_barang: "PC001",
      nama_barang: "PC Desktop Asus",
      merek: "Asus",
      kondisi: "Baik",
      status: "Dipinjam"
    }
  ];

  for (const item of barangData) {
    const existingBarang = await prisma.barang.findUnique({
      where: { kode_barang: item.kode_barang }
    });

    if (!existingBarang) {
      await prisma.barang.create({
        data: {
          kategori_id: createdCategories[item.kategori].id,
          kode_barang: item.kode_barang,
          nama_barang: item.nama_barang,
          merek: item.merek,
          kondisi: item.kondisi,
          status: item.status
        }
      });
      console.log(`✅ Created barang: ${item.nama_barang}`);
    } else {
      console.log(`⏭️  Barang already exists: ${item.nama_barang}`);
    }
  }

  console.log("✅ Barang seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Barang seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });