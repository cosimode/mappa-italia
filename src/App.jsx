import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as topojson from 'topojson-client';
import './App.css';

// Componente per lo zoom fluido
function MapController({ centerTo }) {
    const map = useMap();
    useEffect(() => {
        if (centerTo) {
            // Su mobile zoomiamo un po' meno per avere contesto
            const zoomLevel = window.innerWidth < 768 ? 9 : 11;
            map.flyTo(centerTo, zoomLevel, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [centerTo]);
    return null;
}

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
    // --- STATO ---
    const [session, setSession] = useState(null);
    const [geoData, setGeoData] = useState(null);
    const [visited, setVisited] = useState({});
    const [selectedColor, setSelectedColor] = useState(PALETTE[0].color);

    // Stato Mobile
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

    // Dati per Statistiche
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [statsResults, setStatsResults] = useState([]);
    const [statsType, setStatsType] = useState('region');
    const [statsSelection, setStatsSelection] = useState('');

    // Ricerca e Mappa
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);

    // --- NUOVO STATO AUTH ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // Nuovo campo Username
    const [isLoginMode, setIsLoginMode] = useState(true); // Toggle Login/Registrati
    const [loading, setLoading] = useState(false);
    const [authMessage, setAuthMessage] = useState(null);
    const [authError, setAuthError] = useState(false); // Per colorare il messaggio di rosso

    // --- STATO DEI MODALI ---
    const [modal, setModal] = useState({ isOpen: false, type: null, feature: null });
    const [statsModal, setStatsModal] = useState(false);
    const [visitDate, setVisitDate] = useState('');
    const [useDate, setUseDate] = useState(false);

    // Refs
    const visitedRef = useRef({});
    useEffect(() => { visitedRef.current = visited; }, [visited]);
    const colorRef = useRef(selectedColor);
    useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
    const highlightRef = useRef(null);
    useEffect(() => { highlightRef.current = highlightedId; }, [highlightedId]);
    const sessionRef = useRef(null);
    useEffect(() => { sessionRef.current = session; }, [session]);

    // CALCOLO PROGRESS BAR
    const totalComuni = geoData ? geoData.features.length : 7904;
    const visitedCount = Object.keys(visited).length;
    const progressPercentage = totalComuni > 0 ? ((visitedCount / totalComuni) * 100).toFixed(2) : 0;

    // 1. INIT & AUTH
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchVisitedPlaces(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchVisitedPlaces(session.user.id);
            } else {
                setVisited({});
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // 2. CARICA I DATI DAL DATABASE
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

    // 3. CARICAMENTO MAPPA
    useEffect(() => {
        fetch('https://raw.githubusercontent.com/openpolis/geojson-italy/master/topojson/limits_IT_municipalities.topo.json')
            .then(res => res.json())
            .then(data => {
                const keyName = Object.keys(data.objects)[0];
                const comuni = topojson.feature(data, data.objects[keyName]);
                // Ordinamento (non bloccante per UI)
                setTimeout(() => {
                    comuni.features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
                    setGeoData(comuni);

                    // Estrazione regioni/province asincrona
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

    // --- NUOVA LOGICA AUTH (Migliorata) ---

    // Funzione Validazione Password
    const validatePassword = (pwd) => {
        if (pwd.length < 8) return "La password deve essere di almeno 8 caratteri.";
        if (!/[0-9]/.test(pwd)) return "La password deve contenere almeno un numero.";
        if (!/[a-zA-Z]/.test(pwd)) return "La password deve contenere almeno una lettera.";
        return null;
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthMessage(null);
        setAuthError(false);

        try {
            if (isLoginMode) {
                // LOGIN
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                // REGISTRAZIONE
                if (!username) { throw new Error("Inserisci un nome utente."); }

                // Controllo Password
                // Cerca questo blocco dentro handleAuth e modificalo così:

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        // MODIFICA QUI: Aggiungiamo il percorso corretto per GitHub Pages
                        emailRedirectTo: window.location.origin.includes('localhost')
                            ? 'http://localhost:5173'
                            : 'https://cosimode.github.io/mappa-italia/', // <--- IL TUO LINK COMPLETO

                        data: { username: username }
                    }
                });
                if (error) throw error;
                if (!data.session) {
                    setAuthMessage("✅ Controlla la tua email per confermare l'account.");
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

    // Funzione Elimina Account
    const handleDeleteAccount = async () => {
        if (!window.confirm("SEI SICURO? Questa azione cancellerà per sempre il tuo account e la tua mappa. Non si può annullare.")) return;

        setLoading(true);
        // Chiama la funzione SQL database (da creare su Supabase)
        const { error } = await supabase.rpc('delete_own_account');

        if (error) {
            alert("Errore eliminazione: " + error.message);
        } else {
            await supabase.auth.signOut();
            setSession(null);
            alert("Account eliminato correttamente. Ci dispiace vederti andare via!");
        }
        setLoading(false);
    };

    const handleLogout = async () => await supabase.auth.signOut();

    // 4. LOGICA STATISTICHE
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

    // 5. GESTIONE MAPPA
    const handleMapClick = (feature) => {
        if (!sessionRef.current) {
            // alert("Accedi per salvare i tuoi viaggi!");
            // Su mobile apriamo il pannello se l'utente non è loggato
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

        await supabase
            .from('visited_places')
            .upsert([{ user_id: userId, comune_id: id, comune_name: name, color: color, visit_date: dateToSave }], { onConflict: 'user_id, comune_id' });
    };

    const confirmDelete = async () => {
        const feature = modal.feature;
        const id = getComuneId(feature);
        const userId = session.user.id;

        setVisited(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
        closeModal();

        await supabase.from('visited_places').delete().eq('user_id', userId).eq('comune_id', id);
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
        setIsMobilePanelOpen(false); // Chiudi pannello dopo selezione su mobile
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
        const id = getComuneId(feature);
        // Tooltip solo su Desktop per evitare che copra su mobile
        if(window.innerWidth > 768) {
            layer.bindTooltip(feature.properties.name, { permanent: false, direction: "center", className: 'my-tooltip' });
        }

        layer.on({
            click: (e) => { L.DomEvent.stopPropagation(e); if (highlightedId) setHighlightedId(null); handleMapClick(feature); }
        });
    };

    return (
        <div style={{ height: "100vh", width: "100vw", position: 'relative', overflow: 'hidden' }}>

            {/* SIDEBAR / BOTTOM SHEET */}
            <div className={`control-panel ${isMobilePanelOpen ? 'open' : ''}`}>

                {/* Header Visibile Sempre */}
                <div className="panel-header" onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}>
                    <div>
                        <h1>Diario Italia 🇮🇹</h1>
                        <p className="subtitle" style={{marginBottom:0}}>
                            {/* Testo visibile solo su Desktop */}
                            <span className="desktop-text">Colora i luoghi che hai visitato</span>

                            {/* Testo visibile solo su Mobile */}
                            <span className="mobile-text">
                                {isMobilePanelOpen ? 'Chiudi menu' : 'Tocca per aprire'}
                            </span>
                        </p>
                    </div>

                    {/* NUOVA ICONA MENU (SVG) */}
                    <div className="menu-icon-container">
                        {isMobilePanelOpen ? (
                            /* Icona X (Chiudi) quando aperto */
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        ) : (
                            /* Icona Hamburger (Menu) quando chiuso */
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        )}
                    </div>
                </div>

                {/* Contenuto che si nasconde su mobile se chiuso */}
                <div className="panel-content">

                    {/* --- NUOVO HEADER UTENTE CON ELIMINAZIONE --- */}
                    {session && (
                        <div className="user-header-row">
                            <span className="welcome-text">
                                Ciao, <b>{session.user.user_metadata.username || session.user.email.split('@')[0]}</b>
                            </span>
                            <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={handleLogout} className="btn-cancel logout-btn">Esci</button>
                                {/* TASTO ELIMINA ACCOUNT (Icona Cestino) */}
                                <button onClick={handleDeleteAccount} className="btn-delete logout-btn" title="Elimina Account" style={{background:'#fee2e2', color:'#ef4444'}}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- PROGRESS BAR --- */}
                    <div className="control-group" style={{marginTop: session ? '0' : '10px'}}>
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

                    {/* --- NUOVA SEZIONE LOGIN/REGISTRAZIONE MIGLIORATA --- */}
                    {!session && (
                        <div className="auth-section" style={{marginBottom: '20px'}}>

                            {/* Toggle Header Login/Registrati */}
                            <div style={{display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '15px'}}>
                                <div
                                    onClick={() => { setIsLoginMode(true); setAuthMessage(null); }}
                                    style={{flex:1, padding:'10px', textAlign:'center', cursor:'pointer', fontWeight:600, borderBottom: isLoginMode ? '2px solid #333' : 'none', color: isLoginMode ? '#333' : '#999'}}
                                >
                                    Accedi
                                </div>
                                <div
                                    onClick={() => { setIsLoginMode(false); setAuthMessage(null); }}
                                    style={{flex:1, padding:'10px', textAlign:'center', cursor:'pointer', fontWeight:600, borderBottom: !isLoginMode ? '2px solid #333' : 'none', color: !isLoginMode ? '#333' : '#999'}}
                                >
                                    Registrati
                                </div>
                            </div>

                            <form onSubmit={handleAuth}>
                                {/* Campo Username: Visibile SOLO se mi sto registrando */}
                                {!isLoginMode && (
                                    <input
                                        className="search-input"
                                        type="text"
                                        placeholder="Scegli un Nome Utente"
                                        value={username}
                                        onChange={e=>setUsername(e.target.value)}
                                        required
                                        style={{marginBottom:'10px'}}
                                    />
                                )}

                                <input className="search-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{marginBottom:'5px'}}/>
                                <input className="search-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={{marginBottom:'10px'}}/>

                                {/* Vincoli Password (mostrati solo in registrazione) */}
                                {!isLoginMode && (
                                    <p style={{fontSize:'0.65rem', color:'#666', marginBottom:'10px', lineHeight:'1.2'}}>
                                        * La password deve avere almeno 8 caratteri, una lettera e un numero.
                                    </p>
                                )}

                                <button type="submit" disabled={loading} className="btn-confirm" style={{width:'100%', background:'#333'}}>
                                    {loading ? 'Attendere...' : (isLoginMode ? 'Entra' : 'Crea Account')}
                                </button>
                            </form>

                            {/* Messaggi di Errore/Successo */}
                            {authMessage && (
                                <div style={{
                                    fontSize:'0.8rem',
                                    marginTop:'10px',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    backgroundColor: authError ? '#fee2e2' : '#dcfce7',
                                    color: authError ? '#991b1b' : '#166534',
                                    border: `1px solid ${authError ? '#fecaca' : '#bbf7d0'}`
                                }}>
                                    {authMessage}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RICERCA */}
                    <div className="control-group">
                        <label>Cerca</label>
                        <input className="search-input" type="text" placeholder="Digita comune..." value={searchText} onChange={e=>setSearchText(e.target.value)}/>
                        {searchResults.length > 0 && (
                            <ul className="search-results">
                                {searchResults.map((f, i) => (
                                    <li key={i} className="search-result-item" onClick={()=>handleSelectComune(f)}>{f.properties.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* COLORI */}
                    <div className="control-group">
                        <label>Colore Pennarello</label>
                        <div className="color-options">
                            {PALETTE.map((p) => (
                                <div key={p.color} className={`color-circle ${selectedColor===p.color?'selected':''}`}
                                     style={{ backgroundColor: p.color }} onClick={() => setSelectedColor(p.color)}/>
                            ))}
                        </div>
                    </div>

                    {/* STATISTICHE */}
                    <div className="stats">
                        {/* Dentro il div "stats" */}
                        {session && (
                            <button onClick={openStats} className="stats-button" style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}>
                                {/* ICONA IMMAGINE PERSONALIZZATA */}
                                <img
                                    src="/bar-chart.png"
                                    alt="Statistiche"
                                    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                />
                                Vedi Statistiche
                            </button>
                        )}


                    {/* CREDITI FLATICON */}
                        <div className="credits-footer">
                            Icone di <a href="https://www.flaticon.com/authors/xnimrodx" target="_blank" rel="noreferrer">xnimrodx</a> e <a href="https://www.flaticon.com/authors/pojok-d" target="_blank" rel="noreferrer">pojok d</a> su Flaticon
                        </div>
                    </div>
                </div>
            </div>

            {/* MAPPA */}
            <MapContainer center={[42.0, 12.5]} zoom={6} style={{ height: "100%", width: "100%", backgroundColor: '#eef2f3', zIndex: 1 }} minZoom={5} zoomControl={false}>
                <MapController centerTo={mapCenter} />
                <TileLayer attribution='' url="" />
                {geoData && <GeoJSON key={highlightedId || 'initial'} data={geoData} style={style} onEachFeature={onEachFeature} />}
            </MapContainer>

            {/* MODALE POPUP */}
            {modal.isOpen && modal.feature && (
                <div className="modal-overlay" onClick={(e) => { if(e.target.className === 'modal-overlay') closeModal() }}>
                    <div className="modal-content">
                        <h2 style={{marginTop: 0}}>{modal.feature.properties.name}</h2>
                        <div style={{fontSize:'0.9rem', color:'#666', marginBottom:'15px'}}>
                            {modal.feature.properties.prov_name} ({modal.feature.properties.reg_name})
                        </div>

                        {modal.type === 'ADD' ? (
                            <>
                                <p style={{marginBottom:'20px'}}>Vuoi colorare questo luogo?</p>
                                <div style={{marginBottom:'20px'}}>
                                    <label style={{display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '10px'}}>
                                        <input type="checkbox" checked={useDate} onChange={e => setUseDate(e.target.checked)} style={{marginRight: '10px'}}/>
                                        Aggiungi Data
                                    </label>
                                    {useDate && (
                                        <input type="date" className="search-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={{textAlign: 'center'}}/>
                                    )}
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
                                        <div style={{marginTop:'12px', fontSize:'0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555'}}>
                                            {/* ICONA CALENDARIO (Stile pojok d) */}
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                                <line x1="3" y1="10" x2="21" y2="10"></line>
                                            </svg>
                                            {visited[getComuneId(modal.feature)].date}
                                        </div>
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
                            <select value={statsType} onChange={(e) => {setStatsType(e.target.value); setStatsSelection('');}} className="search-input">
                                <option value="region">Per Regione</option>
                                <option value="province">Per Provincia</option>
                            </select>
                            <select value={statsSelection} onChange={(e) => setStatsSelection(e.target.value)} className="search-input">
                                <option value="">Seleziona zona...</option>
                                {statsType === 'region' ? regions.map(r => <option key={r} value={r}>{r}</option>) : provinces.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        {statsSelection && statsResults.total > 0 && (
                            <div style={{marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '10px', background: '#f9f9f9'}}>
                                <h4 style={{margin:'0 0 10px 0'}}>{statsSelection}</h4>
                                <div className="progress-track" style={{marginBottom:'10px'}}>
                                    <div className="progress-fill" style={{ width: `${statsResults.percentage}%`, backgroundColor: '#3b82f6' }}/>
                                </div>
                                <div>{statsResults.visited} / {statsResults.total} Comuni ({statsResults.percentage}%)</div>
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="btn-confirm" onClick={closeStats} style={{backgroundColor: '#333'}}>Chiudi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
