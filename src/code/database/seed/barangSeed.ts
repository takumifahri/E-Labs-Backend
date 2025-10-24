import { PrismaClient, KondisiBarang, StatusBarang } from "@prisma/client";

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
      kondisi: "BAIK",
      jumlah: 10,
      status: "TERSEDIA",
      foto_barang: "barang_Dell_1761289834387_137645496.webp"
    },
    {
      kategori: "Elektronik",
      kode_barang: "LP002",
      nama_barang: "Laptop HP Pavilion",
      merek: "HP",
      kondisi: "BAIK",
      jumlah: 10,
      status: "TERSEDIA",
      foto_barang: "barang_laptop_hp_1761290460122_971914718.jpg"
    },
    {
      kategori: "Proyektor",
      kode_barang: "PR001",
      nama_barang: "Proyektor Epson EB-X41",
      merek: "Epson",
      kondisi: "BAIK",
      jumlah: 5,
      status: "TERSEDIA",
      foto_barang: "barang_epson_1761290765146_71280289.jpg"
    },
    {
      kategori: "Proyektor",
      kode_barang: "PR002",
      nama_barang: "Proyektor BenQ MX550",
      merek: "BenQ",
      kondisi: "BAIK",
      jumlah: 5,
      status: "DIPINJAM",
      foto_barang: "barang_benq_1761293885517_590164149.jpg"
    },
    {
      kategori: "AC & Pendingin",
      kode_barang: "AC001",
      nama_barang: "AC Sharp 1.5 PK",
      merek: "Sharp",
      kondisi: "BAIK",
      jumlah: 5,
      status: "TERSEDIA",
      foto_barang: "barang_asus_1761293948035_198042651.webp"
    },
    {
      kategori: "AC & Pendingin",
      kode_barang: "AC002",
      nama_barang: "AC Daikin 2 PK",
      merek: "Daikin",
      jumlah: 3,
      kondisi: "RUSAK_RINGAN",
      status: "TERSEDIA",
      foto_barang: "barang_sharp_1761294089743_211794803.jpg"
    },
    {
      kategori: "Furniture",
      kode_barang: "MJ001",
      nama_barang: "Meja Kantor Kayu",
      merek: "Chitose",
      kondisi: "BAIK",
      jumlah: 5,
      status: "TERSEDIA",
      foto_barang: "barang_sharp_1761294089743_211794803.jpg"
    },
    {
      kategori: "Furniture",
      kode_barang: "KS001",
      nama_barang: "Kursi Kantor Ergonomis",
      merek: "Indachi",
      kondisi: "BAIK",
      jumlah: 5,
      status: "TERSEDIA",
      foto_barang: "barang_epson_1761292256696_155287876.jpg"
    },
    {
      kategori: "Alat Tulis & Papan",
      kode_barang: "WB001",
      nama_barang: "Whiteboard 120x90",
      merek: "Sakana",
      jumlah: 4,
      kondisi: "BAIK",
      status: "TERSEDIA",
      foto_barang: "barang_desk_1761302697064_473273633.jpg"
    },
    {
      kategori: "Elektronik",
      kode_barang: "PC001",
      nama_barang: "barang_ergonomis_1761302741623_190635702.webp",
      merek: "Asus",
      jumlah: 4,
      kondisi: "BAIK",
      status: "DIPINJAM",
      foto_barang: "barang_board_1761302795670_373554240.jpg"
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
          kondisi: item.kondisi as KondisiBarang,
          jumlah: item.jumlah,
          status: item.status as StatusBarang,
          foto_barang: item.foto_barang // <-- tambahkan ini
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