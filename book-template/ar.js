document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    const overlay = document.getElementById("ar-overlay");
    const startButton = document.getElementById("start-ar-from-overlay");
    const modelViewer = document.getElementById("modelo-ar");

    const arControls = document.getElementById("ar-media-controls");
    const btnPhoto = document.getElementById("btn-take-photo");
    const btnRecord = document.getElementById("btn-record-video");
    
    const previewModal = document.getElementById("media-preview-modal");
    const previewContainer = document.getElementById("preview-container");
    const downloadLink = document.getElementById("download-link");
    const closeModal = document.getElementById("close-modal");

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;

    // Detecta status da sessão WebXR para exibir os botões na tela
    if (modelViewer) {
        modelViewer.addEventListener('ar-status', (event) => {
            if (event.detail.status === 'session-started') {
                // Se a sessão iniciou via WebXR (Inline AR)
                if (arControls) arControls.style.display = 'flex';
            } else if (event.detail.status === 'not-presenting' || event.detail.status === 'failed') {
                if (arControls) arControls.style.display = 'none';
                hideOverlay();
            }
        });
    }

    // --- LÓGICA DE CAPTURA DE FOTO ---
    if (btnPhoto) {
        btnPhoto.addEventListener("click", async () => {
            try {
                // Tira o snapshot direto da renderização 3D/Câmera
                const blob = await modelViewer.toBlob({ idealAspect: true, mimeType: 'image/png' });
                const url = URL.createObjectURL(blob);
                
                showPreview(url, 'image');
            } catch (err) {
                console.error("Erro ao tirar foto:", err);
                alert("Não foi possível tirar a foto neste dispositivo.");
            }
        });
    }

    // --- LÓGICA DE GRAVAÇÃO DE VÍDEO (MediaRecorder) ---
    if (btnRecord) {
        btnRecord.addEventListener("click", () => {
            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }

    function startRecording() {
        recordedChunks = [];
        // Pega o elemento Canvas renderizado internamente pelo <model-viewer>
        const canvas = modelViewer.shadowRoot ? modelViewer.shadowRoot.querySelector('canvas') : modelViewer.querySelector('canvas');
        
        if (!canvas) {
            alert("Canvas de renderização não encontrado.");
            return;
        }

        const stream = canvas.captureStream(30); // 30 FPS
        const options = { mimeType: 'video/webm;codecs=vp9' };
        
        // Fallback de codecs para iOS/Safari
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/mp4';
        }

        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.error("MimeType não suportado:", e);
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/mp4' });
            const url = URL.createObjectURL(blob);
            showPreview(url, 'video');
        };

        mediaRecorder.start();
        isRecording = true;
        btnRecord.classList.add("recording");
        btnRecord.innerText = "⏹️";
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            btnRecord.classList.remove("recording");
            btnRecord.innerText = "🔴";
        }
    }

    // Exibe o modal para salvar/baixar o arquivo gerado
    function showPreview(url, type) {
        previewContainer.innerHTML = "";
        if (type === 'image') {
            const img = document.createElement("img");
            img.src = url;
            img.style.maxWidth = "100%";
            previewContainer.appendChild(img);
            downloadLink.download = "foto-ar.png";
        } else if (type === 'video') {
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            video.style.maxWidth = "100%";
            previewContainer.appendChild(video);
            downloadLink.download = "video-ar.mp4";
        }

        downloadLink.href = url;
        previewModal.style.display = "flex";
    }

    if (closeModal) {
        closeModal.addEventListener("click", () => {
            previewModal.style.display = "none";
        });
    }

    /* Restante das suas funções originais (showOverlay, hideOverlay, startAR) */
});