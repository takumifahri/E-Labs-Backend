import cron from 'node-cron';
import { PrismaClient, StatusPeminjamanRuangan, StatusRuangan } from '@prisma/client';
import { transporter } from '../utils/Mail.config';

const prisma = new PrismaClient();

export const initBookingScheduler = () => {
  // Jalan setiap 1 menit
  cron.schedule('* * * * *', async () => {
    console.log('[Scheduler] Checking for expired room bookings...');

    const thresholdTime = new Date(Date.now() - 30 * 60 * 1000); // 30 menit lalu

    try {
      // 1. Ambil semua booking yang expired
      const expiredBookings = await prisma.peminjaman_Ruangan.findMany({
        where: {
          status: StatusPeminjamanRuangan.DIAJUKAN,
          createdAt: { lt: thresholdTime },
        },
        include: {
          ruangan: true, 
          // Kita tidak include user di sini, tapi kita fetch fresh di dalam loop
          // supaya status warning-nya selalu realtime.
        },
      });

      if (expiredBookings.length === 0) return;

      for (const booking of expiredBookings) {
        
        // 2. AMBIL DATA USER TERBARU (PENTING!)
        // Kita harus fetch ulang user untuk memastikan status warn terakhirnya apa
        const user = await prisma.user.findUnique({
            where: { id: booking.user_id }
        });

        if (!user) continue;

        // 3. TENTUKAN LEVEL WARNING & ISI EMAIL
        let emailSubject = '';
        let emailHtml = '';
        let userUpdateData = {}; // Objek buat update tabel User
        let notifMessage = '';

        // --- LOGIC STRIKE SYSTEM ---
        
        if (!user.firstWarn) {
            // --- LEVEL 1 ---
            console.log(`[Strike 1] User ${user.nama}`);
            userUpdateData = { firstWarn: true };
            
            emailSubject = '⚠️ Peringatan 1: Verifikasi Peminjaman Ruangan';
            notifMessage = 'Anda mendapatkan Peringatan ke-1 karena tidak verifikasi tepat waktu.';
            emailHtml = `
                <h3>Peringatan 1</h3>
                <p>Halo <b>${user.nama}</b>,</p>
                <p>Peminjaman ruangan <b>${booking.ruangan.nama_ruangan}</b> dibatalkan karena timeout.</p>
                <p style="color: orange;">Ini adalah peringatan pertama Anda. Mohon lebih disiplin.</p>
            `;

        } else if (!user.secondWarn) {
            // --- LEVEL 2 ---
            console.log(`[Strike 2] User ${user.nama}`);
            userUpdateData = { secondWarn: true };

            emailSubject = '⚠️ Peringatan 2: Verifikasi Peminjaman Ruangan';
            notifMessage = 'Anda mendapatkan Peringatan ke-2. Satu kali lagi akun Anda akan diblokir.';
            emailHtml = `
                <h3>Peringatan 2</h3>
                <p>Halo <b>${user.nama}</b>,</p>
                <p>Peminjaman ruangan <b>${booking.ruangan.nama_ruangan}</b> dibatalkan kembali karena timeout.</p>
                <p style="color: red; font-weight: bold;">Ini adalah peringatan kedua. Jika terjadi sekali lagi, akun Anda akan otomatis DIBLOKIR.</p>
            `;

        } else if (!user.thirdWarn) {
            // --- LEVEL 3 (BLOCK) ---
            console.log(`[Strike 3] BLOCKING User ${user.nama}`);
            // Update jadi thirdWarn TRUE dan isBlocked TRUE
            userUpdateData = { thirdWarn: true, isBlocked: true };

            emailSubject = '⛔ AKUN ANDA DIBLOKIR';
            notifMessage = 'Akun Anda telah DIBLOKIR karena mengabaikan verifikasi 3 kali.';
            emailHtml = `
                <h3 style="color: red;">AKUN DIBLOKIR</h3>
                <p>Halo <b>${user.nama}</b>,</p>
                <p>Anda telah gagal melakukan verifikasi peminjaman ruangan sebanyak 3 kali berturut-turut.</p>
                <p>Sesuai peraturan, <b>Akun Anda telah dinonaktifkan sementara.</b></p>
                <p>Silakan hubungi Administrator atau Kepala Lab untuk membuka blokir.</p>
            `;
        } else {
            // User sudah blocked tapi masih ada booking nyangkut (Edge Case)
            // Tetap batalkan booking, tapi gak perlu update status user lagi
            console.log(`[Blocked User] User ${user.nama} booking clean up`);
            userUpdateData = {}; // Kosong, tidak ada update user
            emailSubject = 'Pembatalan Peminjaman (Akun Terblokir)';
            emailHtml = `<p>Peminjaman dibatalkan. Akun Anda berstatus Terblokir.</p>`;
        }

        // 4. EKSEKUSI TRANSACTION (Booking, Ruangan, User, Notif)
        try {
            await prisma.$transaction([
                // A. Batalkan Booking
                prisma.peminjaman_Ruangan.update({
                    where: { id: booking.id },
                    data: { status: StatusPeminjamanRuangan.DITOLAK }
                }),
                
                // B. Kosongkan Ruangan
                prisma.ruangan.update({
                    where: { id: booking.ruangan_id },
                    data: { status: StatusRuangan.KOSONG }
                }),

                // C. Buat Notifikasi Dashboard
                prisma.notifikasi.create({
                    data: {
                        user_id: user.id,
                        judul: "Peminjaman Dibatalkan & Warning",
                        pesan: notifMessage || "Peminjaman dibatalkan sistem.",
                        send_at: new Date()
                    }
                }),

                // D. Update Status Warning User (Kalau ada update)
                // Kita cek dulu object-nya kosong atau enggak biar gak error
                ...(Object.keys(userUpdateData).length > 0 
                    ? [prisma.user.update({
                        where: { id: user.id },
                        data: userUpdateData
                      })] 
                    : [])
            ]);

            // 5. KIRIM EMAIL (Diluar transaction biar gak blocking DB kalau SMTP lemot)
            await transporter.sendMail({
                from: '"Lab Admin" <jrkonveksiemail@gmail.com>',
                to: user.email || '', // Pastikan email bukan undefined
                subject: emailSubject,
                html: emailHtml,
            });

            console.log(`[Success] Booking ${booking.id} cancelled. Warning level updated for ${user.nama}.`);

        } catch (err) {
            console.error(`[Error] Failed processing booking ${booking.id}:`, err);
        }
      }

    } catch (error) {
      console.error('[Scheduler Error] Main loop error:', error);
    }
  });
};