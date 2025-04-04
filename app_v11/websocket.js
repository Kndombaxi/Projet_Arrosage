const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA"; 

let ws;
let latestSensorData = {
    Humidité: null,
    NiveauDeau: null,
    Débit: null
};

let latestModeState = {
    mode: "manuel",
    action: "desactiver"
};

let modeStateCallback = null;
let rawDataCallback = null;
let pendingRequests = [];

const connectWebSocket = () => {
    ws = new WebSocket('ws://192.168.5.199:3006/ws', [], {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });

    ws.onopen = () => {
        console.log("Connecté au WebSocket !");
    };

    ws.onmessage = (event) => {
        console.log("Message reçu :", event.data);
        try {
            const jsonData = JSON.parse(event.data);
            
            // Vérifier si le message contient des données de mode/action
            if (jsonData.mode !== undefined && jsonData.etat !== undefined) {
                const newState = {
                    mode: jsonData.mode,
                    action: jsonData.etat
                };
                latestModeState = newState;
                console.log("État mis à jour :", latestModeState);
                
                // Vérifier si cette mise à jour correspond à une requête en attente
                const pendingIndex = pendingRequests.findIndex(
                    req => (req.mode === newState.mode) && 
                           (req.etat === undefined || req.etat === newState.action)
                );
                
                if (pendingIndex !== -1) {
                    console.log("Requête en attente résolue:", pendingRequests[pendingIndex]);
                    pendingRequests.splice(pendingIndex, 1);
                }
                
                // Appeler le callback s'il existe
                if (modeStateCallback) {
                    modeStateCallback(newState);
                }
            }
            
            // Traiter les données individuelles des capteurs au format {"données":{...}}
            if (jsonData.données && jsonData.données.deviceName) {
                const { deviceName, valeur } = jsonData.données;
                
                // Mettre à jour les données appropriées en fonction du type de capteur
                if (deviceName === "Capteur d'humidité") {
                    latestSensorData.Humidité = parseFloat(valeur);
                } else if (deviceName === "Capteur de niveau d'eau") {
                    latestSensorData.NiveauDeau = parseFloat(valeur);
                } else if (deviceName === "Débimètre") {
                    latestSensorData.Débit = parseFloat(valeur);
                }
                
                console.log("Données capteur mises à jour:", latestSensorData);
                
                // Notifier via callback si existant
                if (rawDataCallback) {
                    rawDataCallback(jsonData);
                }
            }
            
            // Vérifier si le message contient des données de capteurs groupées
            if (jsonData.dernieresDonnees && Array.isArray(jsonData.dernieresDonnees)) {
                jsonData.dernieresDonnees.forEach(data => {
                    const { deviceName, valeur } = data;
                    
                    // Mettre à jour les données appropriées en fonction du type de capteur
                    if (deviceName === "Capteur d'humidité") {
                        latestSensorData.Humidité = parseFloat(valeur);
                    } else if (deviceName === "Capteur de niveau d'eau") {
                        latestSensorData.NiveauDeau = parseFloat(valeur);
                    } else if (deviceName === "Débimètre") {
                        latestSensorData.Débit = parseFloat(valeur);
                    }
                });
                
                console.log("Données capteurs groupées mises à jour:", latestSensorData);
            }
        } catch (error) {
            console.error("Erreur de parsing :", error);
        }
    };

    ws.onclose = () => {
        console.log("Déconnecté du WebSocket. Reconnexion...");
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error("Erreur WebSocket :", error);
    };
};
connectWebSocket();

// Fonction pour garder la connexion WebSocket active avec un ping
const keepAlive = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.ping(); // ✅ Envoie un ping propre
            console.log("📡 Ping envoyé au WebSocket");
        } catch (error) {
            console.error("⚠️ Erreur lors de l'envoi du ping :", error);
        }
    }
};

// Exécuter le `ping` toutes les 10 secondes (au lieu de 5 minutes)
const keepAliveInterval = setInterval(keepAlive, 50000);

// Fonction pour définir le callback pour les changements de mode
const setModeStateCallback = (callback) => {
    modeStateCallback = callback;
};

// Nouvelle fonction pour définir le callback pour les données brutes
const setRawDataCallback = (callback) => {
    rawDataCallback = callback;
};

// Ajouter un timeout pour les requêtes en attente
const addPendingRequestTimeout = (request) => {
    // Ajouter un timeout de 10 secondes pour les requêtes en attente
    setTimeout(() => {
        const index = pendingRequests.indexOf(request);
        if (index !== -1) {
            pendingRequests.splice(index, 1);
            console.log("Requête expirée:", request);
            
            // Notifier l'interface utilisateur si nécessaire
            if (modeStateCallback) {
                modeStateCallback(latestModeState);
            }
        }
    }, 10000);
};

