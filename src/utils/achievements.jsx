// src/utils/achievements.jsx

// Lista degli Obiettivi
export const ACHIEVEMENTS_LIST = [
    // --- LIVELLO BRONZO ---
    {
        id: 'first_step',
        title: 'Primi Passi',
        desc: 'Colora il tuo primo comune.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cd7f32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v-2.38C4 11.5 9.93 2 12 2s8 9.5 8 11.62V16a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V9h-4v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M12 18v3"></path><path d="M8 21h8"></path></svg>
    },
    {
        id: 'weekend',
        title: 'Weekend Fuoriporta',
        desc: 'Visita almeno 5 comuni.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cd7f32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
    },
    {
        id: 'roma',
        title: 'Caput Mundi',
        desc: 'Visita Roma, la Capitale.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cd7f32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><path d="M4 2v20"></path><path d="M20 2v20"></path><path d="M2 22h20"></path><path d="M2 2h20"></path><path d="M4 7h16"></path><path d="M4 17h16"></path></svg>
    },
    // --- LIVELLO ARGENTO ---
    {
        id: 'regions_3',
        title: 'Esploratore Regionale',
        desc: 'Visita comuni in 3 Regioni diverse.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
    },
    {
        id: 'serial_50',
        title: 'Viaggiatore Seriale',
        desc: 'Raggiungi 50 comuni visitati.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
    },
    {
        id: 'islands',
        title: 'Lupo di Mare',
        desc: 'Visita sia la Sicilia che la Sardegna.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>
    },
    // --- LIVELLO ORO ---
    {
        id: 'province_10',
        title: 'Cacciatore di Province',
        desc: '10 comuni nella stessa Provincia.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4 8 4v14"></path><path d="M17 21v-8.5a1.5 1.5 0 0 0-1.5-1.5h-7a1.5 1.5 0 0 0-1.5 1.5V21"></path></svg>
    },
    {
        id: 'giro_italia',
        title: 'Giro d\'Italia',
        desc: 'Visita tutte le 20 Regioni.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
    },
    {
        id: 'top_100',
        title: 'Il Centenario',
        desc: '100 comuni visitati. Leggenda.',
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
    }
];

// Funzione di calcolo
export const calculateAchievements = (visitedMap, geoData) => {
    if (!geoData || !visitedMap) return [];

    const visitedIds = Object.keys(visitedMap);
    const count = visitedIds.length;
    const unlockedIds = [];

    // Analisi Dati Geografici
    const regions = new Set();
    const provincesCount = {};
    let sicilia = false;
    let sardegna = false;
    let romaVisited = false;

    // Helper interno per estrarre ID (duplicato da App.js per sicurezza)
    const getID = (f) => f.properties.com_istat_code || f.properties.pro_com_t || f.properties.name;

    geoData.features.forEach(feature => {
        const id = getID(feature);
        if (visitedMap[id]) {
            // Dati Regione/Provincia
            const reg = feature.properties.reg_name;
            const prov = feature.properties.prov_name;
            const name = feature.properties.name;

            regions.add(reg);
            provincesCount[prov] = (provincesCount[prov] || 0) + 1;

            if (name === 'Roma') romaVisited = true;
            if (reg === 'Sicilia') sicilia = true;
            if (reg === 'Sardegna') sardegna = true;
        }
    });

    // --- CONTROLLO REGOLE ---

    // 1. Primi Passi
    if (count >= 1) unlockedIds.push('first_step');

    // 2. Weekend
    if (count >= 5) unlockedIds.push('weekend');

    // 3. Roma
    if (romaVisited) unlockedIds.push('roma');

    // 4. Regioni (3 diverse)
    if (regions.size >= 3) unlockedIds.push('regions_3');

    // 5. Seriale (50 comuni)
    if (count >= 50) unlockedIds.push('serial_50');

    // 6. Isole
    if (sicilia && sardegna) unlockedIds.push('islands');

    // 7. Province (10 nella stessa)
    const maxInProv = Math.max(...Object.values(provincesCount), 0);
    if (maxInProv >= 10) unlockedIds.push('province_10');

    // 8. Giro d'Italia (20 regioni)
    if (regions.size >= 20) unlockedIds.push('giro_italia');

    // 9. Centenario
    if (count >= 100) unlockedIds.push('top_100');

    return unlockedIds;
};