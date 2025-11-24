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
    const { status, items, catatan } = req.body;

    if (!id) {
        throw new AppError("ID peminjaman handset is required", 400);
    }

    // Validasi: Harus ada status global ATAU items untuk per-item verification
    if (!status && (!items || !Array.isArray(items) || items.length === 0)) {
        throw new AppError("Status global atau items untuk verifikasi per-item is required", 400);
    }

    // Validasi status global jika ada
    if (status && !Object.values(StatusPeminjamanHandset).includes(status)) {
        throw new AppError(`Status tidak valid. Pilihan: ${Object.values(StatusPeminjamanHandset).join(', ')}`, 400);
    }

    // Validasi items jika ada
    if (items) {
        for (const item of items) {
            if (!item.id || !item.status) {
                throw new AppError("Setiap item harus memiliki id dan status", 400);
            }
            if (!Object.values(StatusPeminjamanItem).includes(item.status)) {
                throw new AppError(`Status item tidak valid. Pilihan: ${Object.values(StatusPeminjamanItem).join(', ')}`, 400);
            }
        }
    }

    // Cari user dari JWT token
    const findUser = await prisma.user.findUnique({
        where: { email: req.user?.email }
    });

    if (!findUser) {
        throw new AppError("User not found", 404);
    }

    console.log("Found user in DB:", findUser.id);

    // Cek apakah peminjaman ada
    const existingPeminjaman = await prisma.peminjaman_Handset.findUnique({
        where: { id: Number(id) },
        include: {
            peminjaman_items: true
        }
    });

    if (!existingPeminjaman) {
        throw new AppError("Peminjaman not found", 404);
    }

    let updatedItems: any[] = [];
    let headerStatus: StatusPeminjamanHandset;

    if (items && items.length > 0) {
        // MODE: Per-item verification
        console.log("Processing per-item verification...");

        // Update setiap item sesuai dengan status yang diberikan
        for (const itemUpdate of items) {
            await prisma.peminjaman_Item.update({
                where: {
                    id: itemUpdate.id,
                    peminjaman_handset_id: Number(id) // Pastikan item belong to peminjaman ini
                },
                data: {
                    status: itemUpdate.status,
                    accepted_by_id: findUser.id,
                }
            });
        }

        // Ambil semua items terbaru untuk menentukan status header
        const allItems = await prisma.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });

        updatedItems = allItems;

        // Tentukan status header berdasarkan status items
        const approvedItems = allItems.filter(item => item.status === StatusPeminjamanItem.DIPINJAM);
        const rejectedItems = allItems.filter(item => item.status === StatusPeminjamanItem.DITOLAK);
        const pendingItems = allItems.filter(item => item.status === StatusPeminjamanItem.DIAJUKAN);

        if (pendingItems.length > 0) {
            headerStatus = StatusPeminjamanHandset.DIAJUKAN;
        } else if (approvedItems.length > 0 && rejectedItems.length === 0) {
            headerStatus = StatusPeminjamanHandset.DISETUJUI;
        } else if (rejectedItems.length > 0 && approvedItems.length === 0) {
            headerStatus = StatusPeminjamanHandset.DITOLAK;
        } else {
            // Mixed: ada yang approved dan rejected
            headerStatus = StatusPeminjamanHandset.DIAJUKAN; // Tambahkan enum ini jika perlu
        }

    } else {
        // MODE: Bulk verification (semua items dengan status yang sama)
        console.log("Processing bulk verification...");

        headerStatus = status;

        // Map StatusPeminjamanHandset to StatusPeminjamanItem
        let itemStatus: StatusPeminjamanItem;
        switch (status) {
            case StatusPeminjamanHandset.DISETUJUI:
                itemStatus = StatusPeminjamanItem.DIPINJAM;
                break;
            case StatusPeminjamanHandset.DITOLAK:
                itemStatus = StatusPeminjamanItem.DITOLAK;
                break;
            default:
                itemStatus = StatusPeminjamanItem.DITOLAK;
        }

        // Update semua item dengan status yang sama
        await prisma.peminjaman_Item.updateMany({
            where: { peminjaman_handset_id: Number(id) },
            data: {
                status: itemStatus,
                accepted_by_id: findUser.id,
            }
        });

        // Ambil data items terbaru
        updatedItems = await prisma.peminjaman_Item.findMany({
            where: { peminjaman_handset_id: Number(id) }
        });
    }

    // Update status header
    const peminjamanHeader = await prisma.peminjaman_Handset.update({
        where: { id: Number(id) },
        data: {
            status: headerStatus,
            accepted_by_id: findUser.id,
        }
    });

    // Response
    const responses: VerifikasiPeminjamanResponse = {
        id: peminjamanHeader.id,
        id_peminjaman: peminjamanHeader.id,
        status: headerStatus as unknown as StatusPeminjamanItem,
        item: updatedItems.map(item => ({
            id: item.id,
            status: item.status,
            catatan: item.catatan
        }))
    };

    res.status(200).json({
        message: "Peminjaman handset verified successfully",
        data: responses
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
    SelesaiPeminjamanBarang
};

export default VerifikasiController;