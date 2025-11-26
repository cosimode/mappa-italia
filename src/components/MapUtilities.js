import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

function MapUtilities({ centerTo, setMapInstance }) {
    const map = useMap();

    // 1. Estrae l'istanza della mappa SOLO SE la funzione esiste
    useEffect(() => {
        // CORREZIONE ERRORE: Controlliamo se setMapInstance è definita prima di chiamarla
        if (setMapInstance) {
            setMapInstance(map);
        }
    }, [map, setMapInstance]);

    // 2. Gestisce lo zoom fluido (questo serve per la ricerca)
    useEffect(() => {
        if (centerTo) {
            const zoomLevel = window.innerWidth < 768 ? 9 : 11;
            map.flyTo(centerTo, zoomLevel, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [centerTo, map]);

    return null;
}

export default MapUtilities;