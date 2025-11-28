import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as topojson from 'topojson-client';
import { ACHIEVEMENTS_LIST, calculateAchievements } from './utils/achievements.jsx';
import './App.css';

// Importazioni Modulari
import MapUtilities from './components/MapUtilities';

const PALETTE = [
    { color: '#FF5733', name: 'Coral' },
    { color: '#FFBD33', name: 'Mustard' },
    { color: '#33FF57', name: 'Green' },
    { color: '#335BFF', name: 'Azure' },
    { color: '#8E33FF', name: 'Purple' },
    { color: '#FF33A8', name: 'Pink' },
    { color: '#2ecc71', name: 'Emerald' },
    { color: '#34495e', name: 'Asphalt' }
];

function App() {
    // --- STATO CONDIVISIONE ---
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [sharedUsername, setSharedUsername] = useState(null); // Per il titolo "Mappa di..."
    // --- STATO GENERALE ---
    const [session, setSession] = useState(null);
    const [geoData, setGeoData] = useState(null);
    const [visited, setVisited] = useState({});
    const [selectedColor, setSelectedColor] = useState(PALETTE[0].color);

    // --- STATO CLASSIFICA (LEADERBOARD) ---
    const [leaderboard, setLeaderboard] = useState([]);
    const [leaderboardModal, setLeaderboardModal] = useState(false);

    // --- STATO OBIETTIVI (ACHIEVEMENTS) ---
    const [achievementsModal, setAchievementsModal] = useState(false);
    const [unlockedAchievements, setUnlockedAchievements] = useState([]);
    const [notification, setNotification] = useState(null); // <--- NUOVO
    const isFirstRun = useRef(true); // <--- NUOVO: Serve per non mostrare notifiche appena apri il sito

    // Ref per il "Silenzio Stampa"
    const isSilenced = useRef(true);

    // RESETTA IL SILENZIATORE AL LOGIN
    // Ogni volta che cambia la sessione (login/logout), attiviamo il silenzio per 2.5 secondi
    useEffect(() => {
        isSilenced.current = true;
        const timer = setTimeout(() => {
            isSilenced.current = false;
        }, 2500);
        return () => clearTimeout(timer);
    }, [session]);

    // --- STATO UI MOBILE ---
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

    // --- STATO DATI GEOGRAFICI & STATISTICHE ---
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [statsResults, setStatsResults] = useState([]);
    const [statsType, setStatsType] = useState('region');
    const [statsSelection, setStatsSelection] = useState('');

    // --- STATO RICERCA E MAPPA ---
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);

    // --- STATO AUTH ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [loading, setLoading] = useState(false);
    const [authMessage, setAuthMessage] = useState(null);
    const [authError, setAuthError] = useState(false);

    // --- STATO MODALI ---
    const [modal, setModal] = useState({ isOpen: false, type: null, feature: null });
    const [statsModal, setStatsModal] = useState(false);
    const [infoModal, setInfoModal] = useState(false);
    const [visitDate, setVisitDate] = useState('');
    const [useDate, setUseDate] = useState(false);

    // --- REFS ---
    const visitedRef = useRef({});
    useEffect(() => { visitedRef.current = visited; }, [visited]);
    const colorRef = useRef(selectedColor);
    useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
    const highlightRef = useRef(null);
    useEffect(() => { highlightRef.current = highlightedId; }, [highlightedId]);
    const sessionRef = useRef(null);
    useEffect(() => { sessionRef.current = session; }, [session]);

    // --- CALCOLI ---
    const totalComuni = geoData ? geoData.features.length : 7904;
    const visitedCount = Object.keys(visited).length;
    const progressPercentage = totalComuni > 0 ? ((visitedCount / totalComuni) * 100).toFixed(2) : 0;

    // --- EFFETTO CALCOLO OBIETTIVI E NOTIFICHE ---
    useEffect(() => {
        const calculated = calculateAchievements(visited, geoData);

        // Se siamo in fase di "Silenzio" (Appena aperto o Appena loggato)
        // Salviamo lo stato SENZA mostrare notifiche.
        if (isSilenced.current) {
            setUnlockedAchievements(calculated);
            return;
        }

        // Logica normale: se c'è un nuovo obiettivo, mostra notifica
        if (calculated.length > unlockedAchievements.length) {
            const newId = calculated.find(id => !unlockedAchievements.includes(id));

            if (newId) {
                const badgeDetails = ACHIEVEMENTS_LIST.find(a => a.id === newId);
                setNotification(badgeDetails);
                setTimeout(() => setNotification(null), 4000);
            }
        }

        setUnlockedAchievements(calculated);

    }, [visited, geoData]);

    // 1. INIT & AUTH & CONDIVISIONE
    useEffect(() => {
        // SPOSTATO IN CIMA: Carica la classifica subito per TUTTI (Ospiti e Proprietari)
        fetchLeaderboard();

        const params = new URLSearchParams(window.location.search);
        const sharedUserId = params.get('u');
        const sharedName = params.get('n');

        // Variabile per gestire la disiscrizione in modo sicuro
        let authListener = null;

        if (sharedUserId) {
            // --- MODALITÀ OSPITE ---
            setIsReadOnly(true);
            setSharedUsername(sharedName || 'Un viaggiatore');
            fetchVisitedPlaces(sharedUserId);
        } else {
            // --- MODALITÀ PROPRIETARIO ---
            supabase.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                if (session) fetchVisitedPlaces(session.user.id);
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
                if (session) fetchVisitedPlaces(session.user.id);
                else setVisited({});
            });
            // Salviamo la sottoscrizione nella variabile invece di fare return subito
            authListener = subscription;
        }

        // Funzione di pulizia finale corretta
        return () => {
            if (authListener) authListener.unsubscribe();
        };
    }, []);

    // 2. FETCH CLASSIFICA
    const fetchLeaderboard = async () => {
        try {
            const { data, error } = await supabase.rpc('get_leaderboard');
            if (!error && data) {
                setLeaderboard(data);
            }
        } catch (err) {
            console.error("Errore classifica:", err);
        }
    };

    // 3. CARICA I DATI DAL DATABASE
    const fetchVisitedPlaces = async (userId) => {
        const { data, error } = await supabase
            .from('visited_places')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Errore caricamento:', error);
        } else if (data) {
            const visitedMap = {};
            data.forEach(item => {
                visitedMap[item.comune_id] = { color: item.color, date: item.visit_date };
            });
            setVisited(visitedMap);
        }
    };

    // 4. CARICAMENTO MAPPA
    useEffect(() => {
        fetch('https://raw.githubusercontent.com/openpolis/geojson-italy/master/topojson/limits_IT_municipalities.topo.json')
            .then(res => res.json())
            .then(data => {
                const keyName = Object.keys(data.objects)[0];
                const comuni = topojson.feature(data, data.objects[keyName]);
                setTimeout(() => {
                    comuni.features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
                    setGeoData(comuni);

                    const uniqueRegions = new Set();
                    const uniqueProvinces = new Set();
                    comuni.features.forEach(f => {
                        uniqueRegions.add(f.properties.reg_name);
                        uniqueProvinces.add(f.properties.prov_name);
                    });
                    setRegions(Array.from(uniqueRegions).sort());
                    setProvinces(Array.from(uniqueProvinces).sort());
                }, 0);
            });
    }, []);

    // LOGICA AUTH
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthMessage(null);
        setAuthError(false);

        try {
            if (isLoginMode) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                if (!username) { throw new Error("Inserisci un nome utente."); }
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin.includes('localhost')
                            ? 'http://localhost:5173'
                            : 'https://cosimode.github.io/mappa-italia/',
                        data: { username: username }
                    }
                });
                if (error) throw error;
                if (!data.session) {
                    setAuthMessage("Controlla la tua email per confermare l'account.");
                    setAuthError(false);
                }
            }
        } catch (error) {
            setAuthMessage(error.message);
            setAuthError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("SEI SICURO? Questa azione cancellerà per sempre il tuo account e la tua mappa. Non si può annullare.")) return;

        setLoading(true);
        const { error } = await supabase.rpc('delete_own_account');

        if (error) {
            alert("Errore eliminazione: " + error.message);
        } else {
            await supabase.auth.signOut();
            setSession(null);
            alert("Account eliminato correttamente.");
        }
        setLoading(false);
    };

    const handleLogout = async () => await supabase.auth.signOut();

    // --- FUNZIONE GPS (POTENZIATA) ---
    const handleGPS = () => {
        if (!navigator.geolocation) {
            alert("Il tuo browser non supporta il GPS.");
            return;
        }
        if (!geoData) return;

        setLoading(true);

        // Opzioni per forzare la massima precisione
        const options = {
            enableHighAccuracy: true, // Usa GPS reale se disponibile
            timeout: 10000,           // Aspetta fino a 10 secondi per avere il segnale migliore
            maximumAge: 0             // IMPORTANTE: Ignora la posizione vecchia in cache
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;

                console.log(`Precisione rilevata: ${accuracy} metri`);

                // Cerca il comune corrispondente
                const foundFeature = geoData.features.find(feature =>
                    isPointInFeature(latitude, longitude, feature)
                );

                setLoading(false);

                if (foundFeature) {
                    handleMapClick(foundFeature);

                    // Zooma sul comune trovato
                    const layer = L.geoJSON(foundFeature);
                    setMapCenter(layer.getBounds().getCenter());
                } else {
                    alert("Non riesco a trovare il comune esatto. Riprova vicino a una finestra!");
                }
            },
            (error) => {
                setLoading(false);
                console.error(error);
                let errorMsg = "Errore GPS.";
                if (error.code === 1) errorMsg = "Permesso GPS negato.";
                if (error.code === 2) errorMsg = "Segnale GPS assente (sei al chiuso?).";
                if (error.code === 3) errorMsg = "Tempo scaduto per il GPS.";
                alert(errorMsg);
            },
            options // Passiamo le nuove opzioni
        );
    };

    // 5. LOGICA STATISTICHE UTENTE
    useEffect(() => {
        if (!geoData || !statsSelection) {
            setStatsResults([]);
            return;
        }
        const stats = {};
        const isRegion = statsType === 'region';
        const targetProp = isRegion ? 'reg_name' : 'prov_name';
        const filteredFeatures = geoData.features.filter(f => f.properties[targetProp] === statsSelection);
        const totalCount = filteredFeatures.length;
        let localVisitedCount = 0;

        filteredFeatures.forEach(f => {
            const id = getComuneId(f);
            if (visitedRef.current[id]) localVisitedCount++;
        });

        setStatsResults({
            selection: statsSelection,
            total: totalCount,
            visited: localVisitedCount,
            percentage: totalCount > 0 ? ((localVisitedCount / totalCount) * 100).toFixed(1) : 0
        });
    }, [statsSelection, statsType, geoData, visited]);

    // 6. GESTIONE MAPPA (Aggiornata per sola lettura)
    const handleMapClick = (feature) => {
        // Se sei ospite, puoi solo vedere info, non aggiungere
        if (isReadOnly) {
            const id = getComuneId(feature);
            if (visitedRef.current[id]) {
                setModal({ isOpen: true, type: 'INFO', feature: feature });
            }
            return;
        }

        // Comportamento standard
        if (!sessionRef.current) {
            setIsMobilePanelOpen(true);
            return;
        }
        const id = getComuneId(feature);
        const existingVisit = visitedRef.current[id];
        setVisitDate(''); setUseDate(false);
        if (existingVisit) setModal({ isOpen: true, type: 'INFO', feature: feature });
        else setModal({ isOpen: true, type: 'ADD', feature: feature });
    };

    const confirmAdd = async () => {
        const feature = modal.feature;
        const id = getComuneId(feature);
        const name = feature.properties.name;
        const userId = session.user.id;
        const color = colorRef.current;
        const dateToSave = useDate ? visitDate : null;

        setVisited(prev => ({ ...prev, [id]: { color: color, date: dateToSave } }));
        closeModal();

        // Salva e poi aggiorna la classifica globale
        await supabase
            .from('visited_places')
            .upsert([{ user_id: userId, comune_id: id, comune_name: name, color: color, visit_date: dateToSave }], { onConflict: 'user_id, comune_id' });

        // Aggiorna classifica dopo un po' per dare tempo al DB
        setTimeout(fetchLeaderboard, 1000);
    };

    const confirmDelete = async () => {
        const feature = modal.feature;
        const id = getComuneId(feature);
        const userId = session.user.id;

        setVisited(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
        closeModal();

        await supabase.from('visited_places').delete().eq('user_id', userId).eq('comune_id', id);
        setTimeout(fetchLeaderboard, 1000);
    };

    const closeModal = () => setModal({ isOpen: false, type: null, feature: null });
    const openStats = () => setStatsModal(true);
    const closeStats = () => { setStatsModal(false); setStatsSelection(''); }

    const getComuneId = (feature) => feature.properties.com_istat_code || feature.properties.pro_com_t || feature.properties.name;

    useEffect(() => {
        if (!geoData || searchText.length < 2) { setSearchResults([]); return; }
        const results = geoData.features.filter(f => f.properties.name.toLowerCase().includes(searchText.toLowerCase()));
        setSearchResults(results.slice(0, 5));
    }, [searchText, geoData]);

    const handleSelectComune = (feature) => {
        const layer = L.geoJSON(feature);
        setMapCenter(layer.getBounds().getCenter());
        setHighlightedId(getComuneId(feature));
        setSearchText('');
        setSearchResults([]);
        setIsMobilePanelOpen(false);
    };

    const style = (feature) => {
        const id = getComuneId(feature);
        const data = visited[id];
        const isHighlighted = (id === highlightedId);
        return {
            fillColor: data ? data.color : '#ffffff',
            weight: isHighlighted ? 3 : 0.3,
            color: isHighlighted ? '#FFD700' : '#444',
            opacity: 1,
            fillOpacity: 1
        };
    };

    const onEachFeature = (feature, layer) => {
        if(window.innerWidth > 768) {
            layer.bindTooltip(feature.properties.name, { permanent: false, direction: "center", className: 'my-tooltip' });
        }
        layer.on({
            click: (e) => { L.DomEvent.stopPropagation(e); if (highlightedId) setHighlightedId(null); handleMapClick(feature); }
        });
    };

    // Componente Classifica (RIUTILIZZABILE)
    const LeaderboardContent = () => (
        <>
            <div className="leaderboard-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px'}}>
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M4 22h16"></path>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                </svg>
                Top Esploratori
            </div>
            <ul className="leaderboard-list">
                {leaderboard.length > 0 ? leaderboard.map((user, index) => (
                    <li
                        key={index}
                        className="leaderboard-item"
                        title="Clicca per vedere la mappa"
                        style={{cursor: 'pointer', transition: 'background 0.2s'}}
                        // QUANDO CLICCHI, VAI ALLA SUA MAPPA
                        onClick={() => {
                            window.location.href = `${window.location.pathname}?u=${user.user_id}&n=${encodeURIComponent(user.username)}`;
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{display:'flex', alignItems:'center'}}>
                            <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
                            <span style={{fontWeight:500, color: '#333'}}>{user.username}</span>
                        </div>
                        <span className="user-score">{user.score}</span>
                    </li>
                )) : (
                    <li style={{color:'#999', fontSize:'0.8rem'}}>Nessun dato ancora...</li>
                )}
            </ul>
            <div style={{fontSize:'0.7rem', color:'#999', marginTop:'10px', textAlign:'center', fontStyle:'italic'}}>
                Clicca su un utente per vedere la sua mappa! 🗺️
            </div>
        </>
    );

    const AchievementsContent = () => {
        // Calcoliamo la percentuale sbloccata
        const percent = Math.round((unlockedAchievements.length / ACHIEVEMENTS_LIST.length) * 100);

        return (
            <div style={{textAlign: 'left'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                    <h3 style={{margin:0}}>I Tuoi Obiettivi</h3>
                    <span style={{fontSize:'0.8rem', fontWeight:600, color:'#3b82f6'}}>{percent}% Completato</span>
                </div>

                {/* Progress Bar Obiettivi */}
                <div className="progress-track" style={{marginBottom:'20px', height:'6px'}}>
                    <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: '#3b82f6' }}/>
                </div>

                <div className="achievements-grid">
                    {ACHIEVEMENTS_LIST.map(ach => {
                        const isUnlocked = unlockedAchievements.includes(ach.id);
                        return (
                            <div key={ach.id} className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                                <div className="ach-icon-container">
                                    {isUnlocked ? ach.icon : (
                                        // Lucchetto Grande al posto dell'icona se vuoi,
                                        // oppure icona grigia + lucchetto piccolo a destra (scelto questo sotto)
                                        <div style={{filter: 'grayscale(100%) opacity(0.5)'}}>{ach.icon}</div>
                                    )}
                                </div>
                                <div className="ach-info">
                                    <h4>{ach.title}</h4>
                                    <p>{ach.desc}</p>
                                </div>
                                {!isUnlocked && (
                                    <div className="lock-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    return (
        <div style={{ height: "100vh", width: "100vw", position: 'relative', overflow: 'hidden' }}>

            {/* --- LEADERBOARD DESKTOP (Fissa a destra) --- */}
            <div className="leaderboard-panel">
                <LeaderboardContent />
            </div>

            {/* SIDEBAR / BOTTOM SHEET */}
            <div className={`control-panel ${isMobilePanelOpen ? 'open' : ''}`}>
                <div className="panel-header" onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}>
                    <div>
                        <h1>Tracce</h1>
                        <p className="subtitle" style={{marginBottom:0}}>
                            <span className="desktop-text">Colora i luoghi che hai visitato</span>
                            <span className="mobile-text">
                                {isMobilePanelOpen ? 'Chiudi menu' : 'Tocca per aprire'}
                            </span>
                        </p>
                    </div>
                    <div className="menu-icon-container">
                        {isMobilePanelOpen ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        )}
                    </div>
                </div>

                <div className="panel-content">

                    {/* 1. HEADER "DI CHI È LA MAPPA" (Visibile SOLO se sei sul link condiviso) */}
                    {isReadOnly && (
                        <div className="user-header-row" style={{background: '#f0f9ff', padding: '10px', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: '20px'}}>
                            <div>
                                <span style={{fontSize: '0.7rem', color:'#0ea5e9', display:'block', fontWeight:700, letterSpacing:'0.5px'}}>L'ITALIA DI:</span>
                                <b style={{fontSize:'1.1rem', color:'#0284c7'}}>{sharedUsername}</b>
                            </div>
                            <button onClick={() => window.location.href = window.location.origin + window.location.pathname} className="btn-cancel" style={{fontSize:'0.8rem', padding:'6px 12px', background:'white', border:'1px solid #bae6fd', color:'#0284c7'}}>
                                Crea la tua
                            </button>
                        </div>
                    )}

                    {/* HEADER UTENTE PROPRIETARIO (Se sei loggato) */}
                    {session && !isReadOnly && (
                        <div className="user-header-row">
                            <span className="welcome-text">
                                Ciao <b>{session.user.user_metadata.username || session.user.email.split('@')[0]}</b>
                            </span>
                            <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={handleLogout} className="btn-cancel logout-btn">Esci</button>
                                <button onClick={handleDeleteAccount} className="btn-delete logout-btn" title="Elimina Account" style={{background:'#fee2e2', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. PERCENTUALE COMPLETAMENTO (Visibile a TUTTI) */}
                    <div className="control-group" style={{marginTop: (session || isReadOnly) ? '0' : '10px'}}>
                        <div className="progress-label">
                            <span>Completamento</span>
                            <span>{progressPercentage}%</span>
                        </div>
                        <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${progressPercentage}%`, backgroundColor: '#28a745' }}/>
                        </div>
                        <p style={{fontSize: '0.75rem', color: '#999', marginTop: '5px'}}>
                            {visitedCount} su {totalComuni} comuni
                        </p>
                    </div>

                    {/* FORM DI ACCESSO (Nascosto per gli ospiti) */}
                    {!session && !isReadOnly && (
                        <div className="auth-section" style={{marginBottom: '20px'}}>
                            <div style={{display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px'}}>
                                <div onClick={() => { setIsLoginMode(true); setAuthMessage(null); }} style={{flex:1, padding:'10px', textAlign:'center', cursor:'pointer', fontWeight:600, borderBottom: isLoginMode ? '2px solid #333' : 'none', color: isLoginMode ? '#333' : '#999'}}>Accedi</div>
                                <div onClick={() => { setIsLoginMode(false); setAuthMessage(null); }} style={{flex:1, padding:'10px', textAlign:'center', cursor:'pointer', fontWeight:600, borderBottom: !isLoginMode ? '2px solid #333' : 'none', color: !isLoginMode ? '#333' : '#999'}}>Registrati</div>
                            </div>
                            <form onSubmit={handleAuth}>
                                {!isLoginMode && ( <input className="search-input" type="text" placeholder="Scegli un Nome Utente" value={username} onChange={e=>setUsername(e.target.value)} required style={{marginBottom:'10px'}}/> )}
                                <input className="search-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{marginBottom:'5px'}}/>
                                <input className="search-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={{marginBottom:'10px'}}/>
                                {!isLoginMode && ( <p style={{fontSize:'0.65rem', color:'#666', marginBottom:'10px', lineHeight:'1.2'}}>* La password deve avere almeno 8 caratteri, una lettera e un numero.</p> )}
                                <button type="submit" disabled={loading} className="btn-confirm" style={{width:'100%', background:'#333'}}>{loading ? 'Attendere...' : (isLoginMode ? 'Entra' : 'Crea Account')}</button>
                            </form>
                            {authMessage && ( <div style={{fontSize:'0.8rem', marginTop:'10px', padding: '8px', borderRadius: '6px', backgroundColor: authError ? '#fee2e2' : '#dcfce7', color: authError ? '#991b1b' : '#166534', border: `1px solid ${authError ? '#fecaca' : '#bbf7d0'}`}}>{authMessage}</div> )}
                        </div>
                    )}

                    {/* RICERCA (Utile anche per gli ospiti per vedere se hai visitato un posto) */}
                    <div className="control-group">
                        <label>Cerca</label>
                        <input className="search-input" type="text" placeholder="Digita comune..." value={searchText} onChange={e=>setSearchText(e.target.value)}/>

                        {/* GPS (Nascosto per gli ospiti) */}
                        {!isReadOnly && (
                            <button onClick={handleGPS} className="gps-btn" disabled={loading} style={{marginTop:'10px'}}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
                                {loading ? 'Cerco posizione...' : 'Colora dove sono ora'}
                            </button>
                        )}

                        {searchResults.length > 0 && (
                            <ul className="search-results">
                                {searchResults.map((f, i) => (
                                    <li key={i} className="search-result-item" onClick={()=>handleSelectComune(f)}>{f.properties.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* COLORI (Nascosti per gli ospiti) */}
                    {!isReadOnly && (
                        <div className="control-group">
                            <label>Colore Pennarello</label>
                            <div className="color-options">
                                {PALETTE.map((p) => (
                                    <div key={p.color} className={`color-circle ${selectedColor===p.color?'selected':''}`} style={{ backgroundColor: p.color }} onClick={() => setSelectedColor(p.color)}/>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="stats" style={{borderTop:'none', paddingTop:0}}>
                        {/* Bottoni di gestione (Nascosti per gli ospiti) */}
                        {session && !isReadOnly && (
                            <>
                                <button onClick={openStats} className="stats-button primary-btn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line><path d="M10 6h4"></path><path d="M10 18h4"></path></svg>
                                    Vedi Statistiche
                                </button>
                                <button onClick={() => setAchievementsModal(true)} className="stats-button" style={{backgroundColor: '#fff', color:'#333', border:'1px solid #ddd'}}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                                    I miei Obiettivi
                                </button>
                                <button onClick={() => setLeaderboardModal(true)} className="mobile-leaderboard-btn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                                    Classifica Top 3
                                </button>
                                <button onClick={() => {
                                    const url = `${window.location.origin}${window.location.pathname}?u=${session.user.id}&n=${encodeURIComponent(session.user.user_metadata.username || 'Utente')}`;
                                    navigator.clipboard.writeText(url);
                                    setNotification({
                                        type: 'system',
                                        title: 'Link Copiato',
                                        desc: 'Indirizzo salvato negli appunti.',
                                        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    });
                                    setTimeout(() => setNotification(null), 3000);
                                }} className="stats-button" style={{backgroundColor: '#8b5cf6', color: 'white'}}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                    Condividi Mappa
                                </button>
                            </>
                        )}

                        {/* 3. OFFRIMI UN CAFFÈ (VISIBILE A TUTTI, anche agli ospiti!) */}
                        <a href="https://ko-fi.com/depas" target="_blank" rel="noopener noreferrer" className="coffee-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                            Sostienimi
                        </a>

                        {/* FOOTER MIGLIORATO E ALLINEATO */}
                        <div className="app-footer" style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px', textAlign: 'center'}}>
                            <p style={{margin: '0 0 5px 0', fontSize: '0.75rem', color: '#666'}}>
                                <b>Tracce</b> v1.0 • Sviluppato da <b>CoDe</b>
                            </p>
                            <p style={{margin: '0 0 10px 0', fontSize: '0.65rem', color: '#999'}}>
                                Icone by <a href="https://www.flaticon.com/" target="_blank" rel="noreferrer" style={{color:'#999'}}>Flaticon</a> • Mappa by OpenPolis
                            </p>

                            {/* MENU LINK: Uso Flexbox con gap per allineamento perfetto */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                flexWrap: 'wrap',       /* Permette di andare a capo */
                                gap: '15px',            /* Spazio tra gli elementi */
                                rowGap: '5px',          /* Spazio tra le righe se va a capo */
                                fontSize: '0.75rem'
                            }}>
                                <a href="https://github.com/cosimode" target="_blank" rel="noreferrer" style={{color:'#3b82f6', textDecoration:'none', fontWeight: 500}}>GitHub</a>

                                <span onClick={() => setInfoModal(true)} style={{color:'#3b82f6', cursor:'pointer', fontWeight: 600}}>
                                    Cosa vale come visita?
                                </span>

                                <span style={{color:'#999', cursor:'help', borderBottom: '1px dotted #999'}} title="I dati sono salvati in modo sicuro e anonimo.">
                                    Privacy
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENITORE MAPPA */}
            <div style={{ height: "100%", width: "100%", position: 'relative', zIndex: 1 }}>
                <MapContainer center={[42.0, 12.5]} zoom={6} style={{ height: "100%", width: "100%", backgroundColor: '#eef2f3' }} minZoom={5} zoomControl={false}>
                    <MapUtilities centerTo={mapCenter} />
                    <TileLayer attribution='' url="" />
                    {geoData && <GeoJSON key={highlightedId || 'initial'} data={geoData} style={style} onEachFeature={onEachFeature} />}
                </MapContainer>
            </div>

            {/* MODALE POPUP AGGIUNTA */}
            {modal.isOpen && modal.feature && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') closeModal() }}>
                    <div className="modal-content">
                        <h2 style={{marginTop: 0}}>{modal.feature.properties.name}</h2>
                        <div style={{fontSize:'0.9rem', color:'#666', marginBottom:'15px'}}>{modal.feature.properties.prov_name} ({modal.feature.properties.reg_name})</div>
                        {modal.type === 'ADD' ? (
                            <>
                                <p style={{marginBottom:'20px'}}>Vuoi colorare questo luogo?</p>
                                <div style={{marginBottom:'20px'}}>
                                    <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '10px'}}><input type="checkbox" checked={useDate} onChange={e => setUseDate(e.target.checked)} style={{marginRight: '10px'}}/>Aggiungi Data</label>
                                    {useDate && (<input type="date" className="search-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={{textAlign: 'center'}}/>)}
                                </div>
                                <div className="modal-actions">
                                    <button className="btn-cancel" onClick={closeModal}>Annulla</button>
                                    <button className="btn-confirm" onClick={confirmAdd} style={{backgroundColor: selectedColor}}>Salva</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{margin: '10px 0', padding: '15px', background: '#f8f9fa', borderRadius: '12px', border:'1px solid #eee'}}>
                                    <div style={{display:'flex', alignItems:'center', gap:'10px', justifyContent:'center'}}>
                                        <div style={{width:'20px', height:'20px', borderRadius:'50%', background: visited[getComuneId(modal.feature)]?.color}}></div>
                                        <span style={{fontWeight:600}}>Visitato</span>
                                    </div>
                                    {visited[getComuneId(modal.feature)]?.date && (
                                        <div style={{marginTop:'12px', fontSize:'0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>{visited[getComuneId(modal.feature)].date}</div>
                                    )}
                                </div>
                                <div className="modal-actions">
                                    <button className="btn-cancel" onClick={closeModal}>Chiudi</button>
                                    <button className="btn-delete" onClick={confirmDelete}>Rimuovi</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODALE STATISTICHE */}
            {statsModal && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') closeStats() }}>
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <h3>Statistiche 🇮🇹</h3>
                        <div className="control-group" style={{display: 'flex', gap: '10px', flexDirection:'column'}}>
                            <select value={statsType} onChange={(e) => {setStatsType(e.target.value); setStatsSelection('');}} className="search-input"><option value="region">Per Regione</option><option value="province">Per Provincia</option></select>
                            <select value={statsSelection} onChange={(e) => setStatsSelection(e.target.value)} className="search-input"><option value="">Seleziona zona...</option>{statsType === 'region' ? regions.map(r => <option key={r} value={r}>{r}</option>) : provinces.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        </div>
                        {statsSelection && statsResults.total > 0 && (
                            <div style={{marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '10px', background: '#f9f9f9'}}>
                                <h4 style={{margin:'0 0 10px 0'}}>{statsSelection}</h4>
                                <div className="progress-track" style={{marginBottom:'10px'}}><div className="progress-fill" style={{ width: `${statsResults.percentage}%`, backgroundColor: '#3b82f6' }}/></div>
                                <div>{statsResults.visited} / {statsResults.total} Comuni ({statsResults.percentage}%)</div>
                            </div>
                        )}
                        <div className="modal-actions"><button className="btn-confirm" onClick={closeStats} style={{backgroundColor: '#333'}}>Chiudi</button></div>
                    </div>
                </div>
            )}

            {/* MODALE CLASSIFICA (SOLO MOBILE) */}
            {leaderboardModal && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') setLeaderboardModal(false) }}>
                    <div className="modal-content" style={{maxWidth: '400px'}}>
                        <LeaderboardContent />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setLeaderboardModal(false)}>Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE OBIETTIVI */}
            {achievementsModal && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') setAchievementsModal(false) }}>
                    <div className="modal-content" style={{maxWidth: '450px'}}>
                        <AchievementsContent />
                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={() => setAchievementsModal(false)} style={{backgroundColor: '#333'}}>Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* NOTIFICA TOAST (GENERALE) */}
            {notification && (
                <div className="achievement-toast">
                    <div className="toast-icon">
                        {notification.icon}
                    </div>
                    <div className="toast-content">
                        {/* Se è una notifica di sistema (tipo il link) usa il suo titolo,
                            altrimenti (se è un obiettivo) scrive "Obiettivo Sbloccato!" */}
                        <h4>{notification.type === 'system' ? notification.title : 'Obiettivo Sbloccato!'}</h4>

                        {/* Se è sistema mostra la descrizione, se è un obiettivo mostra il nome del badge */}
                        <p>{notification.desc || notification.title}</p>
                    </div>
                </div>
            )}

            {/* MODALE REGOLE "VISITATO" (Testo Originale + Scroll) */}
            {infoModal && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') setInfoModal(false) }}>
                    {/* AGGIUNTO: maxHeight e overflowY per lo scorrimento */}
                    <div className="modal-content" style={{maxWidth: '450px', textAlign:'left', maxHeight: '80vh', overflowY: 'auto'}}>

                        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
                            <div style={{background:'#e0f2fe', padding:'8px', borderRadius:'50%', color:'#0284c7', flexShrink:0}}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h3 style={{margin:0}}>Definizione di "Visita"</h3>
                        </div>

                        <p style={{fontSize:'0.9rem', color:'#444', lineHeight:'1.5'}}>
                            Per rendere la tua mappa veritiera, seguiamo le linee guida internazionali dei viaggiatori (ispirate a <a href="https://nomadmania.com/minimal-visit/" target="_blank" rel="noreferrer" style={{color:'#3b82f6'}}>NomadMania</a>).
                        </p>

                        <div style={{background:'#f8fafc', padding:'15px', borderRadius:'10px', border:'1px solid #e2e8f0', margin:'15px 0'}}>
                            <h4 style={{margin:'0 0 10px 0', fontSize:'0.95rem', color:'#1e293b'}}>✅ Conta come visita se:</h4>
                            <ul style={{margin:0, paddingLeft:'20px', fontSize:'0.85rem', color:'#334155', display:'flex', flexDirection:'column', gap:'8px'}}>
                                <li>Hai <strong>toccato terra</strong> e fatto qualcosa di significativo (non basta fermarsi al semaforo!).</li>
                                <li>Hai interagito con il luogo (es. preso un caffè al bar, visitato la piazza principale, fatto una passeggiata).</li>
                                <li>Hai visitato un museo, un monumento o un negozio locale.</li>
                            </ul>
                        </div>

                        <div style={{background:'#fef2f2', padding:'15px', borderRadius:'10px', border:'1px solid #fecaca'}}>
                            <h4 style={{margin:'0 0 10px 0', fontSize:'0.95rem', color:'#991b1b'}}>❌ NON conta se:</h4>
                            <ul style={{margin:0, paddingLeft:'20px', fontSize:'0.85rem', color:'#7f1d1d', display:'flex', flexDirection:'column', gap:'8px'}}>
                                <li>Sei solo passato in auto/treno/bus senza scendere.</li>
                                <li>Sei passato in autostrada o tangenziale.</li>
                                <li>Hai fatto solo scalo in aeroporto senza uscire.</li>
                            </ul>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={() => setInfoModal(false)} style={{backgroundColor: '#333', width:'100%'}}>Ho capito, sarò onesto!</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

// --- FUNZIONI PER CALCOLO GEOMETRICO ---

function isPointInFeature(lat, lng, feature) {
    if (feature.geometry.type === 'Polygon') {
        return isPointInPolygon(lat, lng, feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === 'MultiPolygon') {
        // Controlla tutte le "isole" o parti del comune
        for (let i = 0; i < feature.geometry.coordinates.length; i++) {
            if (isPointInPolygon(lat, lng, feature.geometry.coordinates[i][0])) {
                return true;
            }
        }
    }
    return false;
}

// Algoritmo Ray-Casting per vedere se un punto è dentro un poligono
function isPointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        let xi = poly[i][1], yi = poly[i][0];
        let xj = poly[j][1], yj = poly[j][0];

        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}