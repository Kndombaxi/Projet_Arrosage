import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";
import { setData, getLatestModeState, setModeStateCallback } from "./websocket";

// Types de données
type ModeType = "manuel" | "auto";
type ActionType = "activer" | "desactiver";

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeType>("manuel");
  const [action, setAction] = useState<ActionType>("desactiver");
  const [loading, setLoading] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState(false);

  // Gestion du changement de mode
  const handleModeChange = async (newMode: ModeType) => {
    if (pendingModeChange || mode === newMode) return; // Éviter les doubles clics ou le clic sur le mode actif
    
    setPendingModeChange(true);
    
    try {
      if (newMode === "auto") {
        // En mode auto, on envoie SEULEMENT le mode
        await setData(null, "auto");
        console.log("Mode automatique activé");
      } else {
        // En mode manuel, on ne fait RIEN - on change juste l'interface
        // On n'envoie pas de requête au serveur
        console.log(`Mode manuel activé, en attente d'action de l'utilisateur`);
      }
      
      // Mettre à jour l'état local immédiatement
      setMode(newMode);
    } catch (error) {
      console.error("Erreur lors du changement de mode :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setMode(modeState.mode as ModeType);
    } finally {
      setPendingModeChange(false);
    }
  };

  // Effet pour configurer le callback WebSocket
  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: { mode: ModeType; action: ActionType }) => {
      console.log("HomeScreen: WebSocket update reçu:", newState);
      
      // Mise à jour du mode et de l'action
      setMode(newState.mode);
      setAction(newState.action);
      
      // Désactiver l'indicateur de chargement si actif
      if (loading) {
        setLoading(false);
      }
      
      if (pendingModeChange) {
        setPendingModeChange(false);
      }
    });

    // Récupération initiale des données
    const modeState = getLatestModeState();
    setMode(modeState.mode as ModeType);
    setAction(modeState.action as ActionType);
    
    return () => {
      // Nettoyer les gestionnaires d'événements
    };
  }, []); // Dépendances vides pour s'exécuter une seule fois

  const toggleWatering = async () => {
    if (mode !== "manuel") {
      console.log("Impossible d'activer/désactiver en mode automatique");
      return;
    }
    
    const newAction: ActionType = action === "activer" ? "desactiver" : "activer";
    
    // Activer l'indicateur de chargement
    setLoading(true);
    
    try {
      // En mode manuel, on envoie le mode ET l'action ensemble
      await setData(newAction, "manuel");
      console.log(`Mode manuel, État: ${newAction} envoyé`);
      
      // Mise à jour de l'UI après confirmation
      setAction(newAction);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setAction(modeState.action as ActionType);
    } finally {
      // Désactiver l'indicateur de chargement
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <Text style={styles.title}>Bienvenue dans l'application d'arrosage intelligent</Text>
      <Image source={require("../assets/images/20250318_120829.jpg")} style={styles.image} />
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>État de l'arroseur :</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.status, action === "activer" ? styles.active : styles.inactive]}>
            {action.toUpperCase()}
          </Text>
          {loading && <ActivityIndicator style={styles.loader} size="small" color="#fff" />}
        </View>
      </View>
      
      <View style={styles.modeButtonContainer}>
        <TouchableOpacity
          style={[
            styles.modeButton, 
            mode === "manuel" && styles.selectedMode,
            (pendingModeChange || mode === "manuel") && styles.disabledButton
          ]}
          onPress={() => handleModeChange("manuel")}
          disabled={pendingModeChange || mode === "manuel"}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton, 
            mode === "auto" && styles.selectedMode,
            (pendingModeChange || mode === "auto") && styles.disabledButton
          ]}
          onPress={() => handleModeChange("auto")}
          disabled={pendingModeChange || mode === "auto"}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>
      
      {mode === "manuel" && (
        <TouchableOpacity 
          style={[styles.toggleButton, loading && styles.disabledButton]}
          onPress={toggleWatering}
          disabled={loading}
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
  statusRow: {
    flexDirection: "row",
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
  loader: {
    marginLeft: 10,
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
  disabledButton: {
    opacity: 0.5,
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