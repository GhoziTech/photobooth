document.addEventListener('DOMContentLoaded', () => {
    const videoStream = document.getElementById('video-stream');
    const photoCanvas = document.getElementById('photo-canvas');
    const requestPermissionsButton = document.getElementById('request-permissions');
    const captureButton = document.getElementById('capture-button');
    const sendButton = document.getElementById('send-button');
    const locationInfo = document.getElementById('location-info');
    const photoPreview = document.getElementById('photo-preview');
    const statusMessage = document.getElementById('status-message');

    let capturedPhotoBase64 = null;
    let userLocation = null;

    // A. Fungsi untuk meminta izin kamera dan lokasi
    requestPermissionsButton.addEventListener('click', () => {
        requestCameraPermission();
        requestLocationPermission();
    });

    function requestCameraPermission() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    videoStream.srcObject = stream;
                    captureButton.style.display = 'block';
                    requestPermissionsButton.style.display = 'none';
                    statusMessage.textContent = 'Izin kamera berhasil diberikan!';
                    statusMessage.style.color = '#5cb85c';
                })
                .catch(err => {
                    statusMessage.textContent = `Error: Tidak dapat mengakses kamera. ${err.name}`;
                    statusMessage.style.color = '#d9534f';
                });
        }
    }

    function requestLocationPermission() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                locationInfo.textContent = `LAT: ${userLocation.latitude.toFixed(6)}, LNG: ${userLocation.longitude.toFixed(6)}`;
                sendButton.style.display = 'block';
            }, err => {
                locationInfo.textContent = `Error: ${err.message}. Gagal mendapatkan lokasi.`;
            });
        } else {
            locationInfo.textContent = 'Browser Anda tidak mendukung Geolocation.';
        }
    }

    // B. Fungsi untuk mengambil foto
    captureButton.addEventListener('click', () => {
        const context = photoCanvas.getContext('2d');
        const videoWidth = videoStream.videoWidth;
        const videoHeight = videoStream.videoHeight;
        
        photoCanvas.width = videoWidth;
        photoCanvas.height = videoHeight;
        
        context.drawImage(videoStream, 0, 0, videoWidth, videoHeight);
        capturedPhotoBase64 = photoCanvas.toDataURL('image/jpeg', 0.8);
        
        photoPreview.src = capturedPhotoBase64;
        photoPreview.style.display = 'block';
        statusMessage.textContent = 'Foto berhasil diambil!';
        statusMessage.style.color = '#5cb85c';
    });

    // C. Fungsi untuk mengirim data ke bot Telegram
    sendButton.addEventListener('click', () => {
        if (!capturedPhotoBase64) {
            statusMessage.textContent = 'Ambil foto terlebih dahulu!';
            statusMessage.style.color = '#d9534f';
            return;
        }

        if (!userLocation) {
            statusMessage.textContent = 'Lokasi belum didapatkan. Coba lagi.';
            statusMessage.style.color = '#d9534f';
            return;
        }

        statusMessage.textContent = 'Mengirim data...';
        statusMessage.style.color = '#1a73e8';
        
        const photoData = capturedPhotoBase64.split(',')[1];
        const locationText = `Laporan masuk dari LAT: ${userLocation.latitude.toFixed(6)}, LNG: ${userLocation.longitude.toFixed(6)}`;
        
        // Catatan Penting: Jangan expose token bot Anda!
        // Untuk proyek pribadi, Anda bisa mengirimkan data ini ke server backend Anda
        // yang kemudian mengirimkannya ke Telegram Bot API.
        // Di sini, saya akan menunjukkan bagaimana data dikirim ke bot Telegram.
        // Ganti 'YOUR_BOT_TOKEN' dan 'YOUR_CHAT_ID' dengan milik Anda
        const BOT_TOKEN = '7728385679:AAFo6yQiMzK0dq1dMg0JeUKhS3RejkDa4cE'; 
        const CHAT_ID = '7324427694'; // Ganti dengan chat ID admin Anda

        // Mengirim foto
        const photoFormData = new FormData();
        photoFormData.append('chat_id', CHAT_ID);
        photoFormData.append('photo', dataURItoBlob(capturedPhotoBase64), 'photo.jpg');

        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: photoFormData
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                statusMessage.textContent = 'Foto berhasil dikirim!';
                statusMessage.style.color = '#5cb85c';

                // Mengirim lokasi setelah foto berhasil
                return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: CHAT_ID,
                        text: locationText
                    })
                });
            } else {
                throw new Error(data.description || 'Gagal mengirim foto.');
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                statusMessage.textContent = 'Foto dan lokasi berhasil dikirim!';
                statusMessage.style.color = '#5cb85c';
            } else {
                throw new Error(data.description || 'Gagal mengirim lokasi.');
            }
        })
        .catch(error => {
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.style.color = '#d9534f';
        });
    });

    // Fungsi utilitas untuk mengubah data URI menjadi Blob
    function dataURItoBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    }
});