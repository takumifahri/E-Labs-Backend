import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";

const prisma = new PrismaClient();

// Tipe Data State Ruangan di Memori
interface RoomState {
  id: number;
  nama: string;
  status: 'KOSONG' | 'DISETUJUI' | 'SELESAI' | 'DIPERBAIKI'; // Tambahkan DIPERBAIKI jika perlu
  currentBooking: {
    peminjam: string;
    kegiatan: string;
    jam_selesai_ts: number;
  } | null;
}

// Variable Global Penyimpan Status (RAM)
let activeRooms: Map<number, RoomState> = new Map();

export const RoomManager = {
  // 1. Inisialisasi
  async init() {
    const allRooms = await prisma.ruangan.findMany();
    
    // --- [FIX STEP 1] Reset Awal yang Aman ---
    allRooms.forEach(r => {
      // Cek apakah status dari DB itu status "Booking" (DIPAKAI/SELESAI)?
      // Jika iya, kita paksa jadi KOSONG dulu. Biarkan query 'activeBookings' yang menentukan nanti.
      // Kita hanya percaya status "DIPERBAIKI" atau "RUSAK" dari tabel Ruangan langsung.
      
      let safeStatus: any = 'KOSONG';
      if (r.status === 'DIPERBAIKI') safeStatus = 'DIPERBAIKI'; 

      activeRooms.set(r.id, {
        id: r.id,
        nama: r.nama_ruangan,
        status: safeStatus, // Default ke KOSONG biar gak ada status 'SELESAI' tanpa data
        currentBooking: null
      });
    });

    const now = new Date();
    
    // --- [FIX STEP 2] Query Booking ---
    const activeBookings = await prisma.peminjaman_Ruangan.findMany({
      where: {
        // Ambil yang statusnya DISETUJUI, BERLANGSUNG, atau SELESAI
        status: { in: ['DISETUJUI', 'BERLANGSUNG', 'SELESAI'] }, 
        
        // LOGIKA PENTING:
        // Ambil booking yang jadwal aslinya BELUM selesai.
        // Walaupun user sudah 'Checkout' (Status SELESAI), kalau jam_selesai masih nanti,
        // kita tetap ambil datanya untuk fitur "Sisa Waktu".
        jam_selesai: { gte: now } 
      },
      include: { user: true, matkul: true }
    });

    activeBookings.forEach(booking => {
      const room = activeRooms.get(booking.ruangan_id);
      
      // Safety check: Pastikan room ada dan bukan lagi perbaikan
      if (room && room.status !== 'DIPERBAIKI') {
        
        // Mapping Status DB ke Status Frontend
        let status: 'DISETUJUI' | 'SELESAI' = 'DISETUJUI';
        if (booking.status === 'SELESAI') status = 'SELESAI';

        let finishTime = booking.jam_selesai ? new Date(booking.jam_selesai).getTime() : 0;
        
        // Update State (Hanya di sini kita berani set status jadi SELESAI/DISETUJUI)
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

  // 2. Fungsi Update (Dengan Safety Data)
  async updateRoomStatus(io: Server, roomId: number, type: 'EARLY_RELEASE' | 'NEW_BOOKING', data?: any) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (type === 'EARLY_RELEASE') {
      room.status = 'SELESAI';
      // [FIX OPTIONAL] Jika data dikirim dari controller, update currentBooking
      // untuk memastikan timestamp terbaru atau mencegah data null.
      if (data && data.jam_selesai) {
         if (room.currentBooking) {
            room.currentBooking.jam_selesai_ts = new Date(data.jam_selesai).getTime();
         }
      }
    } 
    // Handle tipe lain seperti NEW_BOOKING disini...
    
    activeRooms.set(roomId, room);
    io.emit('room_update', room);
  },

  getAllRooms() {
    return Array.from(activeRooms.values());
  }
};