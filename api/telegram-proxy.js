/**
 * Ini adalah Serverless Function yang berfungsi sebagai perantara (Proxy)
 * antara frontend (index.html) dan API Telegram.
 *
 * TOKEN BOT dan CHAT ID HANYA tersimpan di sini sebagai variabel lingkungan (Environment Variables),
 * dan TIDAK terlihat di kode frontend.
 */

// Library untuk membuat form data yang kompatibel dengan multi-part request
const FormData = require('form-data');
// Library bawaan Node.js untuk I/O (file, path, dsb.)
const fetch = require('node-fetch');

// Kunci Keamanan: Ambil token dan ID dari Variabel Lingkungan
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Fungsi utilitas untuk mengubah Data URI Base64 menjadi Buffer
function base64ToBuffer(base64) {
    // Menghapus header dataURI (misalnya: 'data:image/jpeg;base64,')
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Data, 'base64');
}

/**
 * Fungsi utilitas untuk mengurai body request secara aman.
 * Ini mengatasi error "Unexpected end of JSON input" jika body request kosong atau tidak terurai otomatis.
 */
async function parseBody(req) {
    if (req.body) {
        return req.body;
    }
    
    // Jika req.body tidak terurai otomatis, coba mengurai stream mentah
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Hati-hati: Jika body kosong, JSON.parse akan gagal
                if (!body) {
                    resolve({}); // Mengembalikan objek kosong jika body kosong
                    return;
                }
                // Jika request content-type-nya JSON, parse
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    resolve(JSON.parse(body));
                } else {
                    // Untuk non-JSON (misalnya form-urlencoded), kembalikan string mentah
                    resolve({ rawBody: body });
                }
            } catch (error) {
                reject(new SyntaxError("Gagal mengurai body request: " + error.message));
            }
        });
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    // 1. Verifikasi Metode dan Token
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Hanya metode POST yang diizinkan.' });
        return;
    }

    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID tidak diatur.");
        res.status(500).json({ error: 'Variabel lingkungan bot tidak diatur di server.' });
        return;
    }

    try {
        // Coba mengurai body request. Jika error, akan ditangkap di catch block.
        const payload = await parseBody(req);
        
        // 2. Ekstrak Data dari Payload
        const { caption, base64Image, isPhoto } = payload;

        if (!caption) {
            res.status(400).json({ error: 'Caption (laporan data) tidak boleh kosong.' });
            return;
        }

        let telegramResponse;

        // 3. Logika Pengiriman FOTO + Teks (Menggunakan form-data)
        if (isPhoto && base64Image) {
            const buffer = base64ToBuffer(base64Image);
            const formData = new FormData();
            
            // Append foto sebagai file buffer
            formData.append('photo', buffer, {
                filename: 'photo.jpg',
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
            // 4. Logika Pengiriman PESAN Teks Saja (Jika gagal mendapatkan foto/kamera non-aktif)
            const textPayload = {
                chat_id: CHAT_ID,
                text: caption,
                parse_mode: 'Markdown'
            };

            telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(textPayload)
            });
        }

        // 5. Proses Respon Telegram
        // Menggunakan text() alih-alih json() untuk debugging error parsing body.
        const rawText = await telegramResponse.text(); 
        
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('Gagal parse JSON dari Telegram:', rawText);
            throw new Error('Respon Telegram bukan JSON yang valid.');
        }

        if (!data.ok) {
            console.error('Telegram API Error:', data.description);
            res.status(telegramResponse.status).json({ error: data.description || 'Gagal mengirim ke Telegram' });
            return;
        }

        res.status(200).json({ success: true, telegram_data: data });

    } catch (error) {
        console.error('Server Proxy Error:', error);
        // Tangani SyntaxError: Unexpected end of JSON input
        if (error.message.includes('SyntaxError')) {
             res.status(400).json({ error: 'Payload tidak valid (JSON terpotong atau kosong). Pastikan data Base64 utuh.' });
        } else {
             res.status(500).json({ error: error.message || 'Terjadi kesalahan server yang tidak terduga.' });
        }
    }
};
