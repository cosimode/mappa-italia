import html2canvas from 'html2canvas';

/**
 * Gestisce la logica complessa per scaricare la mappa in formato Storia (9:16).
 * Forza il ridimensionamento del container, adatta lo zoom e scatta la foto.
 */
export const handleDownloadLogic = async ({
                                              mapInstance,
                                              mapContainerRef,
                                              originalStyle,
                                              originalCenter,
                                              originalZoom,
                                              IT_BOUNDS,
                                              siteUrl
                                          }) => {
    // Dimensioni Target: Verticale HD (Instagram Story)
    const targetWidth = 1080;
    const targetHeight = 1920;
    const isMobile = window.innerWidth < 768;

    // 1. FORZA DIMENSIONI E POSIZIONE DEL CONTAINER
    // Lo rendiamo invisibile ma fisso a 1080x1920 per il rendering
    mapContainerRef.current.style.width = `${targetWidth}px`;
    mapContainerRef.current.style.height = `${targetHeight}px`;
    mapContainerRef.current.style.visibility = 'hidden'; // Nascondi all'utente
    mapContainerRef.current.style.position = 'fixed';
    mapContainerRef.current.style.top = '0';
    mapContainerRef.current.style.left = '0';
    mapContainerRef.current.style.zIndex = '-9999';

    // 2. AGGIORNA LEAFLET
    // Diciamo alla mappa che le dimensioni sono cambiate
    mapInstance.invalidateSize(true);
    // Zoomiamo per far entrare tutta l'Italia nel nuovo rettangolo verticale
    mapInstance.fitBounds(IT_BOUNDS, { padding: [100, 100], animate: false, duration: 0 });

    // 3. ATTESA TECNICA
    // Diamo tempo (500ms) a Leaflet di caricare le "tiles" mancanti nella nuova visuale
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. SCATTA LA FOTO (CATTURA)
    const mapCanvas = await html2canvas(mapContainerRef.current, {
        scale: isMobile ? 1.5 : 2, // Scala ridotta su mobile per evitare crash di memoria
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#eef2f3', // Colore mare
        // Ignora i pulsanti di controllo zoom durante la foto
        ignoreElements: (element) =>
            element.classList.contains('control-panel') ||
            element.classList.contains('leaflet-control-container')
    });

    // 5. CREA IL POSTER FINALE (CANVAS)
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const ctx = finalCanvas.getContext('2d');

    // Sfondo Mare e Incolla Mappa
    ctx.fillStyle = '#eef2f3';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(mapCanvas, 0, 0, targetWidth, targetHeight);

    // 6. DISEGNA IL WATERMARK
    const footerHeight = 160;
    const footerY = targetHeight - footerHeight;

    // Barra bianca sfumata
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, footerY, targetWidth, footerHeight);

    // Testi
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Titolo
    ctx.font = 'bold 55px "Poppins", sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText('Diario Italia 🇮🇹 - Tracce', targetWidth / 2, footerY + 50);

    // Sito Web
    ctx.font = '400 32px "Poppins", sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText(siteUrl, targetWidth / 2, footerY + 110);

    // 7. AVVIA IL DOWNLOAD
    const image = finalCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const link = document.createElement('a');
    link.download = `tracce-mappa-${new Date().toISOString().slice(0,10)}.png`;
    link.href = image;
    link.click();
};