// Nouvelle fonction getData
const getData = async () => {
    return new Promise((resolve, reject) => {
        // Si des données sont déjà disponibles, les retourner immédiatement
        if (latestSensorData.Humidité !== null || latestSensorData.NiveauDeau !== null || latestSensorData.Débit !== null) {
            resolve(latestSensorData);
            return;
        }

        // Attendre une courte période pour potentiellement recevoir des données
        const timeout = setTimeout(() => {
            reject({ success: false, error: "Pas de données disponibles" });
        }, 5000);

        // Utiliser un écouteur d'événement pour capturer les nouvelles données
        const handleNewData = () => {
            clearTimeout(timeout);
            if (latestSensorData.Humidité !== null || latestSensorData.NiveauDeau !== null || latestSensorData.Débit !== null) {
                resolve(latestSensorData);
            } else {
                reject({ success: false, error: "Pas de données disponibles" });
            }
            // Retirer l'écouteur d'événement pour éviter les fuites de mémoire
            ws.removeEventListener('message', handleNewData);
        };

        // Ajouter l'écouteur d'événement
        ws.addEventListener('message', handleNewData);
    });
};

// Fonction pour récupérer les données des capteurs
const getLatestSensorData = () => {
    return latestSensorData;
};

// Fonction pour récupérer le dernier état de mode et d'action
const getLatestModeState = () => {
    return latestModeState;
};

const setData = async (action, mode) => {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            let message = {};
            let request = {};
            
            // En mode auto, on envoie uniquement le mode
            if (mode === "auto") {
                message = { mode };
                request = { mode };
            } 
            // En mode manuel, on envoie le mode et l'état si fourni
            else {
                message = { mode };
                request = { mode };
                
                // Ajouter l'état seulement s'il est fourni
                if (action !== null && action !== undefined) {
                    message.etat = action;
                    request.etat = action;
                }
            }
            
            // Ajouter la requête à la liste des requêtes en attente
            pendingRequests.push(request);
            
            // Configurer un timeout pour cette requête
            addPendingRequestTimeout(request);
            
            // Envoyer le message
            ws.send(JSON.stringify(message));
            console.log("Données envoyées :", message);
            
            // Résoudre immédiatement, mais l'interface attendra la confirmation
            resolve({ success: true, pending: true });
        } else {
            reject({ success: false, error: "WebSocket non disponible" });
        }
    });
};

const closeWebSocket = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    if (ws) {
        ws.close();
        ws = null;
    }
};

// Fonction pour récupérer les données des capteurs via HTTP
const fetchSensorData = async () => {
    try {
        const response = await fetch("https://api.arrosage.cielnewton.fr/bdd", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("Données des capteurs reçues :", data);
        
        // Traiter les données reçues pour mettre à jour latestSensorData
        if (data && Array.isArray(data)) {
            data.forEach(item => {
                if (item.deviceName === "Capteur d'humidité") {
                    latestSensorData.Humidité = parseFloat(item.valeur);
                } else if (item.deviceName === "Capteur de niveau d'eau") {
                    latestSensorData.NiveauDeau = parseFloat(item.valeur);
                } else if (item.deviceName === "Débimètre") {
                    latestSensorData.Débit = parseFloat(item.valeur);
                }
            });
        }
        
        return latestSensorData;
        
    } catch (error) {
        console.error("Erreur lors de la récupération des données des capteurs :", error);
        return null;
    }
};

// Fonction pour récupérer les données historiques
const fetchHistoricalSensorData = async (duration, durationType) => {
    try {
        // Préparation des données à envoyer selon le format demandé
        const requestData = {
            duree: duration,
            unite: durationType
        };
        
        const response = await fetch('http://192.168.5.199:3005/bdd', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TOKEN}`,
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`Données historiques des capteurs reçues (${duration} ${durationType}):`, data);
        
        // Préparer les objets pour stocker les données par type de capteur
        const historicalData = {
            Humidité: [],
            NiveauDeau: [],
            Débit: []
        };
        
        // Traiter les données reçues
        if (data && Array.isArray(data)) {
            data.forEach(item => {
                const time = new Date(item._time).toLocaleTimeString();
                const value = item._value;
                
                if (item._field === "Humidité") {
                    historicalData.Humidité.push({ time, value });
                } else if (item._field === "NiveauDeau") {
                    historicalData.NiveauDeau.push({ time, value });
                } else if (item._field === "Débit") {
                    historicalData.Débit.push({ time, value });
                }
            });
        }
        
        return historicalData;
        
    } catch (error) {
        console.error("Erreur lors de la récupération des données historiques des capteurs :", error);
        return {
            Humidité: [],
            NiveauDeau: [],
            Débit: []
        };
    }
};

export { 
    getData, 
    setData, 
    closeWebSocket, 
    fetchSensorData, 
    getLatestSensorData,
    getLatestModeState,
    setModeStateCallback,
    setRawDataCallback,
    fetchHistoricalSensorData
};