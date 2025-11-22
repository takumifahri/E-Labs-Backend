import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";

const prisma = new PrismaClient();

// Tipe Data State Ruangan di Memori
interface RoomState {
  id: number;
  nama: string;
  status: 'KOSONG' | 'DISETUJUI' | 'SELESAI'; 
  currentBooking: {
    peminjam: string;
    kegiatan: string;
    jam_selesai_ts: number; // Kita simpan TIMESTAMP (angka), bukan Date object biar gak pusing timezone
  } | null;
}

// Variable Global Penyimpan Status (RAM)
let activeRooms: Map<number, RoomState> = new Map();

export const RoomManager = {
  // 1. Inisialisasi: Baca DB pas server nyala
  async init() {
    console.log("🔄 Initializing Room Manager...");
    const allRooms = await prisma.ruangan.findMany();
    
    // Default semua kosong dulu
    allRooms.forEach(r => {
      activeRooms.set(r.id, {
        id: r.id,
        nama: r.nama_ruangan,
        status: 'KOSONG',
        currentBooking: null
      });
    });

    // Cek booking yang aktif SAAT INI juga
    // Kita pakai Timezone server apa adanya, tapi kita convert ke Timestamp angka
    const now = new Date();
    const activeBookings = await prisma.peminjaman_Ruangan.findMany({
      where: {
        // Ambil yang statusnya Aktif atau Baru Selesai (Early Release)
        status: { in: ['DISETUJUI', 'SELESAI'] },
        jam_mulai: { lte: now },
        jam_selesai: { gte: now } // Yang secara jadwal belum habis
      },
      include: { user: true, matkul: true }
    });

    activeBookings.forEach(booking => {
      const room = activeRooms.get(booking.ruangan_id);
      if (room) {
        // Logika penentuan status
        let status: 'DISETUJUI' | 'SELESAI' = 'DISETUJUI';
        if (booking.status === 'SELESAI') status = 'SELESAI';

        // Simpan timestamp selesai (Kalau early release, pake jam realisasi)
        let finishTime = booking.jam_selesai ? new Date(booking.jam_selesai).getTime() : 0;
        
        // Update State
        room.status = status;
        room.currentBooking = {
          peminjam: booking.user.nama,
          kegiatan: booking.kegiatan || booking.matkul?.matkul || "-",
          jam_selesai_ts: finishTime
        };
        activeRooms.set(room.id, room);
      }
    });
    console.log(`✅ Room Manager Ready: ${activeRooms.size} rooms loaded.`);
  },

  // 2. Fungsi buat update status (Dipanggil Controller)
  async updateRoomStatus(io: Server, roomId: number, type: 'EARLY_RELEASE' | 'NEW_BOOKING', data?: any) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (type === 'EARLY_RELEASE') {
      room.status = 'SELESAI';
      // Waktu selesai tetap ikut jadwal asli biar countdown jalan
      // Tapi statusnya berubah jadi SELESAI (Hijau)
    } 
    
    // Simpan balik ke Map
    activeRooms.set(roomId, room);

    // 🔥 BROADCAST KE SEMUA CLIENT
    io.emit('room_update', room);
  },

  // 3. Fungsi buat Frontend minta data awal
  getAllRooms() {
    return Array.from(activeRooms.values());
  }
};