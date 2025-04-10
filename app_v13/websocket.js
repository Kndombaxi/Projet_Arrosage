const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA"; 

let ws;
let latestSensorData = {
    Humidité: null,
    NiveauDeau: null,
    Débit: null,
    capteur1: null,
    capteur2: null
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
        // Ne pas envoyer automatiquement getState
    };

    ws.onmessage = (event) => {
        console.log("Message reçu :", event.data);
        try {
            const jsonData = JSON.parse(event.data);
            
            // Vérifier si le message contient des données de mode/action
            if (jsonData.mode !== undefined) {
                let newState = {
                    mode: jsonData.mode,
                    action: jsonData.etat !== undefined ? jsonData.etat : latestModeState.action
                };
                latestModeState = newState;
                console.log("État mis à jour :", latestModeState);
                
                // Vérifier si cette mise à jour correspond à une requête en attente
                const pendingIndex = pendingRequests.findIndex(
                    req => req.mode === newState.mode && 
                          (req.etat === undefined || req.etat === newState.action)
                );
                
                if (pendingIndex !== -1) {
                    console.log("Requête en attente résolue:", pendingRequests[pendingIndex]);
                    // Résoudre la promesse associée à cette requête
                    if (pendingRequests[pendingIndex].resolve) {
                        pendingRequests[pendingIndex].resolve({ success: true });
                    }
                    pendingRequests.splice(pendingIndex, 1);
                }
                
                // Appeler le callback s'il existe
                if (modeStateCallback) {
                    modeStateCallback({ ...newState, dataUpdate: true });
                }
            }
            
            // Traiter les données individuelles des capteurs au format {"données":{...}}
            if (jsonData.données) {
                const { deviceName, valeur, capteur1, capteur2 } = jsonData.données;
                
                // Mettre à jour les données appropriées en fonction du type de capteur
                if (deviceName === "Capteur d'humidité") {
                    latestSensorData.Humidité = parseFloat(valeur);
                } else if (deviceName === "Capteur de niveau d'eau") {
                    latestSensorData.NiveauDeau = parseFloat(valeur);
                } else if (deviceName === "Débitmètre") {
                    latestSensorData.Débit = parseFloat(valeur);
                } else if (deviceName === "level-sensor") {
                    // Traiter les nouveaux capteurs de niveau
                    if (capteur1 !== undefined) latestSensorData.capteur1 = capteur1;
                    if (capteur2 !== undefined) latestSensorData.capteur2 = capteur2;
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
                    const { deviceName, valeur, capteur1, capteur2 } = data;
                    
                    // Mettre à jour les données appropriées en fonction du type de capteur
                    if (deviceName === "Capteur d'humidité") {
                        latestSensorData.Humidité = parseFloat(valeur);
                    } else if (deviceName === "Capteur de niveau d'eau") {
                        latestSensorData.NiveauDeau = parseFloat(valeur);
                    } else if (deviceName === "Débitmètre") {
                        latestSensorData.Débit = parseFloat(valeur);
                    } else if (deviceName === "level-sensor") {
                        // Traiter les nouveaux capteurs de niveau
                        if (capteur1 !== undefined) latestSensorData.capteur1 = capteur1;
                        if (capteur2 !== undefined) latestSensorData.capteur2 = capteur2;
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
        setTimeout(connectWebSocket, 2000); // Reconnexion plus rapide
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
            ws.ping(); 
            console.log("📡 Ping envoyé au WebSocket");
        } catch (error) {
            console.error("⚠️ Erreur lors de l'envoi du ping :", error);
        }
    }
};

// Exécuter le `ping` toutes les 50 secondes
const keepAliveInterval = setInterval(keepAlive, 50000);

// Fonction pour définir le callback pour les changements de mode
const setModeStateCallback = (callback) => {
    modeStateCallback = callback;
};

// Fonction pour définir le callback pour les données brutes
const setRawDataCallback = (callback) => {
    rawDataCallback = callback;
};

// Fonction pour gérer les timeouts des requêtes en attente
const addPendingRequestTimeout = (request) => {
    setTimeout(() => {
        const index = pendingRequests.findIndex(
            req => req.id === request.id
        );
        
        if (index !== -1) {
            console.log("Requête expirée:", pendingRequests[index]);
            // Rejeter la promesse associée avec une erreur de timeout
            if (pendingRequests[index].reject) {
                pendingRequests[index].reject({ 
                    success: false, 
                    error: "Timeout: pas de réponse du serveur" 
                });
            }
            pendingRequests.splice(index, 1);
        }
    }, 3000); // Réduit à 3 secondes pour une meilleure réactivité
};

// Fonction pour récupérer les données des capteurs
const getData = async () => {
    return new Promise((resolve, reject) => {
        // Si des données sont déjà disponibles, les retourner immédiatement
        if (latestSensorData.Humidité !== null || latestSensorData.NiveauDeau !== null || latestSensorData.Débit !== null || 
            latestSensorData.capteur1 !== null || latestSensorData.capteur2 !== null) {
            resolve(latestSensorData);
            return;
        }

        // Attendre une courte période pour potentiellement recevoir des données
        const timeout = setTimeout(() => {
            reject({ success: false, error: "Pas de données disponibles" });
        }, 3000); // Réduit à 3 secondes pour une meilleure réactivité

        // Utiliser un écouteur d'événement pour capturer les nouvelles données
        const handleNewData = () => {
            clearTimeout(timeout);
            if (latestSensorData.Humidité !== null || latestSensorData.NiveauDeau !== null || latestSensorData.Débit !== null || 
                latestSensorData.capteur1 !== null || latestSensorData.capteur2 !== null) {
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


// Fonction pour envoyer des données - MISE À JOUR SELON LE FORMAT DEMANDÉ
const setData = async (action, mode) => {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Création du message selon le format demandé
            const message = { action, mode };
            
            // Convertir en JSON et envoyer
            ws.send(JSON.stringify(message));
            console.log("📤 Données envoyées :", message);
            
            // Mettre à jour l'état local
            if (mode) {
                latestModeState.mode = mode;
            }
            if (action) {
                latestModeState.action = action;
            }
            
            resolve({ success: true });
        } else {
            console.error("WebSocket non disponible");
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

export { 
    getData, 
    setData, 
    closeWebSocket, 
    getLatestSensorData,
    getLatestModeState,
    setModeStateCallback,
    setRawDataCallback
};