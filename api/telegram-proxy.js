/**
 * Ini adalah Serverless Function yang berfungsi sebagai perantara (Proxy)
 * antara frontend (index.html) dan API Telegram.
 *
 * TOKEN BOT dan CHAT ID HANYA tersimpan di sini sebagai variabel lingkungan (Environment Variables),
 * dan TIDAK terlihat di kode frontend.
 */

// Kunci Keamanan: Ambil token dan ID dari Variabel Lingkungan
// Catatan: Variabel-variabel ini HARUS diatur di Vercel/Netlify.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Fungsi utilitas untuk mengubah Data URI Base64 menjadi Buffer
function base64ToBuffer(base64) {
    // Menghapus header dataURI (misalnya: 'data:image/jpeg;base64,')
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Data, 'base64');
}

module.exports = async (req, res) => {
    // 1. Verifikasi Metode dan Token
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Hanya metode POST yang diizinkan.' });
        return;
    }

    if (!BOT_TOKEN || !CHAT_ID) {
        // Ini adalah error SISI SERVER yang tidak akan dilihat pengguna
        console.error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID tidak diatur!");
        res.status(500).json({ error: 'Kesalahan konfigurasi server (Token/ID hilang).' });
        return;
    }

    const { caption, base64Image, isPhoto } = req.body;

    if (!caption) {
        res.status(400).json({ error: 'Caption/Teks tidak boleh kosong.' });
        return;
    }

    try {
        let telegramResponse;
        
        if (isPhoto && base64Image) {
            // Logika Pengiriman FOTO (menggunakan FormData di sisi server)
            
            const photoBuffer = base64ToBuffer(base64Image);
            const { default: FormData } = await import('form-data');
            const formData = new FormData();
            
            // Tambahkan file foto (sebagai buffer)
            formData.append('photo', photoBuffer, {
                filename: 'captured_photo.jpeg',
                contentType: 'image/jpeg',
            });
            formData.append('chat_id', CHAT_ID);
            formData.append('caption', caption);
            formData.append('parse_mode', 'Markdown');

            // Kirim request ke Telegram
            telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders(),
            });

        } else {
            // Logika Pengiriman PESAN Teks Saja
            const payload = {
                chat_id: CHAT_ID,
                text: caption,
                parse_mode: 'Markdown'
            };

            telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await telegramResponse.json();

        if (!data.ok) {
            console.error('Telegram API Error:', data.description);
            res.status(telegramResponse.status).json({ error: data.description || 'Gagal mengirim ke Telegram' });
            return;
        }

        res.status(200).json({ success: true, telegram_data: data });

    } catch (error) {
        console.error('Server Proxy Error:', error);
        res.status(500).json({ error: 'Kesalahan internal server saat menghubungi Telegram.' });
    }
};
