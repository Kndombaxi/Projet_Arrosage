import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"manuel" | "auto" | null>(null);
  const [isWatering, setIsWatering] = useState(false);

  // Fonction pour récupérer l'état réel du capteur
  const fetchSensorData = async () => {
    try {
      const response = await fetch("http://64.225.104.146:3005"); // API du capteur
      const result = await response.json();

      // Supposons que l'API retourne { "isWatering": true }
      setIsWatering(result.isWatering);
    } catch (error) {
      console.error("Erreur lors de la récupération des données :", error);
    }
  };

  // Mise à jour automatique toutes les 5 secondes si mode auto activé
  useEffect(() => {
    if (mode === "auto") {
      fetchSensorData(); // Récupération initiale
      const interval = setInterval(fetchSensorData, 5000); // Actualisation toutes les 5s
      return () => clearInterval(interval); // Nettoyage du timer
    }
  }, [mode]);

  const toggleWatering = async () => {
    try {
      const newState = !isWatering;
      setIsWatering(newState);

      // Envoi à l'API pour activer/désactiver l'arrosage (mode manuel)
      await fetch("http://64.225.104.146:3005/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isWatering: newState }),
      });
    } catch (error) {
      console.error("Erreur lors du changement d'état :", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue dans l'application d'arrosage intelligent</Text>

      {/* Image */}
      <Image source={require("../assets/images/background-image.jpg")} style={styles.image} />

      {/* Afficheur de l'état de l'arroseur */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>État de l'arroseur :</Text>
        <Text style={[styles.status, isWatering ? styles.active : styles.inactive]}>
          {isWatering ? "ACTIF" : "INACTIF"}
        </Text>
      </View>

      {/* Sélection du mode */}
      <View style={styles.modeButtonContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "manuel" && styles.selectedMode]}
          onPress={() => {
            setMode("manuel");
            fetchSensorData(); // Récupérer l'état actuel immédiatement lorsque l'on passe en manuel
          }}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === "auto" && styles.selectedMode]}
          onPress={() => {
            setMode("auto");
            fetchSensorData(); // Récupérer immédiatement l'état du capteur lorsque l'on passe en mode auto
          }}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton d'activation seulement en mode Manuel */}
      {mode === "manuel" && (
        <TouchableOpacity style={styles.toggleButton} onPress={toggleWatering}>
          <Text style={styles.toggleButtonText}>
            {isWatering ? "Arrêter l'arrosage" : "Activer l'arrosage"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Boutons en bas */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/data")}>
          <Ionicons name="analytics" size={20} color="white" />
          <Text style={styles.buttonText}>Données</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#25292e", paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "white", marginBottom: 20, textAlign: "center" },
  image: { width: 250, height: 250, resizeMode: "contain", marginVertical: 20 },
  statusContainer: { alignItems: "center", marginBottom: 20 },
  statusLabel: { fontSize: 16, color: "white" },
  status: { fontSize: 18, fontWeight: "bold", marginTop: 5 },
  active: { color: "limegreen" },
  inactive: { color: "red" },
  modeButtonContainer: { flexDirection: "row", gap: 15, marginBottom: 20 },
  modeButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#008CBA", paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20 },
  selectedMode: { backgroundColor: "#005f8b" },
  buttonContainer: { position: "absolute", bottom: 60, left: 0, right: 0, justifyContent: "center", alignItems: "center", flexDirection: "row" },
  button: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffd33d", paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  buttonText: { fontSize: 14, color: "white", marginLeft: 8 },
  toggleButton: { marginTop: 20, backgroundColor: "#ff5733", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  toggleButtonText: { fontSize: 14, color: "white", fontWeight: "bold" },
});
