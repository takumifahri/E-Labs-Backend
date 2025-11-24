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

// ✅ TAMBAHAN: Weekly Schedule Duplicator
export const initWeeklyScheduler = () => {
  console.log('🔄 [Weekly Scheduler] Initialized...');

  // Run every Sunday at 23:30 (prepare schedules for next week)
  cron.schedule('30 23 * * 0', async () => {
    console.log('⏰ [Weekly Scheduler] Sunday trigger activated');
    await createNextWeekSchedules();
  }, {
    timezone: "Asia/Jakarta"
  });

  // Run every Monday at 00:30 (backup trigger)
  cron.schedule('30 0 * * 1', async () => {
    console.log('⏰ [Weekly Scheduler] Monday backup trigger activated');
    await createNextWeekSchedules();
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log('✅ Weekly scheduler started! Will run every Sunday at 23:30 and Monday at 00:30');
};

// Function to create next week schedules from loop schedules
async function createNextWeekSchedules() {
  console.log('🔄 [Weekly Scheduler] Creating next week schedules...');

  try {
    // Get all active loop schedules from this week
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    const currentLoopSchedules = await prisma.peminjaman_Ruangan.findMany({
      where: { 
        isLoop: true,
        status: { 
          in: [
            StatusPeminjamanRuangan.DISETUJUI,
            StatusPeminjamanRuangan.BERLANGSUNG,
            StatusPeminjamanRuangan.SELESAI
          ]
        },
        tanggal: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      include: {
        user: { select: { id: true, nama: true, isBlocked: true } },
        ruangan: { select: { id: true, kode_ruangan: true } },
        matkul: { select: { id: true, matkul: true } }
      }
    });

    console.log(`[Weekly Scheduler] Found ${currentLoopSchedules.length} loop schedules to duplicate`);

    let duplicatedCount = 0;
    let skippedCount = 0;
    let blockedUserSkipped = 0;

    for (const schedule of currentLoopSchedules) {
      // Skip if user is blocked
      if (schedule.user?.isBlocked) {
        blockedUserSkipped++;
        console.log(`[Weekly Scheduler] Skipping blocked user: ${schedule.user.nama}`);
        continue;
      }

      // Calculate next week dates
      const nextWeekDate = new Date(schedule.tanggal!);
      nextWeekDate.setDate(schedule.tanggal!.getDate() + 7);

      const nextWeekJamMulai = schedule.jam_mulai ? new Date(schedule.jam_mulai.getTime() + (7 * 24 * 60 * 60 * 1000)) : null;
      const nextWeekJamSelesai = schedule.jam_selesai ? new Date(schedule.jam_selesai.getTime() + (7 * 24 * 60 * 60 * 1000)) : null;

      // Check if next week schedule already exists
      const existingNextWeek = await prisma.peminjaman_Ruangan.findFirst({
        where: {
          ruangan_id: schedule.ruangan_id,
          user_id: schedule.user_id,
          matkul_id: schedule.matkul_id,
          tanggal: {
            gte: new Date(nextWeekDate.getFullYear(), nextWeekDate.getMonth(), nextWeekDate.getDate()),
            lt: new Date(nextWeekDate.getFullYear(), nextWeekDate.getMonth(), nextWeekDate.getDate() + 1)
          },
          jam_mulai: nextWeekJamMulai
        }
      });

      if (existingNextWeek) {
        skippedCount++;
        continue;
      }

      try {
        await prisma.peminjaman_Ruangan.create({
          data: {
            ruangan_id: schedule.ruangan_id,
            user_id: schedule.user_id,
            matkul_id: schedule.matkul_id,
            tanggal: nextWeekDate,
            jam_mulai: nextWeekJamMulai,
            jam_selesai: nextWeekJamSelesai,
            status: StatusPeminjamanRuangan.DISETUJUI, // New schedules start as approved
            kegiatan: schedule.kegiatan,
            isLoop: true,
            accepted_by_id: schedule.accepted_by_id,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        duplicatedCount++;
        console.log(`[Weekly Scheduler] ✅ ${schedule.ruangan?.kode_ruangan} | ${schedule.user?.nama} | ${nextWeekDate.toISOString().split('T')[0]}`);

      } catch (error) {
        console.log(`[Weekly Scheduler] ❌ Error duplicating: ${error}`);
      }
    }

    console.log(`🎉 [Weekly Scheduler] Completed! Created ${duplicatedCount} schedules, skipped ${skippedCount} existing, ${blockedUserSkipped} blocked users`);

    // Send notification to admins about weekly duplication
    const adminUsers = await prisma.user.findMany({
      where: { roleId: { in: [3, 4] } }, // pengelola & superadmin
      select: { id: true }
    });

    for (const admin of adminUsers) {
      await prisma.notifikasi.create({
        data: {
          user_id: admin.id,
          judul: "Jadwal Mingguan Diperbaharui",
          pesan: `${duplicatedCount} jadwal ruangan berhasil diduplikasi untuk minggu depan. ${blockedUserSkipped} user terblokir dilewati.`,
          send_at: new Date()
        }
      });
    }

  } catch (error) {
    console.error('[Weekly Scheduler] Error:', error);
  }
}

// Function to manually trigger next week creation (for testing)
export async function triggerManualWeeklyDuplication() {
  console.log('🔧 [Manual Trigger] Weekly duplication');
  await createNextWeekSchedules();
}

// ✅ FUNCTION UTAMA UNTUK MEMULAI SEMUA SCHEDULER
export const initAllSchedulers = () => {
  console.log('🚀 [Scheduler] Starting all schedulers...');
  
  // Start booking expiry scheduler (existing)
  initBookingScheduler();
  
  // Start weekly schedule duplicator (new)
  initWeeklyScheduler();
  
  console.log('✅ [Scheduler] All schedulers started successfully!');
};