import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";
import { getData, setData } from "./api";

// Types de données
type ModeType = "manuel" | "auto";
type ActionType = "activer" | "desactiver";

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeType>("manuel");
  const [action, setAction] = useState<ActionType>("desactiver");
  const [loading, setLoading] = useState(false);

  const fetchSensorData = async () => {
    setLoading(true);
    try {
      const result = await getData();
      if (result) setAction(result.action ? "activer" : "desactiver");
    } catch (error) {
      console.error("Erreur lors de la récupération des données du capteur :", error);
    }
    setLoading(false);
  };

  // Gestion du changement de mode
  const handleModeChange = async (newMode: ModeType) => {
    setLoading(true);
    setMode(newMode);
    
    try {
      // En mode auto, on envoie uniquement le mode sans action
      if (newMode === "auto") {
        await setData(null, "auto");
        console.log("Mode automatique activé");
        // Récupérer immédiatement l'état actuel
        fetchSensorData();
      } else {
        // En mode manuel, on envoie à la fois le mode ET l'action actuelle
        await setData(action, "manuel");
        console.log(`Mode manuel activé, état actuel: ${action}`);
      }
    } catch (error) {
      console.error("Erreur lors du changement de mode :", error);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    // Récupération initiale des données
    fetchSensorData();
    
    // Configurer un intervalle pour récupérer les données régulièrement
    const dataInterval = setInterval(() => {
      if (mode === "auto") {
        fetchSensorData();
      }
    }, 5000);
    
    return () => clearInterval(dataInterval);
  }, [mode]);

  const toggleWatering = async () => {
    setLoading(true);
    const newState: ActionType = action === "activer" ? "desactiver" : "activer";
    setAction(newState);

    try {
      await setData(newState, "manuel");
      console.log(`Mode manuel, Action: ${newState} envoyé`);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue dans l'application d'arrosage intelligent</Text>
      <Image source={require("../assets/images/20250318_120829.jpg")} style={styles.image} />
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>État de l'arroseur :</Text>
        <Text style={[styles.status, action === "activer" ? styles.active : styles.inactive]}>
          {action.toUpperCase()}
        </Text>
      </View>
      <View style={styles.modeButtonContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "manuel" && styles.selectedMode]}
          onPress={() => handleModeChange("manuel")}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "auto" && styles.selectedMode]}
          onPress={() => handleModeChange("auto")}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>
      {mode === "manuel" && (
        <TouchableOpacity style={styles.toggleButton} onPress={toggleWatering}>
          <Text style={styles.toggleButtonText}>
            {action === "activer" ? "Arrêter l'arrosage" : "Activer l'arrosage"}
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    fontSize: 24,
    fontWeight: "700",
  },
  active: {
    color: "green",
  },
  inactive: {
    color: "red",
  },
  modeButtonContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 10,
  },
  selectedMode: {
    backgroundColor: "#0056b3",
  },
  buttonText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
  },
  toggleButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
  },
  toggleButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6c757d",
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 10,
  },
});