const API_RECEIVE_URL = "http://192.168.5.85:3005/emission";  // Pour récupérer les données
const API_SEND_URL = "http://192.168.5.85:3005/reception";      // Pour envoyer des commandes

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA";

// Récupérer les données des capteurs
export const getData = async () => {
  try {
    const response = await fetch(API_RECEIVE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
    });

    if (!response.ok) throw new Error("Erreur serveur");

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de la récupération des données :", error);
    return null;
  }
};


// Envoyer l'état de l'arrosage (activer/desactiver) + mode manuel/auto
export const sendData = async (action: "activer" | "desactiver", mode: "manuel" | "auto") => {
  try {
    const response = await fetch(API_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ action, mode }),  // ✅ Envoi mode + action
    });

    if (!response.ok) throw new Error("Erreur lors de l'envoi de l'état d'arrosage");

    console.log(`Mode: ${mode}, Action: ${action} envoyé à l'API`);
    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
    return null;
  }
};

// Envoyer le mode (seulement pour "auto")
export const updateMode = async (mode: "manuel" | "auto") => {
  if (mode === "manuel") {
    console.log("Mode manuel sélectionné - Attente de l'action utilisateur.");
    return; // ✅ On attend que l'utilisateur choisisse une action
  }

  try {
    const response = await fetch(API_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ mode }),
    });

    if (!response.ok) throw new Error("Erreur lors de la mise à jour du mode");

    console.log(`Mode ${mode} envoyé à l'API`);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du mode :", error);
  }
};
