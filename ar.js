document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    const overlay = document.getElementById("ar-overlay");
    const startButton = document.getElementById("start-ar-from-overlay");
    const modelViewer = document.getElementById("modelo-ar");

    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isAndroid && modelViewer) {
        modelViewer.scale = "2.5 2.5 2.5";
    }

    function showOverlay() {
        if (!overlay) return;

        if (modelViewer) {
            modelViewer.scrollIntoView({ 
                behavior: isIOS ? "auto" : "smooth", 
                block: "center" 
            });
        }

        overlay.classList.add("overlay-active");
    }

    function hideOverlay() {
        if (!overlay) return;

        // Remove a classe do overlay
        overlay.classList.remove("overlay-active");

        // Tirar o foco de botões para fechar eventuais seleções virtuais do iOS
        if (document.activeElement) {
            document.activeElement.blur();
        }

        // TRUQUE DEFINITIVO PARA SAFARI/iOS:
        // Força a remoção de trava de gestos no body e reavalia a viewport
        if (isIOS) {
            document.body.style.pointerEvents = 'none';
            
            // Força um reflow síncrono para o Safari entender que a camada mudou
            void document.body.offsetHeight;
            
            document.body.style.pointerEvents = '';
        }
    }

    if (modelViewer) {
        modelViewer.addEventListener('ar-status', (event) => {
            if (event.detail.status === 'not-presenting' || event.detail.status === 'failed') {
                hideOverlay();
            }
        });
    }

    function startAR() {
        if (!modelViewer) {
            alert("AR model not found on this page.");
            return;
        }

        hideOverlay();

        try {
            if (typeof modelViewer.dismissPoster === "function") {
                modelViewer.dismissPoster();
            }
            modelViewer.play();

            if (typeof modelViewer.activateAR === "function") {
                modelViewer.activateAR();
            } else {
                const nativeArButton = modelViewer.querySelector('[slot="ar-button"]');

                if (nativeArButton) {
                    nativeArButton.click();
                } else {
                    alert("Augmented Reality is not available on this device/browser.");
                }
            }
        } catch (error) {
            console.error("Error starting AR:", error);
            alert("Unable to start Augmented Reality on this device/browser.");
        }
    }

    if (mode === "ar") {
        showOverlay();
    }

    if (startButton) {
        startButton.addEventListener("click", function (event) {
            event.preventDefault();
            startAR();
        });
    }
});