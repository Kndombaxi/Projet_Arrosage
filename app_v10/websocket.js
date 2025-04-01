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

// Variable globale pour stocker tous les callbacks de mise à jour de mode
const modeStateCallbacks = [];

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
                    action: jsonData.etat,
                    dataUpdate: true
                };
                latestModeState = {
                    mode: jsonData.mode,
                    action: jsonData.etat
                };
                console.log("État mis à jour :", latestModeState);
                
                // Appeler le callback s'il existe
                if (modeStateCallback) {
                    modeStateCallback(newState);
                }
                
                // Notifier tous les écouteurs enregistrés
                modeStateCallbacks.forEach(callback => {
                    if (callback && typeof callback === 'function') {
                        callback(newState);
                    }
                });
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
                
                // Notifier tous les écouteurs enregistrés d'un changement de données
                const dataUpdateEvent = {
                    ...latestModeState,
                    dataUpdate: true
                };
                
                modeStateCallbacks.forEach(callback => {
                    if (callback && typeof callback === 'function') {
                        callback(dataUpdateEvent);
                    }
                });
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
                
                // Notifier tous les écouteurs enregistrés d'un changement de données
                const dataUpdateEvent = {
                    ...latestModeState,
                    dataUpdate: true
                };
                
                modeStateCallbacks.forEach(callback => {
                    if (callback && typeof callback === 'function') {
                        callback(dataUpdateEvent);
                    }
                });
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
            ws.ping();
            console.log("📡 Ping envoyé au WebSocket");
        } catch (error) {
            console.error("⚠️ Erreur lors de l'envoi du ping :", error);
        }
    }
};

// Exécuter le `ping` toutes les 10 secondes
const keepAliveInterval = setInterval(keepAlive, 50000);

// Fonction pour définir le callback pour les changements de mode
const setModeStateCallback = (callback) => {
    if (callback) {
        // Si c'est un nouveau callback, l'ajouter à la liste
        if (!modeStateCallbacks.includes(callback)) {
            modeStateCallbacks.push(callback);
        }
        // Conserver également le callback principal pour compatibilité
        modeStateCallback = callback;
    } else {
        // Si null est passé, ne pas réinitialiser tous les callbacks
        // mais supprimer uniquement le callback principal
        modeStateCallback = null;
    }
};

// Fonction pour définir le callback pour les données brutes
const setRawDataCallback = (callback) => {
    rawDataCallback = callback;
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
            const message = { type: "sendData", mode };
            
            // Ajouter l'action seulement si elle est fournie
            if (action !== null && action !== undefined) {
                message.action = action;
            }
            
            // Mettre à jour l'état local immédiatement pour une réaction instantanée
            if (mode) {
                latestModeState.mode = mode;
            }
            
            if (action !== null && action !== undefined) {
                latestModeState.action = action;
            }
            
            // Envoyer le message
            ws.send(JSON.stringify(message));
            console.log("Données envoyées :", message);
            
            // Résoudre immédiatement
            resolve({ success: true });
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

export { 
    getData, 
    setData, 
    closeWebSocket, 
    fetchSensorData, 
    getLatestSensorData,
    getLatestModeState,
    setModeStateCallback,
    setRawDataCallback
};