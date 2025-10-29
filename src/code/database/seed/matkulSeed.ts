import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Matkul list per semester (5 per semester, 14 semester)
const matkulPerSemester = [
    ["Kalkulus 1", "Pengantar Teknologi Informasi", "Logika Matematika", "Bahasa Inggris Akademik", "Pemrograman Dasar"],
    ["Kalkulus 2", "Struktur Data", "Statistika Dasar", "Sistem Digital", "Komunikasi Efektif"],
    ["Matematika Diskrit", "Pemrograman Berorientasi Objek", "Basis Data", "Jaringan Komputer", "Kewirausahaan"],
    ["Algoritma dan Kompleksitas", "Pemrosesan Citra Digital", "Sistem Operasi", "Analisis Data dan Visualisasi", "Manajemen Proyek TI"],
    ["Kecerdasan Buatan", "Keamanan Informasi", "Pemrograman Web", "Interaksi Manusia dan Komputer", "Etika Profesi"],
    ["Machine Learning Dasar", "Cloud Computing", "Mobile Programming", "Sistem Informasi Geografis", "Teknologi Multimedia"],
    ["Big Data", "Internet of Things", "Manajemen Basis Data", "Pemrograman Game", "Pengembangan Startup"],
    ["Deep Learning", "Blockchain", "Analisis Jaringan Sosial", "Sistem Enterprise", "Manajemen Risiko TI"],
    ["Natural Language Processing", "Augmented Reality", "Cyber Security", "Manajemen Layanan TI", "Teknologi Finansial"],
    ["Computer Vision", "Data Mining", "Pengolahan Sinyal Digital", "Manajemen Inovasi", "Teknologi Cloud Lanjut"],
    ["Rekayasa Perangkat Lunak", "Sistem Pendukung Keputusan", "Manajemen Sumber Daya TI", "Pengembangan Produk Digital", "Teknologi Web Lanjut"],
    ["Pengujian Perangkat Lunak", "Manajemen Proses Bisnis", "Teknologi Mobile Lanjut", "Analisis Bisnis Digital", "Sistem Informasi Manajemen"],
    ["Manajemen Proyek Lanjut", "Teknologi Kecerdasan Buatan Lanjut", "Pengembangan Sistem Terdistribusi", "Manajemen Data Lanjut", "Teknologi Multimedia Lanjut"],
    ["Seminar Tugas Akhir", "Praktikum Industri", "Penulisan Ilmiah", "Pengembangan Karir", "Tugas Akhir"]
];

async function seedMatkul() {
    // Ambil semua prodi
    const allProdi = await prisma.masterProdi.findMany();

    for (const prodi of allProdi) {
        for (let semester = 1; semester <= 14; semester++) {
            for (let i = 0; i < 5; i++) {
                const matkulName = matkulPerSemester[semester - 1][i];
                // Find existing matkul by prodi_id, matkul, and semester
                const existingMatkul = await prisma.master_Matkul.findFirst({
                    where: {
                        prodi_id: prodi.id,
                        matkul: matkulName,
                        semester: semester
                    }
                });

                if (existingMatkul) {
                    await prisma.master_Matkul.update({
                        where: { id: existingMatkul.id },
                        data: {
                            matkul: matkulName,
                            semester: semester,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await prisma.master_Matkul.create({
                        data: {
                            prodi_id: prodi.id,
                            matkul: matkulName,
                            semester: semester,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    });
                }
            }
        }
        console.log(`✅ Seeded matkul for prodi: ${prodi.nama_prodi}`);
    }
    console.log("✅ Master_Matkul seed completed!");
}

seedMatkul()
    .catch((e) => {
        console.error("❌ Master_Matkul seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
