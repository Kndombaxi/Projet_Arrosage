import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";
import { getData, setData, getLatestModeState, setModeStateCallback } from "./websocket";

// Types de données
type ModeType = "manuel" | "auto";
type ActionType = "activer" | "desactiver";

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeType>("manuel");
  const [action, setAction] = useState<ActionType>("desactiver");
  const [loading, setLoading] = useState(false);

  const fetchSensorData = async () => {
    try {
      // Récupérer les données WebSocket actuelles
      const modeState = getLatestModeState();
      setMode(modeState.mode as ModeType);
      setAction(modeState.action as ActionType);
    } catch (error) {
      console.error("Erreur lors de la récupération des données du capteur :", error);
    }
  };

  // Gestion du changement de mode
  const handleModeChange = async (newMode: ModeType) => {
    // Mettre à jour l'état local immédiatement pour une UI réactive
    setMode(newMode);
    
    try {
      // En mode auto, on envoie uniquement le mode sans action
      if (newMode === "auto") {
        await setData(null, "auto");
        console.log("Mode automatique activé");
      } else {
        // En mode manuel, on envoie à la fois le mode ET l'action actuelle
        await setData(action, "manuel");
        console.log(`Mode manuel activé, état actuel: ${action}`);
      }
    } catch (error) {
      console.error("Erreur lors du changement de mode :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setMode(modeState.mode as ModeType);
    }
  };

  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: { mode: ModeType; action: ActionType }) => {
      console.log("HomeScreen: WebSocket update reçu:", newState);
      
      // Mise à jour du mode et de l'action
      setMode(newState.mode);
      setAction(newState.action);
    });

    // Récupération initiale des données
    fetchSensorData();
    
    // Configurer un intervalle pour récupérer les données régulièrement
    const dataInterval = setInterval(() => {
      if (mode === "auto") {
        fetchSensorData();
      }
    }, 5000);
    
    return () => {
      clearInterval(dataInterval);
      // Ne pas réinitialiser le callback pour permettre le traitement en arrière-plan
      // setModeStateCallback(null);
    };
  }, [mode]);

  const toggleWatering = async () => {
    const newState: ActionType = action === "activer" ? "desactiver" : "activer";
    
    // Mise à jour immédiate de l'UI pour fluidité
    setAction(newState);

    try {
      // Envoyer explicitement l'action "activer" ou "desactiver"
      await setData(newState, "manuel");
      console.log(`Mode manuel, Action: ${newState} envoyé`);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setAction(modeState.action as ActionType);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
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
          style={[
            styles.modeButton, 
            mode === "manuel" && styles.selectedMode
          ]}
          onPress={() => handleModeChange("manuel")}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton, 
            mode === "auto" && styles.selectedMode
          ]}
          onPress={() => handleModeChange("auto")}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>
      {mode === "manuel" && (
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={toggleWatering}
        >
          <Text style={styles.toggleButtonText}>
            {action === "activer" ? "Arrêter l'arrosage" : "Activer l'arrosage"}
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push("/data")}
        >
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
    backgroundColor: "#343a40", 
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "white",
  },
  image: {
    width: "100%",
    height: 350,
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
    color: "white",
  },
  status: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
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