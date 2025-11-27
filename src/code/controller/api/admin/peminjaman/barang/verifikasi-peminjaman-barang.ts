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
    const { status, items, catatan } = req.body; // status (untuk bulk), items (untuk partial)

    if (!id) throw new AppError("ID peminjaman is required", 400);

    // 1. Cari User Verifikator (Admin)
    const adminUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });
    if (!adminUser) throw new AppError("Admin user not found", 404);

    // 2. Mulai Transaksi Database (Supaya Aman)
    const result = await prisma.$transaction(async (tx) => {
        
        // A. Ambil Data Peminjaman saat ini + Data Barang
        const peminjaman = await tx.peminjaman_Handset.findUnique({
            where: { id: Number(id) },
            include: { 
                peminjaman_items: {
                    include: { barang: true } // Penting: Ambil data stok barang terkini
                } 
            }
        });

        if (!peminjaman) throw new AppError("Peminjaman not found", 404);

        // B. Tentukan Items mana yang mau diproses dan status tujuannya
        // Kita ubah format input (baik bulk maupun per-item) menjadi array standar biar logic-nya satu pintu.
        let itemsToProcess: { id: number; targetStatus: StatusPeminjamanItem }[] = [];

        if (items && items.length > 0) {
            // CASE 1: Verifikasi Per-Item (Partial)
            itemsToProcess = items.map((i: any) => ({
                id: i.id,
                targetStatus: i.status
            }));
        } else if (status) {
            // CASE 2: Verifikasi Global (Bulk Approve/Reject)
            let bulkTargetStatus: StatusPeminjamanItem;
            if (status === StatusPeminjamanHandset.DISETUJUI) bulkTargetStatus = StatusPeminjamanItem.DIPINJAM;
            else if (status === StatusPeminjamanHandset.DITOLAK) bulkTargetStatus = StatusPeminjamanItem.DITOLAK;
            else throw new AppError("Status bulk tidak valid untuk verifikasi", 400);

            itemsToProcess = peminjaman.peminjaman_items.map((pi) => ({
                id: pi.id,
                targetStatus: bulkTargetStatus
            }));
        } else {
            throw new AppError("Harus kirim 'status' (global) atau 'items' (partial)", 400);
        }

        // C. Proses Loop Setiap Item
        for (const inputItem of itemsToProcess) {
            const dbItem = peminjaman.peminjaman_items.find(pi => pi.id === inputItem.id);
            if (!dbItem) continue; // Skip jika item tidak valid

            // LOGIKA 1: Jika tujuannya MENYETUJUI (DIPINJAM)
            if (inputItem.targetStatus === StatusPeminjamanItem.DIPINJAM) {
                // Cek apakah item ini SUDAH dipinjam sebelumnya? (biar stok gak kepotong 2x)
                if (dbItem.status === StatusPeminjamanItem.DIPINJAM) continue;

                // Cek Stok Cukup atau Tidak
                if (dbItem.barang.jumlah < dbItem.jumlah) {
                    throw new AppError(`Gagal: Stok ${dbItem.barang.nama_barang} sisa ${dbItem.barang.jumlah}, diminta ${dbItem.jumlah}`, 400);
                }

                // KURANGI STOK (Atomic Decrement)
                await tx.barang.update({
                    where: { id: dbItem.barang_id },
                    data: { jumlah: { decrement: dbItem.jumlah } }
                });
            }

            // LOGIKA 2: Update Status Item
            await tx.peminjaman_Item.update({
                where: { id: inputItem.id },
                data: {
                    status: inputItem.targetStatus,
                    accepted_by_id: adminUser.id,
                    // catatan: catatan // Opsional jika ada catatan per item
                }
            });
        }

        // D. Hitung Status Header Otomatis (Setelah item diupdate)
        // Kita query ulang status items yang baru saja diupdate di dalam transaksi ini
        const updatedItems = await tx.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });

        const countDipinjam = updatedItems.filter(i => i.status === StatusPeminjamanItem.DIPINJAM).length;
        const countDitolak = updatedItems.filter(i => i.status === StatusPeminjamanItem.DITOLAK).length;
        const countDiajukan = updatedItems.filter(i => i.status === StatusPeminjamanItem.DIAJUKAN).length;
        const totalItems = updatedItems.length;

        let newHeaderStatus: StatusPeminjamanHandset = StatusPeminjamanHandset.DIAJUKAN;

        if (countDiajukan > 0) {
            newHeaderStatus = StatusPeminjamanHandset.DIAJUKAN; // Masih ada yang gantung
        } else if (countDipinjam === totalItems) {
            newHeaderStatus = StatusPeminjamanHandset.DISETUJUI; // Semua diterima
        } else if (countDitolak === totalItems) {
            newHeaderStatus = StatusPeminjamanHandset.DITOLAK; // Semua ditolak
        } else {
            newHeaderStatus = StatusPeminjamanHandset.SEBAGIAN_DISETUJUI; // Campur
        }

        // E. Update Header Peminjaman
        const finalHeader = await tx.peminjaman_Handset.update({
            where: { id: Number(id) },
            data: {
                status: newHeaderStatus,
                accepted_by_id: adminUser.id,
                // catatan: catatan // jika ada catatan global
            }
        });

        return { header: finalHeader, items: updatedItems };
    });

    // 3. Response Sukses
    res.status(200).json({
        message: "Verifikasi berhasil disimpan.",
        data: {
            id: result.header.id,
            status: result.header.status,
            items: result.items
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

const VerifikasiController = {
    verifikasiPeminjamanHandset,
    SelesaiPeminjamanBarang,
    tolakPeminjamanHandset
};

export default VerifikasiController;