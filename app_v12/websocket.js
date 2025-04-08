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
    ws = new WebSocket('wss://api.arrosage.cielnewton.fr/ws', [], {
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

// Exécuter le `ping` toutes les 30 secondes
const keepAliveInterval = setInterval(keepAlive, 30000);

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
        if (latestSensorData.Humidité !== null || latestSensorData.NiveauDeau !== null || latestSensorData.Débit !== null) {
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

// Générer un ID unique pour les requêtes
const generateRequestId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

// Fonction modifiée pour récupérer les données historiques
const fetchHistoricalSensorData = async (duration, durationType) => {
    try {
        // Vérification des paramètres
        if (!duration || isNaN(parseInt(duration))) {
            console.error("Durée invalide:", duration);
            return { Humidité: [], NiveauDeau: [], Débit: [] };
        }
        
        // Préparation des données à envoyer selon le format demandé
        const requestData = {
            duree: parseInt(duration),
            unite: durationType
        };
        
        console.log("Envoi de la requête pour les données historiques:", requestData);
        
        // Utilisation de l'API WebSocket au lieu d'une requête HTTP séparée
        // pour maintenir la cohérence avec le reste de l'application
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Créer une promesse pour attendre la réponse
            return new Promise((resolve, reject) => {
                // Envoyer une requête pour les données historiques via WebSocket
                const historyRequest = {
                    type: "getHistoricalData",
                    params: requestData
                };
                
                ws.send(JSON.stringify(historyRequest));
                console.log("📤 Requête de données historiques envoyée:", historyRequest);
                
                // Créer un ID pour cette requête
                const requestId = generateRequestId();
                
                // Définir un timeout pour la requête
                const timeout = setTimeout(() => {
                    console.warn("⚠️ Timeout pour la requête de données historiques");
                    
                    // Génération de données factices pour permettre le test de l'interface
                    const fakeData = generateFakeHistoricalData(duration, durationType);
                    console.log("Utilisation de données de test:", fakeData);
                    resolve(fakeData);
                }, 5000);
                
                // Définir un gestionnaire pour la réponse
                const handleHistoricalResponse = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        
                        // Vérifier si c'est une réponse aux données historiques
                        if (response.type === "historicalData" || 
                            (response.données && Array.isArray(response.données.historique))) {
                            // Nettoyer le timeout et le gestionnaire
                            clearTimeout(timeout);
                            ws.removeEventListener('message', handleHistoricalResponse);
                            
                            const historicalData = {
                                Humidité: [],
                                NiveauDeau: [],
                                Débit: []
                            };
                            
                            // Traiter les données reçues selon le format
                            const dataArray = response.données?.historique || response.historique || [];
                            
                            dataArray.forEach(item => {
                                let time;
                                let value;
                                let deviceType;
                                
                                // Format 1 : {_time, _value, _field}
                                if (item._time && item._value !== undefined && item._field) {
                                    time = new Date(item._time).toLocaleTimeString();
                                    value = parseFloat(item._value);
                                    deviceType = item._field;
                                } 
                                // Format 2 : {date, valeur, deviceName}
                                else if (item.date && item.valeur !== undefined && item.deviceName) {
                                    time = new Date(item.date).toLocaleTimeString();
                                    value = parseFloat(item.valeur);
                                    
                                    if (item.deviceName === "Capteur d'humidité") {
                                        deviceType = "Humidité";
                                    } else if (item.deviceName === "Capteur de niveau d'eau") {
                                        deviceType = "NiveauDeau";
                                    } else if (item.deviceName === "Débimètre") {
                                        deviceType = "Débit";
                                    }
                                }
                                
                                // Ajouter les données à la structure appropriée
                                if (deviceType && !isNaN(value)) {
                                    if (deviceType === "Humidité" || deviceType === "humidity") {
                                        historicalData.Humidité.push({ time, value });
                                    } else if (deviceType === "NiveauDeau" || deviceType === "waterLevel") {
                                        historicalData.NiveauDeau.push({ time, value });
                                    } else if (deviceType === "Débit" || deviceType === "flow") {
                                        historicalData.Débit.push({ time, value });
                                    }
                                }
                            });
                            
                            // Trier les données par ordre chronologique
                            Object.keys(historicalData).forEach(key => {
                                historicalData[key].sort((a, b) => 
                                    new Date(a.time) - new Date(b.time)
                                );
                            });
                            
                            console.log("Données historiques traitées:", historicalData);
                            resolve(historicalData);
                        }
                    } catch (error) {
                        console.error("Erreur lors du traitement des données historiques:", error);
                    }
                };
                
                // Ajouter le gestionnaire d'événements
                ws.addEventListener('message', handleHistoricalResponse);
                
                // En cas d'alternative, essayer également une requête HTTP
                fetch('https://api.arrosage.cielnewton.fr/historique', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${TOKEN}`,
                    },
                    body: JSON.stringify(requestData)
                })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error(`Erreur HTTP ${response.status}`);
                })
                .then(data => {
                    // Nettoyer le timeout et le gestionnaire WebSocket si la requête HTTP réussit avant
                    clearTimeout(timeout);
                    ws.removeEventListener('message', handleHistoricalResponse);
                    
                    const historicalData = processHistoricalData(data);
                    console.log("Données historiques HTTP reçues:", historicalData);
                    resolve(historicalData);
                })
                .catch(error => {
                    console.error("Erreur HTTP pour les données historiques:", error);
                    // Ne pas rejeter ici - laisser le WebSocket ou le timeout gérer la résolution
                });
            });
        } else {
            // Si WebSocket n'est pas disponible, essayer avec une requête HTTP
            const response = await fetch('https://api.arrosage.cielnewton.fr/historique', {
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
            return processHistoricalData(data);
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des données historiques des capteurs:", error);
        return generateFakeHistoricalData(duration, durationType);
    }
};

// Fonction pour traiter les données historiques selon différents formats possibles
const processHistoricalData = (data) => {
    const historicalData = {
        Humidité: [],
        NiveauDeau: [],
        Débit: []
    };
    
    if (!data) return historicalData;
    
    // Si c'est un tableau simple
    if (Array.isArray(data)) {
        data.forEach(item => {
            let time;
            let value;
            let deviceType;
            
            // Format 1 : {_time, _value, _field}
            if (item._time && item._value !== undefined && item._field) {
                time = new Date(item._time).toLocaleTimeString();
                value = parseFloat(item._value);
                deviceType = item._field;
            } 
            // Format 2 : {date, valeur, deviceName}
            else if (item.date && item.valeur !== undefined && item.deviceName) {
                time = new Date(item.date).toLocaleTimeString();
                value = parseFloat(item.valeur);
                
                if (item.deviceName === "Capteur d'humidité") {
                    deviceType = "Humidité";
                } else if (item.deviceName === "Capteur de niveau d'eau") {
                    deviceType = "NiveauDeau";
                } else if (item.deviceName === "Débimètre") {
                    deviceType = "Débit";
                }
            }
            
            if (deviceType && !isNaN(value)) {
                if (deviceType === "Humidité" || deviceType === "humidity") {
                    historicalData.Humidité.push({ time, value });
                } else if (deviceType === "NiveauDeau" || deviceType === "waterLevel") {
                    historicalData.NiveauDeau.push({ time, value });
                } else if (deviceType === "Débit" || deviceType === "flow") {
                    historicalData.Débit.push({ time, value });
                }
            }
        });
    } 
    // Si les données sont organisées par type de capteur
    else if (data.Humidité || data.NiveauDeau || data.Débit) {
        Object.keys(data).forEach(key => {
            if (Array.isArray(data[key]) && historicalData[key]) {
                data[key].forEach(item => {
                    const time = typeof item.time === 'string' ? item.time : 
                           item.date ? new Date(item.date).toLocaleTimeString() : 
                           new Date().toLocaleTimeString();
                    const value = parseFloat(item.value !== undefined ? item.value : item.valeur);
                    
                    if (!isNaN(value)) {
                        historicalData[key].push({ time, value });
                    }
                });
            }
        });
    }
    
    // Trier les données par ordre chronologique
    Object.keys(historicalData).forEach(key => {
        historicalData[key].sort((a, b) => 
            new Date(a.time) - new Date(b.time)
        );
    });
    
    return historicalData;
};

// Fonction pour générer des données factices à des fins de test
const generateFakeHistoricalData = (duration, durationType) => {
    const historicalData = {
        Humidité: [],
        NiveauDeau: [],
        Débit: []
    };
    
    // Déterminer le nombre de points de données en fonction de la durée
    let dataPoints = parseInt(duration);
    if (durationType === 'h') dataPoints *= 6; // Un point toutes les 10 minutes
    if (durationType === 'd') dataPoints *= 12; // Un point toutes les 2 heures
    if (durationType === 'mo') dataPoints = 30; // Un point par jour pour un mois
    if (durationType === 'y') dataPoints = 12; // Un point par mois pour une année
    
    // Limiter à un nombre raisonnable de points
    dataPoints = Math.min(dataPoints, 100);
    
    // Générer des données factices avec tendance et variation aléatoire
    const now = new Date();
    
    for (let i = 0; i < dataPoints; i++) {
        const pastTime = new Date(now);
        
        // Calculer le temps passé en fonction du type de durée
        if (durationType === 'm') {
            pastTime.setMinutes(now.getMinutes() - (duration - i * (duration / dataPoints)));
        } else if (durationType === 'h') {
            pastTime.setMinutes(now.getMinutes() - (duration * 60 - i * (duration * 60 / dataPoints)));
        } else if (durationType === 'd') {
            pastTime.setHours(now.getHours() - (duration * 24 - i * (duration * 24 / dataPoints)));
        } else if (durationType === 'mo') {
            pastTime.setDate(now.getDate() - (30 - i * (30 / dataPoints)));
        } else if (durationType === 'y') {
            pastTime.setMonth(now.getMonth() - (12 - i * (12 / dataPoints)));
        }
        
        const time = pastTime.toLocaleTimeString();
        
        // Générer des valeurs avec une tendance et une variation aléatoire
        const baseHumidity = 65; // Valeur de base pour l'humidité
        const baseWaterLevel = 85; // Valeur de base pour le niveau d'eau
        const baseFlow = 12; // Valeur de base pour le débit
        
        // Ajouter une tendance légère (diminution progressive) et une variation aléatoire
        const trendFactor = i / dataPoints; // Plus grand vers la fin (maintenant)
        const randomVariation = () => (Math.random() - 0.5) * 10;
        
        historicalData.Humidité.push({ 
            time, 
            value: Math.max(0, Math.min(100, baseHumidity - 15 * trendFactor + randomVariation()))
        });
        
        historicalData.NiveauDeau.push({ 
            time, 
            value: Math.max(0, Math.min(100, baseWaterLevel - 20 * trendFactor + randomVariation()))
        });
        
        historicalData.Débit.push({ 
            time, 
            value: Math.max(0, Math.min(30, baseFlow - 5 * trendFactor + randomVariation() / 2))
        });
    }
    
    return historicalData;
};

export { 
    getData, 
    setData, 
    closeWebSocket, 
    getLatestSensorData,
    getLatestModeState,
    setModeStateCallback,
    setRawDataCallback,
    fetchHistoricalSensorData
};