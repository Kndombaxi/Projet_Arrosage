const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA"; 

let ws;

const connectWebSocket = () => {
    ws = new WebSocket('wss://api.arrosage.cielnewton.fr/ws', [], {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });

    ws.onopen = () => {
        console.log("✅ Connecté au WebSocket !");
    };

    ws.onmessage = (event) => {
        console.log("📩 Message reçu :", event.data);
    };

    ws.onclose = () => {
        console.log("❌ Déconnecté du WebSocket. Reconnexion...");
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error("⚠️ Erreur WebSocket :", error);
    };
};
connectWebSocket();

// Fonction pour garder la connexion WebSocket active
const keepAlive = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
        console.log("🔄 Ping envoyé pour maintenir la connexion");
    }
};

// Lancer le keepAlive toutes les 10 secondes
const keepAliveInterval = setInterval(keepAlive, 10000);

const getData = async () => {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "getData" }));
            ws.onmessage = (event) => {
                try {
                    const jsonData = JSON.parse(event.data);
                    resolve(jsonData);
                } catch (error) {
                    console.error("⚠️ Erreur de parsing :", error);
                    reject(error);
                }
            };
        } else {
            reject("WebSocket non disponible");
        }
    });
};

// Modifier les types des paramètres de setData
const setData = async (action, mode) => {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = { type: "sendData", mode };
            // Ajouter l'action seulement si elle est fournie
            if (action !== null) {
                message.action = action;
            }
            ws.send(JSON.stringify(message));
            console.log("📤 Données envoyées :", message);
            resolve({ success: true });
        } else {
            reject({ success: false, error: "WebSocket non disponible" });
        }
    });
};

const closeWebSocket = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (ws) ws.close();
};

export { getData, setData, closeWebSocket };