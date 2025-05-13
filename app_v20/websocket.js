import AsyncStorage from '@react-native-async-storage/async-storage';

// Variables globales
let ws;
let keepAliveInterval;
let latestSensorData = {
    Humidité: null,
    NiveauDeau: null,
    Débit: null,
    capteur1: null,
    capteur2: null
};

let latestModeState = {
    mode: "auto",
    action: "desactiver"
};

let modeStateCallback = null;
let rawDataCallback = null;
let pendingRequests = [];
let isConnected = false;

// Fonction pour récupérer le token depuis le stockage
const getToken = async () => {
    try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
            console.error("Token d'authentification non disponible");
            return null;
        }
        return token;
    } catch (error) {
        console.error("Erreur lors de la récupération du token:", error);
        return null;
    }
};

const connectWebSocket = async () => {
    // Vérifier si déjà connecté
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
        console.log("WebSocket déjà connecté");
        return;
    }

    try {
        const token = await getToken();
        if (!token) {
            console.error("Impossible de se connecter au WebSocket: token manquant");
            return;
        }

        ws = new WebSocket('wss://api.arrosage.cielnewton.fr/ws', [], {
            headers: { Authorization: `Bearer ${token}` }
        });

        ws.onopen = () => {
            console.log("Connecté au WebSocket !");
            isConnected = true;
            
            // Démarrer le keepAlive uniquement après connexion réussie
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
            }
            keepAliveInterval = setInterval(keepAlive, 50000);
        };

        ws.onmessage = (event) => {
            console.log("Message reçu :", event.data);
            try {
                // Vérifier si le message est une chaîne de texte qui ne commence pas par '{' ou '['
                if (typeof event.data === 'string' &&
                    !event.data.trim().startsWith('{') &&
                    !event.data.trim().startsWith('[')) {
                    console.log("Message texte reçu (non-JSON):", event.data);

                    // Vérifier si le message contient une indication sur le niveau d'eau
                    if (event.data.includes("cuve est vide") ||
                        event.data.includes("niveau de la pompe")) {
                        // Notifier via callback si existant
                        if (modeStateCallback) {
                            // Envoyer une notification d'erreur tout en conservant l'état actuel
                            modeStateCallback({
                                ...latestModeState,
                                errorMessage: event.data,
                                dataUpdate: false
                            });
                        }
                    }
                    return; // Sortir de la fonction pour éviter de parser comme JSON
                }

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
                    } else if (deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 1") {
                        latestSensorData.capteur1 = parseFloat(valeur);
                    } else if (deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 2") {
                        latestSensorData.capteur2 = parseFloat(valeur);
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
                        // Vérifier si l'élément est null avant d'accéder à ses propriétés
                        if (data === null) {
                            console.log("Élément null détecté dans dernieresDonnees, ignoré");
                            return; // Ignorer les éléments null
                        }

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
                        } else if (deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 1") {
                            latestSensorData.capteur1 = parseFloat(valeur);
                        } else if (deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 2") {
                            latestSensorData.capteur2 = parseFloat(valeur);
                        }
                    });

                    console.log("Données capteurs groupées mises à jour:", latestSensorData);

                    // Notifier via callback si des données brutes sont disponibles
                    if (rawDataCallback) {
                        rawDataCallback(jsonData);
                    }
                }
            } catch (error) {
                console.error("Erreur de parsing :", error);

                // Gestion des erreurs de parsing - notifier l'interface utilisateur
                if (modeStateCallback && typeof event.data === 'string') {
                    // Envoyer le message d'erreur brut à l'interface utilisateur
                    modeStateCallback({
                        ...latestModeState,
                        errorMessage: "Erreur serveur: " + event.data.substring(0, 100), // Limiter la longueur
                        dataUpdate: false
                    });
                }
            }
        };

        ws.onclose = () => {
            console.log("Déconnecté du WebSocket.");
            isConnected = false;
            
            // Arrêter le keepAlive en cas de déconnexion
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
            
            // Ne pas reconnecter automatiquement - la reconnexion sera gérée par initWebSocket
        };

        ws.onerror = (error) => {
            console.error("Erreur WebSocket :", error);
            isConnected = false;
        };
    } catch (error) {
        console.error("Erreur lors de la connexion au WebSocket:", error);
        isConnected = false;
    }
};

// Fonction pour garder la connexion WebSocket active avec un ping
const keepAlive = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.ping();
            console.log("Ping envoyé au WebSocket");
        } catch (error) {
            console.error("Erreur lors de l'envoi du ping :", error);
        }
    }
};

// Fonction pour définir le callback pour les changements de mode
const setModeStateCallback = (callback) => {
    modeStateCallback = callback;
};

// Fonction pour définir le callback pour les données brutes
const setRawDataCallback = (callback) => {
    rawDataCallback = callback;
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

        // Si le WebSocket n'est pas connecté, retourner une erreur
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
            reject({ success: false, error: "WebSocket non connecté" });
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

// Fonction pour envoyer des données avec authentification
const setData = async (action, mode) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Vérifier que le WebSocket est connecté
            if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
                // Tenter de se connecter si ce n'est pas déjà fait
                await connectWebSocket();
                
                // Vérifier à nouveau la connexion
                if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
                    reject({ success: false, error: "WebSocket non disponible" });
                    return;
                }
            }

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
        } catch (error) {
            console.error("Erreur lors de l'envoi des données:", error);
            reject({ success: false, error: error.message || "Erreur inconnue" });
        }
    });
};

// Fonction pour initialiser le WebSocket (à appeler après l'authentification)
const initWebSocket = async () => {
    await connectWebSocket();
    return isConnected;
};

// Vérifier si le WebSocket est connecté
const isWebSocketConnected = () => {
    return isConnected && ws && ws.readyState === WebSocket.OPEN;
};

// Fonction pour fermer proprement le WebSocket
const closeWebSocket = () => {
    isConnected = false;
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
};

export {
    closeWebSocket, getData, getLatestModeState, getLatestSensorData, initWebSocket,
    isWebSocketConnected, setData, setModeStateCallback, setRawDataCallback
};
