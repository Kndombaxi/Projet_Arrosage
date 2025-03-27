const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA"; 

let ws;
let latestSensorData = null;
let latestModeState = {
    mode: "manuel",
    action: "desactiver"
};

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
            if (jsonData.mode && jsonData.etat) {
                latestModeState = {
                    mode: jsonData.mode,
                    action: jsonData.etat
                };
                console.log("État mis à jour :", latestModeState);
            }
            
            // Vérifier si le message contient des données de capteurs
            if (jsonData.dernieresDonnees) {
                const humiditeData = jsonData.dernieresDonnees[1];
                const debitData = jsonData.dernieresDonnees[2];
                
                latestSensorData = {
                    Humidité: humiditeData ? parseFloat(humiditeData.valeur) : null,
                    NiveauDeau: null, // Pas de donnée de niveau d'eau dans cet exemple
                    Débit: debitData ? parseFloat(debitData.valeur) : null
                };
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

// Nouvelle fonction getData
const getData = async () => {
    return new Promise((resolve, reject) => {
        // Si des données sont déjà disponibles, les retourner immédiatement
        if (latestSensorData) {
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
            if (latestSensorData) {
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
            ws.send(JSON.stringify(message));
            console.log("Données envoyées :", message);
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
        return data;
        
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
    getLatestModeState
};