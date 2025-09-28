/**
 * Serverless Function sebagai Proxy Aman ke API Telegram.
 * Menggunakan Environment Variables untuk Token dan ID rahasia.
 *
 * FIX: Menggunakan require() CommonJS standar untuk 'form-data'.
 */

// Menggunakan require() standar Node.js untuk modul CommonJS
const FormData = require('form-data'); 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Fungsi utilitas untuk mengubah Data URI Base64 menjadi Buffer
function base64ToBuffer(base64) {
    // Menghapus header dataURI (misalnya: 'data:image/jpeg;base64,')
    const base64Data = base64.split(',')[1] || base64;
    return Buffer.from(base64Data, 'base64');
}

module.exports = async (req, res) => {
    // Verifikasi POST dan Environment Variables
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Hanya metode POST yang diizinkan.' });
    }

    if (!BOT_TOKEN || !CHAT_ID) {
        // Error konfigurasi server - pengguna tidak akan melihat token ini.
        return res.status(500).json({ error: 'Kesalahan server: Token atau ID Chat Telegram tidak diatur.' });
    }

    const { caption, base64Image, isPhoto } = req.body;

    if (!caption) {
        return res.status(400).json({ error: 'Caption/Teks tidak boleh kosong.' });
    }

    try {
        let telegramResponse;
        
        if (isPhoto && base64Image) {
            // --- LOGIKA PENGIRIMAN FOTO (sendPhoto) ---
            
            const photoBuffer = base64ToBuffer(base64Image);
            // Inisialisasi FormData menggunakan constructor yang di-require
            const formData = new FormData(); 
            
            // Append photo as a Buffer with specific filename and content type
            formData.append('photo', photoBuffer, {
                filename: 'captured_photo.jpeg',
                contentType: 'image/jpeg',
            });
            formData.append('chat_id', CHAT_ID);
            formData.append('caption', caption);
            formData.append('parse_mode', 'Markdown'); // Agar lokasi terformat benar

            // Kirim request ke Telegram (multipart/form-data)
            telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData,
                // Penting: Gunakan headers dari formData agar boundary disetel dengan benar
                headers: formData.getHeaders(), 
            });

        } else {
            // --- LOGIKA PENGIRIMAN PESAN Teks Saja (sendMessage) ---
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
            return res.status(telegramResponse.status).json({ error: data.description || 'Gagal mengirim ke Telegram. Cek Token atau Chat ID Anda.' });
        }

        res.status(200).json({ success: true, telegram_data: data });

    } catch (error) {
        console.error('Server Proxy Error:', error);
        res.status(500).json({ error: 'Kesalahan internal server saat menghubungi Telegram.' });
    }
};
