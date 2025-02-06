import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";
import { getData, sendData, updateMode } from "./api";  // Importation des fonctions API

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"manuel" | "auto" | null>(null);
  const [isWatering, setIsWatering] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fonction pour récupérer l'état du capteur
  const fetchSensorData = async () => {
    setLoading(true);
    const result = await getData();
    if (result) setIsWatering(result.isWatering);
    setLoading(false);
  };

  // Mise à jour toutes les 5s en mode auto
  useEffect(() => {
    if (mode === "auto") {
      fetchSensorData();
      const interval = setInterval(fetchSensorData, 5000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Fonction pour activer/désactiver l'arrosage en mode manuel
  const toggleWatering = async () => {
    setLoading(true);
    const newState = !isWatering;
    setIsWatering(newState);

    await sendData(newState);  // Envoi de l'état à l'API

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue dans l'application d'arrosage intelligent</Text>

      <Image source={require("../assets/images/background-image.jpg")} style={styles.image} />

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>État de l'arroseur :</Text>
        <Text style={[styles.status, isWatering ? styles.active : styles.inactive]}>
          {isWatering ? "ACTIF" : "INACTIF"}
        </Text>
      </View>

      <View style={styles.modeButtonContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "manuel" && styles.selectedMode]}
          onPress={() => {
            setMode("manuel");
            updateMode("manuel"); // Envoi du mode à l'API
          }}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === "auto" && styles.selectedMode]}
          onPress={() => {
            setMode("auto");
            updateMode("auto"); // Envoi du mode à l'API
          }}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>

      {mode === "manuel" && (
        <TouchableOpacity style={styles.toggleButton} onPress={toggleWatering}>
          <Text style={styles.toggleButtonText}>
            {isWatering ? "Arrêter l'arrosage" : "Activer l'arrosage"}
          </Text>
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator size="large" color="#ffffff" />}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/data")}>
          <Ionicons name="analytics" size={20} color="white" />
          <Text style={styles.buttonText}>Données</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// (Les styles restent inchangés)


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#25292e",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  image: {
    width: 250,
    height: 250,
    resizeMode: "contain",
    marginVertical: 20,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    color: "white",
  },
  status: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 5,
  },
  active: {
    color: "limegreen",
  },
  inactive: {
    color: "red",
  },
  modeButtonContainer: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 20,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#008CBA",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  selectedMode: {
    backgroundColor: "#005f8b",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffd33d",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 14,
    color: "white",
    marginLeft: 8,
  },
  toggleButton: {
    marginTop: 20,
    backgroundColor: "#ff5733",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  toggleButtonText: {
    fontSize: 14,
    color: "white",
    fontWeight: "bold",
  },
  loadingContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 1,
  },
});
