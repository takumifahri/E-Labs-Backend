import { PrismaClient } from "@prisma/client";
import { StatusPeminjamanRuangan } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting jadwal matkul with ruangan seed...");

  // Get all users (mahasiswa only for this seed)
  const mahasiswa = await prisma.user.findMany({
    where: { roleId: 1 }, // mahasiswa
    select: { id: true, nama: true, NIM: true, prodiId: true, semester: true }
  });

  // Get all ruangan
  const ruangans = await prisma.ruangan.findMany({
    select: { id: true, nama_ruangan: true, kode_ruangan: true }
  });

  // Get all matkul
  const matkuls = await prisma.master_Matkul.findMany({
    select: { id: true, matkul: true, semester: true, prodi_id: true }
  });

  if (mahasiswa.length === 0 || ruangans.length === 0 || matkuls.length === 0) {
    console.log("❌ No mahasiswa, ruangan, or matkul found. Please run other seeds first.");
    return;
  }

  console.log(`Found: ${mahasiswa.length} mahasiswa, ${ruangans.length} ruangan, ${matkuls.length} matkul`);

  // Generate schedule for 4 weeks (current + 3 future weeks)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Start from Monday of current week
  
  // Time slots for daily schedules (3 slots per day, 1 hour each)
  const timeSlots = [
    { start: 8, end: 9 },   // 08:00 - 09:00
    { start: 10, end: 11 }, // 10:00 - 11:00  
    { start: 14, end: 15 }  // 14:00 - 15:00
  ];

  const kegiatanOptions = [
    "Kuliah Reguler",
    "Praktikum Lab",
    "Tutorial Kelompok",
    "Diskusi Mata Kuliah",
    "Presentasi Tugas",
    "Review Materi",
    "Quiz & Ujian",
    "Workshop",
    "Seminar Kelas"
  ];

  // Helper function to get random item from array
  const getRandomItem = (array: any[]) => {
    return array[Math.floor(Math.random() * array.length)];
  };

  // Helper function to match matkul with mahasiswa
  const getMatchingMatkul = (mahasiswaData: any) => {
    const matchingMatkuls = matkuls.filter(m => 
      m.prodi_id === mahasiswaData.prodiId && 
      m.semester === mahasiswaData.semester
    );
    return matchingMatkuls.length > 0 ? getRandomItem(matchingMatkuls) : getRandomItem(matkuls);
  };

  let createdCount = 0;

  // Generate for 4 weeks
  for (let week = 0; week < 4; week++) {
    console.log(`\n📅 Generating week ${week + 1}...`);

    // Monday to Friday (5 working days)
    for (let day = 0; day < 5; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + day);
      
      console.log(`  📆 Processing ${currentDate.toISOString().split('T')[0]}...`);

      // 3 time slots per day
      for (const timeSlot of timeSlots) {
        // Select random ruangan
        const ruangan = getRandomItem(ruangans);
        
        // Select random mahasiswa
        const mahasiswaData = getRandomItem(mahasiswa);
        
        // Get matching matkul for this mahasiswa
        const matkul = getMatchingMatkul(mahasiswaData);

        // Create datetime objects
        const jamMulai = new Date(currentDate);
        jamMulai.setHours(timeSlot.start, 0, 0, 0);
        
        const jamSelesai = new Date(currentDate);
        jamSelesai.setHours(timeSlot.end, 0, 0, 0);

        // Random kegiatan
        const kegiatan = `${getRandomItem(kegiatanOptions)} - ${matkul.matkul}`;

        // Random status (mostly DISETUJUI for active schedules)
        const statusOptions = [
          StatusPeminjamanRuangan.DISETUJUI,
          StatusPeminjamanRuangan.DISETUJUI,
          StatusPeminjamanRuangan.DISETUJUI,
          StatusPeminjamanRuangan.BERLANGSUNG,
          StatusPeminjamanRuangan.SELESAI
        ];
        const status = getRandomItem(statusOptions);

        // Random accepted_by (pengelola or superadmin)
        const pengelolaUsers = await prisma.user.findMany({
          where: { 
            roleId: { in: [3, 4] } // pengelola or superadmin
          },
          select: { id: true }
        });
        const acceptedBy = pengelolaUsers.length > 0 ? getRandomItem(pengelolaUsers).id : null;

        try {
          // Check if similar schedule already exists (avoid duplicates)
          const existingSchedule = await prisma.peminjaman_Ruangan.findFirst({
            where: {
              ruangan_id: ruangan.id,
              tanggal: {
                gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
                lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
              },
              jam_mulai: jamMulai,
              jam_selesai: jamSelesai
            }
          });

          if (existingSchedule) {
            console.log(`    ⏭️  Schedule already exists for ${ruangan.kode_ruangan} at ${timeSlot.start}:00`);
            continue;
          }

          const peminjaman = await prisma.peminjaman_Ruangan.create({
            data: {
              ruangan_id: ruangan.id,
              user_id: mahasiswaData.id,
              matkul_id: matkul.id,
              tanggal: currentDate,
              jam_mulai: jamMulai,
              jam_selesai: jamSelesai,
              status: status,
              kegiatan: kegiatan,
              isLoop: true, // Set to true for recurring schedules
              accepted_by_id: acceptedBy,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });

          createdCount++;
          console.log(`    ✅ Created: ${ruangan.kode_ruangan} | ${mahasiswaData.nama} | ${matkul.matkul} | ${timeSlot.start}:00-${timeSlot.end}:00`);

        } catch (error) {
          console.log(`    ❌ Error creating schedule: ${error}`);
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  console.log(`\n🎉 Jadwal matkul with ruangan seed completed! Created ${createdCount} schedules.`);
  
  // Display summary
  const summary = await prisma.peminjaman_Ruangan.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { isLoop: true }
  });

  console.log("\n📊 Summary by status:");
  summary.forEach(item => {
    console.log(`  ${item.status}: ${item._count.id} schedules`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Jadwal matkul seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });