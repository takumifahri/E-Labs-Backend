import { NextFunction, Request, Response } from "express";
import { KondisiBarang, PrismaClient, StatusBarang, StatusPeminjamanHandset, StatusPeminjamanItem } from "@prisma/client";
import { AppError, asyncHandler } from "../../../../../middleware/error";
import { VerifikasiRequest, VerifikasiPeminjamanResponse, VerifikasiPeminjamanRequest, VerifikasiPeminjamanItemRequest, GetAllPengajuan } from "../../../../../models/verifikasi-peminjaman";
import { logActivity } from "../../../user/LogController";
import nodeCache from "node-cache";
import { transporter } from "../../../../../utils/Mail.config";

const cache = new nodeCache({ stdTTL: 300, checkperiod: 320 });
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL
        }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const verifikasiPeminjamanHandset = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // status: untuk bulk action (DISETUJUI/DITOLAK)
    // items: untuk partial action per item
    const { status, items, catatan } = req.body; 

    if (!id) throw new AppError("ID peminjaman is required", 400);

    // 1. Cari User Verifikator (Admin) berdasarkan token/session
    const adminUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });
    if (!adminUser) throw new AppError("Admin user not found", 404);

    // 2. Mulai Transaksi Database
    const result = await prisma.$transaction(async (tx) => {
        
        // A. Ambil Data Peminjaman Header beserta Items dan Stok Barang saat ini
        const peminjaman = await tx.peminjaman_Handset.findUnique({
            where: { id: Number(id) },
            include: { 
                peminjaman_items: {
                    include: { barang: true } // Include barang untuk cek stok
                } 
            }
        });

        if (!peminjaman) throw new AppError("Peminjaman not found", 404);

        // B. Normalisasi Input (Mapping target status untuk setiap item)
        let itemsToProcess: { id: number; targetStatus: StatusPeminjamanItem }[] = [];

        if (items && Array.isArray(items) && items.length > 0) {
            // CASE 1: Verifikasi Partial (Per Item dikirim dari frontend)
            itemsToProcess = items.map((i: any) => ({
                id: i.id,
                targetStatus: i.status // Pastikan frontend kirim status yang valid (DIPINJAM/DITOLAK)
            }));
        } else if (status) {
            // CASE 2: Verifikasi Bulk (Tombol Setuju/Tolak Semua di Header)
            let bulkTargetStatusItem: StatusPeminjamanItem;

            // Mapping Status Header ke Status Item
            if (status === StatusPeminjamanHandset.DISETUJUI) {
                bulkTargetStatusItem = StatusPeminjamanItem.DIPINJAM;
            } else if (status === StatusPeminjamanHandset.DITOLAK) {
                bulkTargetStatusItem = StatusPeminjamanItem.DITOLAK;
            } else {
                // Jika status lain (misal DIBATALKAN/SELESAI), anggap tidak ada perubahan stok otomatis di endpoint ini
                throw new AppError("Status bulk tidak valid untuk verifikasi awal", 400);
            }

            // Ambil semua item di peminjaman ini untuk diproses
            itemsToProcess = peminjaman.peminjaman_items.map((pi) => ({
                id: pi.id,
                targetStatus: bulkTargetStatusItem
            }));
        } else {
            throw new AppError("Harus menyertakan 'status' (global) atau 'items' (partial)", 400);
        }

        // C. Proses Loop Setiap Item (Logika Stok & Update Status)
        for (const inputItem of itemsToProcess) {
            // Ambil data item asli dari hasil query di atas
            const dbItem = peminjaman.peminjaman_items.find(pi => pi.id === inputItem.id);
            
            if (!dbItem) continue; // Skip jika ID item tidak ditemukan di peminjaman ini

            // --- LOGIKA PENGURANGAN STOK ---
            // Syarat kurangi stok:
            // 1. Target status barunya adalah DIPINJAM
            // 2. Status sebelumnya BUKAN DIPINJAM (Idempotency: supaya tidak double decrement kalau diklik 2x)
            if (inputItem.targetStatus === StatusPeminjamanItem.DIPINJAM) {
                
                if (dbItem.status !== StatusPeminjamanItem.DIPINJAM) {
                    
                    // Cek ketersediaan stok
                    if (dbItem.barang.jumlah < dbItem.jumlah) {
                        throw new AppError(
                            `Stok tidak cukup untuk ${dbItem.barang.nama_barang}. Tersedia: ${dbItem.barang.jumlah}, Diminta: ${dbItem.jumlah}`, 
                            400
                        );
                    }

                    // UPDATE BARANG: Kurangi Stok
                    await tx.barang.update({
                        where: { id: dbItem.barang_id },
                        data: { 
                            jumlah: { decrement: dbItem.jumlah },
                            // Opsional: Jika stok habis, ubah status barang jadi TIDAK_TERSEDIA?
                            // status: (dbItem.barang.jumlah - dbItem.jumlah === 0) ? 'TIDAK_TERSEDIA' : undefined 
                        }
                    });
                }
            } 
            // --- LOGIKA PENGEMBALIAN STOK (Jika Dibatalkan/Ditolak setelah Disetujui) ---
            // Jika sebelumnya DIPINJAM, lalu diubah jadi DITOLAK/DIBATALKAN, stok harus balik.
            else if (
                (inputItem.targetStatus === StatusPeminjamanItem.DITOLAK || inputItem.targetStatus === StatusPeminjamanItem.DIKEMBALIKAN) && 
                dbItem.status === StatusPeminjamanItem.DIPINJAM
            ) {
                 await tx.barang.update({
                    where: { id: dbItem.barang_id },
                    data: { jumlah: { increment: dbItem.jumlah } }
                });
            }

            // UPDATE STATUS ITEM
            await tx.peminjaman_Item.update({
                where: { id: inputItem.id },
                data: {
                    status: inputItem.targetStatus,
                    accepted_by_id: adminUser.id,
                    // catatan: catatan // Masukkan jika di schema Peminjaman_Item ada field catatan
                }
            });
        }

        // D. Hitung Ulang Status Header (Aggregation)
        // Query ulang status item terbaru untuk akurasi
        const finalItems = await tx.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });

        const totalItems = finalItems.length;
        const countDipinjam = finalItems.filter(i => i.status === StatusPeminjamanItem.DIPINJAM).length;
        const countDitolak = finalItems.filter(i => i.status === StatusPeminjamanItem.DITOLAK).length;
        const countDiajukan = finalItems.filter(i => i.status === StatusPeminjamanItem.DIAJUKAN).length;
        
        let newHeaderStatus: StatusPeminjamanHandset;

        // Logika penentuan status header
        if (countDiajukan > 0) {
            newHeaderStatus = StatusPeminjamanHandset.DIAJUKAN; // Masih ada yg pending/diajukan
        } else if (countDipinjam === totalItems) {
            newHeaderStatus = StatusPeminjamanHandset.DISETUJUI; // Semua sukses dipinjam
        } else if (countDitolak === totalItems) {
            newHeaderStatus = StatusPeminjamanHandset.DITOLAK; // Semua ditolak
        } else if (countDipinjam > 0 && countDitolak > 0) {
            newHeaderStatus = StatusPeminjamanHandset.SEBAGIAN_DISETUJUI; // Ada yang oke, ada yang tolak
        } else {
            // Fallback (misal semua dikembalikan atau case lain)
            newHeaderStatus = peminjaman.status; 
        }

        // UPDATE HEADER PEMINJAMAN
        const updatedHeader = await tx.peminjaman_Handset.update({
            where: { id: Number(id) },
            data: {
                status: newHeaderStatus,
                accepted_by_id: adminUser.id,
                // dokumen: ... (bisa diupdate jika ada generate surat jalan)
            },
            include: {
                // Include untuk response API
                peminjaman_items: {
                    include: { barang: true }
                },
                user: true
            }
        });

        return updatedHeader;
    });

    // 3. Response JSON
    res.status(200).json({
        message: "Verifikasi peminjaman berhasil diproses.",
        data: {
            id: result.id,
            kode_peminjaman: result.kode_peminjaman,
            status: result.status, // Ini yang dipakai frontend untuk update UI
            items: result.peminjaman_items.map(item => ({
                id: item.id,
                nama_barang: item.barang.nama_barang,
                status: item.status,
                jumlah: item.jumlah
            })),
            verifikator: adminUser.nama
        }
    });
});


const tolakPeminjamanHandset = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { catatan } = req.body; // Opsional: Alasan penolakan

    if (!id) throw new AppError("ID peminjaman is required", 400);

    // 1. Cek Admin
    const adminUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });
    if (!adminUser) throw new AppError("Admin user not found", 404);

    // 2. Gunakan Transaksi (Penting untuk konsistensi data)
    await prisma.$transaction(async (tx) => {
        
        // A. Ambil data peminjaman beserta itemnya
        const peminjaman = await tx.peminjaman_Handset.findUnique({
            where: { id: Number(id) },
            include: { peminjaman_items: true }
        });

        if (!peminjaman) throw new AppError("Peminjaman not found", 404);

        // B. Loop setiap item untuk memastikan Stok Aman
        // Kenapa diloop? Untuk jaga-jaga jika admin mau menolak peminjaman 
        // yang sebelumnya SUDAH DISETUJUI (Status DIPINJAM). Kita harus balikin stoknya.
        for (const item of peminjaman.peminjaman_items) {
            
            // Jika item sebelumnya statusnya DIPINJAM, artinya stok sudah berkurang di DB.
            // Maka saat ditolak, STOK HARUS DIKEMBALIKAN.
            if (item.status === StatusPeminjamanItem.DIPINJAM) {
                await tx.barang.update({
                    where: { id: item.barang_id },
                    data: {
                        jumlah: { increment: item.jumlah } // Balikin stok
                    }
                });
            }

            // Update status item jadi DITOLAK
            await tx.peminjaman_Item.update({
                where: { id: item.id },
                data: {
                    status: StatusPeminjamanItem.DITOLAK,
                    accepted_by_id: adminUser.id,
                    // catatan: catatan // Jika di table item ada kolom catatan
                }
            });
        }

        // C. Update Header Peminjaman jadi DITOLAK
        await tx.peminjaman_Handset.update({
            where: { id: Number(id) },
            data: {
                status: StatusPeminjamanHandset.DITOLAK,
                accepted_by_id: adminUser.id,
                // catatan: catatan // Simpan alasan penolakan di header (jika ada kolomnya)
            }
        });
    });

    res.status(200).json({
        message: "Peminjaman berhasil ditolak sepenuhnya."
    });
});

const SelesaiPeminjamanBarang = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { kondisi_barang }: { kondisi_barang: KondisiBarang[] } = req.body;

    // Validasi ID
    if (!id || isNaN(parseInt(id))) {
        throw new AppError("Valid ID required", 400);
    }

    // Validasi kondisi_barang
    if (!kondisi_barang || !Array.isArray(kondisi_barang) || kondisi_barang.length === 0) {
        throw new AppError("kondisi_barang is required and must be an array", 400);
    }

    // Cek apakah peminjaman handset ada
    const existingPeminjamanHandset = await prisma.peminjaman_Handset.findUnique({
        where: { id: parseInt(id) },
        include: {
            peminjaman_items: {
                include: {
                    barang: true
                }
            },
            user: {
                select: {
                    id: true,
                    nama: true,
                    NIM: true,
                    NIP: true,
                    email: true
                }
            }
        }
    });

    if (!existingPeminjamanHandset) {
        throw new AppError("Peminjaman handset not found", 404);
    }

    // Hanya peminjaman dengan status DISETUJUI yang bisa diselesaikan
    if (existingPeminjamanHandset.status !== StatusPeminjamanHandset.DISETUJUI) {
        throw new AppError("Only bookings with status 'DISETUJUI' can be marked as 'SELESAI'", 400);
    }

    // Validasi jumlah kondisi harus sama dengan jumlah items
    if (kondisi_barang.length !== existingPeminjamanHandset.peminjaman_items.length) {
        throw new AppError(
            `Jumlah kondisi_barang (${kondisi_barang.length}) harus sama dengan jumlah items (${existingPeminjamanHandset.peminjaman_items.length})`,
            400
        );
    }

    // Array untuk menyimpan info barang rusak
    const barangRusakBerat: Array<{ nama: string; kondisi: string }> = [];
    const barangRusakRingan: Array<{ nama: string; kondisi: string }> = [];

    // Update peminjaman handset menjadi SELESAI
    const updatedPeminjamanHandset = await prisma.peminjaman_Handset.update({
        where: { id: existingPeminjamanHandset.id },
        data: {
            status: StatusPeminjamanHandset.SELESAI,
            jam_realisasi_selesai: new Date(),
            updatedAt: new Date()
        },
        include: {
            peminjaman_items: {
                include: {
                    barang: true
                }
            },
            user: {
                select: {
                    id: true,
                    nama: true,
                    NIM: true,
                    NIP: true,
                    email: true
                }
            }
        }
    });

    // Update setiap peminjaman item dan barang sesuai kondisi (by index)
    for (let i = 0; i < existingPeminjamanHandset.peminjaman_items.length; i++) {
        const item = existingPeminjamanHandset.peminjaman_items[i];
        const kondisi = kondisi_barang[i]; // ✅ Ambil berdasarkan index array

        // Validasi kondisi valid
        if (!Object.values(KondisiBarang).includes(kondisi)) {
            throw new AppError(`Invalid kondisi_barang at index ${i}: ${kondisi}`, 400);
        }

        // Update peminjaman item menjadi DIKEMBALIKAN
        await prisma.peminjaman_Item.update({
            where: { id: item.id },
            data: {
                status: StatusPeminjamanItem.DIKEMBALIKAN,
                jam_realisasi_selesai: new Date(),
                updatedAt: new Date()
            }
        });

        // Tentukan status barang berdasarkan kondisi
        let statusBarang: StatusBarang;
        if (kondisi === KondisiBarang.BAIK) {
            statusBarang = StatusBarang.TERSEDIA;
        } else if (kondisi === KondisiBarang.RUSAK_RINGAN) {
            statusBarang = StatusBarang.PERBAIKAN;
            barangRusakRingan.push({
                nama: item.barang.nama_barang,
                kondisi: 'Rusak Ringan'
            });
        } else if (kondisi === KondisiBarang.RUSAK_BERAT) {
            statusBarang = StatusBarang.RUSAK;
            barangRusakBerat.push({
                nama: item.barang.nama_barang,
                kondisi: 'Rusak Berat'
            });
        } else {
            throw new AppError(`Invalid kondisi_barang: ${kondisi}`, 400);
        }

        await prisma.barang.update({
            where: { id: item.barang_id },
            data: {
                kondisi: kondisi,
                status: statusBarang,
                updatedAt: new Date()
            }
        });
    }

    // ✅ TAMBAHAN: Kirim email ke user
    if (existingPeminjamanHandset.user.email) {
        try {
            let emailSubject = "Pengembalian Barang - Konfirmasi";
            let emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Terima kasih atas pengembalian barang</h2>
                    <p>Halo ${existingPeminjamanHandset.user.nama},</p>
                    <p>Barang dengan kode peminjaman <strong>${existingPeminjamanHandset.kode_peminjaman}</strong> telah berhasil dikembalikan.</p>
                    <h3>Detail Barang yang Dikembalikan:</h3>
                    <ul>
            `;

            // Tambahkan list barang
            for (let i = 0; i < existingPeminjamanHandset.peminjaman_items.length; i++) {
                const item = existingPeminjamanHandset.peminjaman_items[i];
                const kondisi = kondisi_barang[i];
                emailContent += `<li>${item.barang.nama_barang} - Kondisi: ${kondisi}</li>`;
            }

            emailContent += `</ul>`;

            // ⚠️ WARNING untuk barang rusak berat
            if (barangRusakBerat.length > 0) {
                emailSubject = "⚠️ PERINGATAN - Pengembalian Barang Rusak Berat";
                emailContent += `
                    <div style="background-color: #fee; border: 2px solid #f00; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <h3 style="color: #c00; margin-top: 0;">⚠️ PERINGATAN PENTING</h3>
                        <p><strong>Barang yang dikembalikan dalam kondisi RUSAK BERAT:</strong></p>
                        <ul style="color: #c00;">
                `;

                barangRusakBerat.forEach(barang => {
                    emailContent += `<li><strong>${barang.nama}</strong> - ${barang.kondisi}</li>`;
                });

                emailContent += `
                        </ul>
                        <p style="color: #c00; font-weight: bold;">
                            Anda akan diberikan peringatan dan mungkin dikenakan sanksi sesuai kebijakan peminjaman. 
                            Harap segera menghubungi admin untuk penjelasan lebih lanjut.
                        </p>
                    </div>
                `;

                // ✅ Update warning di user
                const user = await prisma.user.findUnique({
                    where: { id: existingPeminjamanHandset.user_id }
                });

                if (user) {
                    if (!user.firstWarn) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { firstWarn: true }
                        });
                        emailContent += `<p><strong>Peringatan Pertama telah diberikan.</strong></p>`;
                    } else if (!user.secondWarn) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { secondWarn: true }
                        });
                        emailContent += `<p><strong>Peringatan Kedua telah diberikan.</strong></p>`;
                    } else if (!user.thirdWarn) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { thirdWarn: true }
                        });
                        emailContent += `<p><strong>Peringatan Ketiga (Terakhir) telah diberikan.</strong></p>`;
                    } else {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { isBlocked: true }
                        });
                        emailContent += `<p style="color: #f00; font-weight: bold;">⛔ AKUN ANDA TELAH DIBLOKIR karena pelanggaran berulang.</p>`;
                    }
                }
            }

            // ℹ️ INFO untuk barang rusak ringan
            if (barangRusakRingan.length > 0) {
                emailContent += `
                    <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                        <h3 style="color: #856404; margin-top: 0;">ℹ️ INFORMASI</h3>
                        <p><strong>Barang yang dikembalikan dalam kondisi RUSAK RINGAN:</strong></p>
                        <ul style="color: #856404;">
                `;

                barangRusakRingan.forEach(barang => {
                    emailContent += `<li><strong>${barang.nama}</strong> - ${barang.kondisi}</li>`;
                });

                emailContent += `
                        </ul>
                        <p>Barang akan diperbaiki. Harap lebih berhati-hati di peminjaman berikutnya.</p>
                    </div>
                `;
            }

            emailContent += `
                    <p>Terima kasih atas kerjasamanya.</p>
                    <p>Hormat kami,<br><strong>Admin E-Labs</strong></p>
                </div>
            `;

            await transporter.sendMail({
                from: `"Admin E-Labs" <${process.env.SMTP_USER}>`, // ✅ Nama pengirim disembunyikan
                to: existingPeminjamanHandset.user.email,
                subject: emailSubject,
                html: emailContent
            });

            console.log(`✅ Email sent to ${existingPeminjamanHandset.user.email}`);
        } catch (emailError) {
            console.error('❌ Error sending email:', emailError);
        }
    }


    // Clear cache
    cache.flushAll();

    // Log activity
    try {
        let logMessage = `User (${existingPeminjamanHandset.user.NIM ?? existingPeminjamanHandset.user.NIP ?? ""}) mengembalikan barang dengan kode peminjaman ${existingPeminjamanHandset.kode_peminjaman}`;

        if (barangRusakBerat.length > 0) {
            logMessage += ` dengan kondisi RUSAK BERAT: ${barangRusakBerat.map(b => b.nama).join(', ')}`;
        }

        await logActivity({
            user_id: existingPeminjamanHandset.user_id,
            pesan: logMessage,
            aksi: 'PENGEMBALIAN BARANG',
            tabel_terkait: 'Peminjaman_Handset'
        });
    } catch (logError) {
        console.error('Error logging activity:', logError);
    }

    return res.status(200).json({
        status: "success",
        message: "Barang berhasil dikembalikan",
        data: updatedPeminjamanHandset,
        warnings: barangRusakBerat.length > 0 ? {
            rusak_berat: barangRusakBerat,
            message: "User telah diberikan peringatan"
        } : undefined
    });
});

const selesaikanPeminjamanHandset = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    console.log(`\n🔥🔥🔥 [START] Selesaikan Peminjaman ID: ${id} 🔥🔥🔥`);

    if (!id) throw new AppError("ID peminjaman is required", 400);

    const adminUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });
    if (!adminUser) throw new AppError("User not found", 404);

    const result = await prisma.$transaction(async (tx) => {
        
        // 1. Ambil Data
        const peminjaman = await tx.peminjaman_Handset.findUnique({
            where: { id: Number(id) },
            include: { peminjaman_items: true }
        });

        if (!peminjaman) throw new AppError("Peminjaman not found", 404);

        // [DEBUG 1] Cek Status Header
        console.log(`[DEBUG] Status Header saat ini: ${peminjaman.status}`);

        // Validasi
        if (peminjaman.status === StatusPeminjamanHandset.SELESAI) {
            throw new AppError("Peminjaman ini sudah selesai sebelumnya", 400);
        }
        
        // [DEBUG 2] Cek Jumlah Item
        console.log(`[DEBUG] Ditemukan ${peminjaman.peminjaman_items.length} item dalam peminjaman ini.`);

        // 2. Loop Item
        for (const item of peminjaman.peminjaman_items) {
            
            // [DEBUG 3] Cek Status PER ITEM (Ini Kuncinya!)
            console.log(`👉 [DEBUG] Cek Item ID: ${item.id} | Barang ID: ${item.barang_id} | Status DB: ${item.status}`);

            // LOGIC: Hanya proses jika statusnya DIPINJAM
            if (item.status === StatusPeminjamanItem.DIPINJAM) {
                
                console.log(`✅ [ACTION] Mengembalikan Stok untuk Item ID: ${item.id} (+${item.jumlah})`);

                // 1. Tambah Stok
                await tx.barang.update({
                    where: { id: item.barang_id },
                    data: { jumlah: { increment: item.jumlah } }
                });

                // 2. Update Status Item
                await tx.peminjaman_Item.update({
                    where: { id: item.id },
                    data: {
                        status: StatusPeminjamanItem.DIKEMBALIKAN, // Pastikan enum ini ada
                        jam_realisasi_selesai: new Date(),
                        tanggal_kembali: new Date(),
                        accepted_by_id: adminUser.id,
                    }
                });
            } else {
                // [DEBUG 4] Alasan Skip
                console.log(`❌ [SKIP] Item ID: ${item.id} DILEWATI. Alasan: Status '${item.status}' !== '${StatusPeminjamanItem.DIPINJAM}'`);
            }
        }

        // 3. Update Header
        const updatedHeader = await tx.peminjaman_Handset.update({
            where: { id: Number(id) },
            data: {
                status: StatusPeminjamanHandset.SELESAI,
                jam_realisasi_selesai: new Date(),
                tanggal_kembali: new Date(),
                accepted_by_id: adminUser.id,
            },
            include: { peminjaman_items: true }
        });

        console.log(`🔥🔥🔥 [END] Transaksi Selesai 🔥🔥🔥\n`);
        return updatedHeader;
    });

    res.status(200).json({
        message: "Peminjaman selesai. Stok barang telah dikembalikan.",
        data: result
    });
});

const VerifikasiController = {
    verifikasiPeminjamanHandset,
    selesaikanPeminjamanHandset,
    tolakPeminjamanHandset,
    SelesaiPeminjamanBarang
};

export default VerifikasiController;