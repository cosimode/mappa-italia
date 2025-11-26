import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Componente invisibile che vive dentro <MapContainer>
function MapUtilities({ centerTo, setMapInstance }) {
    const map = useMap();

    // 1. Estrae l'istanza della mappa e la passa ad App.js
    // Questo è fondamentale per poter usare map.fitBounds() nel download
    useEffect(() => {
        setMapInstance(map);
    }, [map, setMapInstance]);

    // 2. Gestisce lo zoom fluido quando cerchi un comune
    useEffect(() => {
        if (centerTo) {
            const zoomLevel = window.innerWidth < 768 ? 9 : 11;
            map.flyTo(centerTo, zoomLevel, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [centerTo, map]);

    return null;
}

export default MapUtilities;