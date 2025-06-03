import AsyncStorage from '@react-native-async-storage/async-storage';

let ws;
let keepAliveInterval;
let latestSensorData = {
    Humidité: null,
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
                    } else if (deviceName === "Débitmètre") {
                        latestSensorData.Débit = parseFloat(valeur);
                    } else if (deviceName === "level-sensor") {
                        // Traiter les nouveaux capteurs de niveau
                        if (capteur1 !== undefined) latestSensorData.capteur1 = capteur1;
                        if (capteur2 !== undefined) latestSensorData.capteur2 = capteur2;
                    } else if (deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 1") {
                        // CORRIGÉ: capteur1 = Présence d'eau
                        latestSensorData.capteur1 = parseFloat(valeur);
                    } else if (deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 2") {
                        // CORRIGÉ: capteur2 = Eau supérieur à 500L
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
                        } else if (deviceName === "Débitmètre") {
                            latestSensorData.Débit = parseFloat(valeur);
                        } else if (deviceName === "level-sensor") {
                            // Traiter les nouveaux capteurs de niveau
                            if (capteur1 !== undefined) latestSensorData.capteur1 = capteur1;
                            if (capteur2 !== undefined) latestSensorData.capteur2 = capteur2;
                        } else if (deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 1") {
                            // CORRIGÉ: capteur1 = Présence d'eau
                            latestSensorData.capteur1 = parseFloat(valeur);
                        } else if (deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 2") {
                            // CORRIGÉ: capteur2 = Eau supérieur à 500L
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
        if (latestSensorData.Humidité !== null || latestSensorData.Débit !== null ||
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
            if (latestSensorData.Humidité !== null || latestSensorData.Débit !== null ||
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

// Fonction améliorée pour parser les dates
const safeParseDate = (dateString) => {
    try {
        // Vérifier si la chaîne de date est valide
        if (!dateString) return null;

        // Essayer de créer une date
        const date = new Date(dateString);

        // Vérifier si la date est valide
        if (isNaN(date.getTime())) {
            console.warn("Date invalide:", dateString);
            return null;
        }

        return date;
    } catch (error) {
        console.warn("Erreur lors du parsing de la date:", error);
        return null;
    }
};

// Fonction pour formater une date selon l'unité de temps
const formatDateForDisplay = (date, unite) => {
    if (!date) return "00:00";
    
    try {
        // Pour les unités courtes (minutes, heures), afficher heure:minute
        if (unite === 'm' || unite === 'h' || unite === 'd') {
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        } 
        // Pour les semaines, afficher jour/mois heure:minute
        else if (unite === 'w') {
            return `${date.getDate()}/${date.getMonth()+1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        // Pour d'autres unités, afficher jour/mois
        else {
            return `${date.getDate()}/${date.getMonth()+1}`;
        }
    } catch (error) {
        console.warn("Erreur lors du formatage de la date:", error);
        return "00:00";
    }
};

// Nouvelle fonction améliorée pour récupérer les données historiques
const fetchHistoricalData = async (duree, unite) => {
    try {
        // Validation des entrées
        if (!duree || isNaN(parseInt(duree)) || parseInt(duree) <= 0) {
            console.error('Durée invalide pour fetchHistoricalData');
            return [];
        }

        // Suppression des unités "mo" (mois) et "y" (année) - seulement m, h, d, w autorisées
        if (!unite || !['m', 'h', 'd', 'w'].includes(unite)) {
            console.error('Unité invalide pour fetchHistoricalData. Unités autorisées: m, h, d, w');
            return [];
        }

        // Récupérer le token d'authentification
        const token = await getToken();
        if (!token) {
            console.error('Token non disponible pour fetchHistoricalData');
            return [];
        }

        console.log(`Récupération des données historiques avec: durée=${duree}, unité=${unite}`);

        const response = await fetch('https://api.arrosage.cielnewton.fr/bdd', {
            method: 'POST',
            headers: {
                'Accept-Encoding': 'gzip',
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                duree: duree.toString(),
                unite: unite
            }),
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Erreur de parsing JSON:', parseError);
            return [];
        }

        if (!data) {
            console.warn('Pas de données reçues');
            return [];
        }

        console.log('Données reçues du serveur:', JSON.stringify(data).substring(0, 200) + '...');

        // Transformer les données
        const dataArray = Array.isArray(data) ? data : [data];

        const transformedData = dataArray
            .filter(item => item !== null && typeof item === 'object')
            .map(item => {
                try {
                    // Déterminer le type de capteur
                    let deviceName = "Unknown";

                    if (!item) return null;

                    if (item._field === "Humidité" || item.tagname === "Capteur sol") {
                        deviceName = "Capteur d'humidité";
                    } else if (item._field === "Débit" || item.tagname === "Débitmètre") {
                        deviceName = "Débitmètre";
                    } else if (item._field === "capteur1" || item.tagname === "Capteur de présence d'eau" || item.tagname === "Capteu de présence d'eau 1") {
                        // CORRIGÉ: capteur1 = Capteur de présence d'eau
                        deviceName = "Capteur de présence d'eau";
                    } else if (item._field === "capteur2" || item.tagname === "Capteur eau supérieur à 500L" || item.tagname === "Capteu de présence d'eau 2") {
                        // CORRIGÉ: capteur2 = Capteur eau supérieur à 500L
                        deviceName = "Capteur eau supérieur à 500L";
                    } else {
                        deviceName = item.tagname || item._field || "Unknown";
                    }

                    // Vérifier et traiter le timestamp
                    let formattedDate = "00:00";
                    if (item._time && typeof item._time === 'string') {
                        const parsedDate = safeParseDate(item._time);
                        if (parsedDate) {
                            formattedDate = formatDateForDisplay(parsedDate, unite);
                        }
                    }

                    // S'assurer que la valeur est un nombre ou une chaîne représentant un nombre
                    let valeur = "0";
                    if (item._value !== undefined) {
                        valeur = item._value.toString();
                    } else if (item.valeur !== undefined) {
                        valeur = item.valeur.toString();
                    }

                    return {
                        date: formattedDate,
                        deviceName: deviceName,
                        valeur: valeur
                    };
                } catch (error) {
                    console.error('Erreur lors du traitement d\'un élément:', error, item);
                    return null;
                }
            })
            .filter(item => item !== null);

        console.log(`Données transformées (${transformedData.length} points):`, 
            transformedData.length > 0 ? transformedData[0] : "aucun point");
            
        return transformedData;
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        return [];
    }
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
    closeWebSocket, fetchHistoricalData, getData,
    getLatestModeState,
    getLatestSensorData,
    initWebSocket,
    isWebSocketConnected,
    setData,
    setModeStateCallback,
    setRawDataCallback
};
