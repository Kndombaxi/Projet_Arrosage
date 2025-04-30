const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA";

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
    ws = new WebSocket('wss://api.arrosage.cielnewton.fr/ws', [], {
        headers: { Authorization: `Bearer ${token}` }
    });

    ws.onopen = () => {
        console.log("Connecté au WebSocket !");
        // Ne pas envoyer automatiquement getState
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

// Fonction sécurisée pour parser les dates
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

// Fonction pour formater une date en utilisant les heures et minutes
const formatTimeFromDate = (date) => {
    if (!date) return "00:00";
    try {
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (error) {
        console.warn("Erreur lors du formatage de l'heure:", error);
        return "00:00";
    }
};

// Nouvelle fonction pour récupérer les données historiques depuis la base de données
const fetchHistoricalData = async (duree, unite) => {
    try {
        // Validation des entrées
        if (!duree || isNaN(parseInt(duree)) || parseInt(duree) <= 0) {
            console.error('Durée invalide pour fetchHistoricalData');
            return [];
        }

        if (!unite || !['m', 'h', 'd', 'mo', 'y'].includes(unite)) {
            console.error('Unité invalide pour fetchHistoricalData');
            return [];
        }

        const response = await fetch('https://api.arrosage.cielnewton.fr/bdd', {
            method: 'POST',
            headers: {
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
                    } else if (item._field === "NiveauDeau" || item.tagname === "Capteur niveau") {
                        deviceName = "Capteur de niveau d'eau";
                    } else if (item._field === "Débit" || item.tagname === "Débitmètre") {
                        deviceName = "Débitmètre";
                    } else if (item._field === "capteur1" || item.tagname === "Capteur eau supérieur à 500L" || item.tagname === "Capteu de présence d'eau 1") {
                        deviceName = "Capteur eau supérieur à 500L";
                    } else if (item._field === "capteur2" || item.tagname === "Capteur de présence d'eau" || item.tagname === "Capteu de présence d'eau 2") {
                        deviceName = "Capteur de présence d'eau";
                    } else {
                        deviceName = item.tagname || item._field || "Unknown";
                    }

                    // Vérifier que _time existe et est une chaîne
                    if (!item._time || typeof item._time !== 'string') {
                        const now = new Date();
                        return {
                            date: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
                            deviceName: deviceName,
                            valeur: (item._value || 0).toString()
                        };
                    }

                    const parsedDate = safeParseDate(item._time);
                    const formattedDate = parsedDate ? formatTimeFromDate(parsedDate) : "00:00";

                    return {
                        date: formattedDate,
                        deviceName: deviceName,
                        valeur: (item._value || 0).toString()
                    };
                } catch (error) {
                    console.error('Erreur lors du traitement d\'un élément:', error);
                    return null;
                }
            })
            .filter(item => item !== null);

        return transformedData;
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        return [];
    }
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
    setRawDataCallback,
    fetchHistoricalData
};