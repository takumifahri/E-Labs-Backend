import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";

const prisma = new PrismaClient();

// --- HELPER: Format Data untuk Frontend ---
const formatRoomData = (room: any, activeBooking: any) => {
    // 1. Cek Status Ruangan Fisik (Prioritas Tertinggi)
    if (room.status === 'DIPERBAIKI') {
        return {
            id: room.id,
            nama: room.nama_ruangan,
            status: 'DIPERBAIKI',
            currentBooking: null
        };
    }

    // 2. Cek Apakah Ada Booking yang "Nempel"?
    if (activeBooking) {
        let statusDisplay = 'DISETUJUI'; // Default MERAH

        // Jika status DB 'SELESAI', berarti user checkout duluan (Fitur Sisa Waktu)
        if (activeBooking.status === 'SELESAI') {
            statusDisplay = 'SELESAI'; // Frontend akan render ini jadi HIJAU
        } else if (activeBooking.status === 'DIAJUKAN') {
            statusDisplay = 'DISETUJUI'; // Anggap merah biar aman
        }

        return {
            id: room.id,
            nama: room.nama_ruangan,
            status: statusDisplay,
            currentBooking: {
                peminjam: activeBooking.user?.nama || "Unknown",
                kegiatan: activeBooking.kegiatan || activeBooking.matkul?.matkul || "-",
                jam_selesai_ts: activeBooking.jam_selesai ? new Date(activeBooking.jam_selesai).getTime() : 0
            }
        };
    }

    // 3. Jika Tidak Ada Booking & Tidak Rusak = KOSONG
    return {
        id: room.id,
        nama: room.nama_ruangan,
        status: 'KOSONG',
        currentBooking: null
    };
};

export const RoomManager = {
    // Init kosong saja, karena kita pakai Direct Query
    async init() {
        console.log("✅ RoomManager (Direct DB) Ready");
    },

    // --- FUNGSI UTAMA: GET ALL ROOMS ---
    async getAllRooms() {
        const now = new Date();

        // Query Ruangan + Booking yang RELEVAN saja
        const rooms = await prisma.ruangan.findMany({
            orderBy: { id: 'asc' }, // Urutkan ID 1, 2, 3...
            include: {
                peminjaman_ruangans: {
                    where: {
                        status: { in: ['DISETUJUI', 'BERLANGSUNG', 'DIAJUKAN', 'SELESAI'] },
                        
                        // DAN
                        // 2. Waktunya Masuk Range Sekarang
                        AND: [
                            { jam_mulai: { lte: now } }, // Udah mulai
                            { jam_selesai: { gt: now } }  // Belum habis waktunya
                        ]
                    },
                    // Ambil yang paling baru di-update (mengatasi tumpang tindih)
                    orderBy: { updatedAt: 'desc' }, 
                    take: 1, 
                    include: { user: true, matkul: true }
                }
            }
        });

        // Mapping hasil DB ke format JSON
        return rooms.map(room => {
            const activeBooking = room.peminjaman_ruangans[0] || null;
            return formatRoomData(room, activeBooking);
        });
    },

    // --- UPDATE STATUS UNTUK SOCKET ---
    async updateRoomStatus(io: Server, roomId: number, type: string) {
        const now = new Date();
        
        // Query 1 Ruangan saja (Logic sama persis dengan getAllRooms)
        const room = await prisma.ruangan.findUnique({
            where: { id: roomId },
            include: {
                peminjaman_ruangans: {
                    where: {
                        status: { in: ['DISETUJUI', 'BERLANGSUNG', 'DIAJUKAN', 'SELESAI'] },
                        AND: [
                            { jam_mulai: { lte: now } },
                            { jam_selesai: { gt: now } }
                        ]
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    include: { user: true, matkul: true }
                }
            }
        });

        if (!room) return;

        const activeBooking = room.peminjaman_ruangans[0] || null;
        const formattedData = formatRoomData(room, activeBooking);

        // Kirim sinyal ke Frontend
        io.emit('room_update', formattedData);
    }
};