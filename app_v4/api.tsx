const API_RECEIVE_URL = "http://192.168.5.85:3005/emission";  // URL pour récupérer les données du capteur
const API_SEND_URL = "http://192.168.5.85:3005/reception";    // URL pour envoyer les commandes au serveur

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA";

// 📌 Récupère l'état du capteur (activer/désactiver)
export const getData = async () => {
  try {
    const response = await fetch(API_RECEIVE_URL, {
      method: "GET", 
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`, // 🔐 Ajout du token d'authentification
      },
    });

    if (!response.ok) throw new Error("Erreur serveur"); // ⚠️ Vérifie si la requête a réussi

    return await response.json(); // ✅ Retourne les données en JSON
  } catch (error) {
    console.error("Erreur lors de la récupération des données :", error);
    return null; // 🔹 Retourne null en cas d'erreur
  }
};


// 📌 Envoie l'état de l'arrosage + mode (manuel/auto) au serveur
export const sendData = async (action: "activer" | "desactiver", mode: "manuel" | "auto") => {
  try {
    const response = await fetch(API_SEND_URL, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ action, mode }), // 📤 Envoi des données sous forme JSON
    });

    if (!response.ok) throw new Error("Erreur lors de l'envoi de l'état d'arrosage");

    console.log(`Mode: ${mode}, Action: ${action} envoyé à l'API`); // 🖥️ Affichage en console
    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
    return null;
  }
};


// 📌 Met à jour le mode d'arrosage (manuel/auto) uniquement si auto est sélectionné
export const updateMode = async (mode: "manuel" | "auto") => {
  if (mode === "manuel") {
    console.log("Mode manuel sélectionné - Attente de l'action utilisateur.");
    return; // ✅ Ne fait rien si c'est le mode manuel, attend que l'utilisateur appuie sur un bouton
  }

  try {
    const response = await fetch(API_SEND_URL, {
      method: "POST", // 🔹 Méthode POST → envoi des données
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ mode }), // 📤 Envoi du mode (auto uniquement)
    });

    if (!response.ok) throw new Error("Erreur lors de la mise à jour du mode");

    console.log(`Mode ${mode} envoyé à l'API`); // 🖥️ Affichage en console
  } catch (error) {
    console.error("Erreur lors de la mise à jour du mode :", error);
  }
};
