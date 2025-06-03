import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getLatestModeState, setData, setModeStateCallback } from "./websocket";

// Types de données
type ModeType = "manuel" | "auto";
type ActionType = "activer" | "desactiver";

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeType>("auto");
  const [action, setAction] = useState<ActionType>("desactiver");
  const [loading, setLoading] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // États pour la modification du mot de passe
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Récupérer le nom d'utilisateur au chargement
  useEffect(() => {
    const getUsernameFromStorage = async () => {
      try {
        const storedUsername = await AsyncStorage.getItem('username');
        if (storedUsername) {
          setUsername(storedUsername);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du nom d\'utilisateur:', error);
      }
    };
    
    getUsernameFromStorage();
  }, []);

  // Gestion du changement de mode
  const handleModeChange = async (newMode: ModeType) => {
    if (pendingModeChange || mode === newMode || loading) return; // Éviter les doubles clics ou le clic sur le mode actif
    
    setPendingModeChange(true);
    setLoading(true);
    
    try {
      if (newMode === "auto") {
        // En mode auto, on envoie SEULEMENT le mode au serveur
        await setData(null, "auto");
        console.log("Mode automatique activé - requête envoyée");
        
        // Ne pas mettre à jour l'état local tant que nous n'avons pas reçu la confirmation
        // L'état sera mis à jour via le callback WebSocket
      } else {
        // En mode manuel, on ne fait RIEN - on change juste l'interface localement
        // On n'envoie pas de requête au serveur
        console.log(`Mode manuel sélectionné localement, en attente d'action de l'utilisateur`);
        
        // Mettre à jour l'interface utilisateur localement
        setMode(newMode);
        // Dans ce cas particulier, on peut désactiver le chargement immédiatement
        // puisqu'aucune réponse du serveur n'est attendue
        setLoading(false);
        setPendingModeChange(false);
      }
      
      // Réinitialiser le message d'erreur
      setErrorMessage(null);
    } catch (error) {
      console.error("Erreur lors du changement de mode :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setMode(modeState.mode as ModeType);
      
      // Désactiver les états de chargement
      setLoading(false);
      setPendingModeChange(false);
    }
  };

  // Effet pour configurer le callback WebSocket
  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: { 
      mode: ModeType; 
      action: ActionType; 
      errorMessage?: string;
      dataUpdate?: boolean;
    }) => {
      console.log("HomeScreen: WebSocket update reçu:", newState);
      
      // Si un message d'erreur est présent, l'afficher
      if (newState.errorMessage) {
        setErrorMessage(newState.errorMessage);
        
        // Afficher une alerte avec le message d'erreur
        Alert.alert(
          "Message du système",
          newState.errorMessage,
          [{ text: "OK", onPress: () => console.log("Alerte fermée") }]
        );
        
        // Désactiver l'indicateur de chargement si actif
        setLoading(false);
        setPendingModeChange(false);
        return;
      }
      
      // Mise à jour du mode et de l'action seulement si ce n'est pas un message d'erreur
      if (newState.dataUpdate) {
        console.log("Mise à jour de l'état: mode =", newState.mode, ", action =", newState.action);
        setMode(newState.mode);
        setAction(newState.action);
      }
      
      // Désactiver systématiquement les indicateurs de chargement après une mise à jour
      setLoading(false);
      setPendingModeChange(false);
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
    if (mode !== "manuel" || loading) {
      console.log("Impossible d'activer/désactiver en mode automatique ou pendant un chargement");
      return;
    }
    
    const newAction: ActionType = action === "activer" ? "desactiver" : "activer";
    
    // Activer l'indicateur de chargement
    setLoading(true);
    // Réinitialiser tout message d'erreur précédent
    setErrorMessage(null);
    
    try {
      // En mode manuel, on envoie le mode ET l'action ensemble
      await setData(newAction, "manuel");
      console.log(`Mode manuel, État: ${newAction} envoyé au serveur`);
      
      // Ne pas mettre à jour l'UI immédiatement - attendre la confirmation du serveur
      // La mise à jour sera effectuée via le callback WebSocket
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'état d'arrosage :", error);
      // Revenir à l'état précédent en cas d'erreur
      const modeState = getLatestModeState();
      setAction(modeState.action as ActionType);
      
      // Afficher un message d'erreur
      setErrorMessage("Erreur lors de la communication avec le serveur. Veuillez réessayer.");
      
      // Désactiver l'indicateur de chargement
      setLoading(false);
    }
  };

  const openPasswordChangeModal = () => {
    setShowPasswordChangeModal(true);
  };

  const handleChangePassword = async () => {
    // Validations
    if (!currentPassword) {
      Alert.alert("Erreur", "Veuillez saisir votre mot de passe actuel");
      return;
    }
    
    if (!newPassword) {
      Alert.alert("Erreur", "Veuillez saisir un nouveau mot de passe");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Erreur", "Les nouveaux mots de passe ne correspondent pas");
      return;
    }

    setIsChangingPassword(true);

    try {
      // Récupération du token stocké
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('Token non disponible');
      }

      console.log("Envoi de la requête de modification de mot de passe pour l'utilisateur:", username);
      
      // Création de l'objet de la requête pour le console.log
      const requestBody = {
        id: username,
        ancienMDP: currentPassword,
        newMDP: newPassword
      };
      console.log("Données envoyées:", JSON.stringify(requestBody));

      const response = await fetch('https://api.arrosage.cielnewton.fr/modifier-mdp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Ajout du token dans l'en-tête
        },
        body: JSON.stringify(requestBody),
      });

      // Récupérer le texte brut de la réponse
      const responseText = await response.text();
      console.log("LOG Réponse brute du serveur:", responseText);
      
      // Tenter de parser en JSON si possible
      let data;
      try {
        data = JSON.parse(responseText);
        
        // Vérifier spécifiquement les messages d'erreur connus
        if (data && data.message) {
          // Vérifier si c'est l'erreur "Ancien mot de passe incorrect"
          if (data.message === "Ancien mot de passe incorrect") {
            Alert.alert("Erreur", "Ancien mot de passe incorrect");
            return; // Sortir de la fonction sans afficher le message de succès
          }
          
          // Vérifier si c'est l'erreur "Mot de passe trop faible"
          if (data.message.includes("Le mot de passe est trop faible")) {
            Alert.alert("Erreur", data.message);
            return; // Sortir de la fonction sans afficher le message de succès
          }
        }
      } catch (e) {
        console.log("La réponse n'est pas au format JSON ou erreur de traitement");
        data = { message: responseText };
      }

      if (!response.ok) {
        console.error("Erreur serveur:", response.status, response.statusText);
        Alert.alert("Erreur", data.message || "Erreur lors du changement de mot de passe");
        return; // Sortir de la fonction sans afficher le message de succès
      }

      console.log("Modification de mot de passe réussie");
      Alert.alert("Succès", "Votre mot de passe a été modifié avec succès");
      setShowPasswordChangeModal(false);
      
      // Réinitialisation des champs
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
    } catch (error: any) {
      console.error('Erreur de modification du mot de passe:', error);
      Alert.alert("Erreur", "Échec de la modification du mot de passe. Vérifiez vos informations.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Vérifier si des actions sont en cours (chargement ou changement de mode)
  const isOperationInProgress = loading || pendingModeChange;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <Text style={styles.title}>Bienvenue dans l'application d'arrosage intelligent</Text>
      <Image source={require("../images/20250318_120829.jpg")} style={styles.image} />
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>État de l'arroseur :</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.status, action === "activer" ? styles.active : styles.inactive]}>
            {action.toUpperCase()}
          </Text>
          {loading && <ActivityIndicator style={styles.loader} size="small" color="#fff" />}
        </View>
      </View>
      
      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      )}
      
      <View style={styles.modeButtonContainer}>
        <TouchableOpacity
          style={[
            styles.modeButton, 
            mode === "manuel" && styles.selectedMode,
            (isOperationInProgress || mode === "manuel") && styles.disabledButton
          ]}
          onPress={() => handleModeChange("manuel")}
          disabled={isOperationInProgress || mode === "manuel"}
        >
          <Ionicons name="construct" size={20} color="white" />
          <Text style={styles.buttonText}>Manuel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton, 
            mode === "auto" && styles.selectedMode,
            (isOperationInProgress || mode === "auto") && styles.disabledButton
          ]}
          onPress={() => handleModeChange("auto")}
          disabled={isOperationInProgress || mode === "auto"}
        >
          <Ionicons name="sync" size={20} color="white" />
          <Text style={styles.buttonText}>Automatique</Text>
        </TouchableOpacity>
      </View>
      
      {mode === "manuel" && (
        <TouchableOpacity 
          style={[styles.toggleButton, isOperationInProgress && styles.disabledButton]}
          onPress={toggleWatering}
          disabled={isOperationInProgress}
        >
          <Text style={styles.toggleButtonText}>
            {action === "activer" ? "Arrêter l'arrosage" : "Activer l'arrosage"}
          </Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, isOperationInProgress && styles.disabledButton]}
          onPress={() => router.push("/data")}
          disabled={isOperationInProgress}
        >
          <Ionicons name="analytics" size={20} color="white" />
          <Text style={styles.buttonText}>Données</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, isOperationInProgress && styles.disabledButton]}
          onPress={() => router.push("./historyScreen")}
          disabled={isOperationInProgress}
        >
          <Ionicons name="time" size={20} color="white" />
          <Text style={styles.buttonText}>Historique</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, isOperationInProgress && styles.disabledButton]}
          onPress={openPasswordChangeModal}
          disabled={isOperationInProgress}
        >
          <Ionicons name="key" size={20} color="white" />
          <Text style={styles.buttonText}>Changer mot de passe</Text>
        </TouchableOpacity>
      </View>
      
      {/* Modal pour changer le mot de passe */}
      <Modal
        visible={showPasswordChangeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordChangeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier votre mot de passe</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowPasswordChangeModal(false)}
              >
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalConfirmButton, isChangingPassword && styles.disabledButton]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  errorContainer: {
    padding: 10,
    backgroundColor: "rgba(255, 59, 48, 0.2)",
    borderRadius: 5,
    marginBottom: 20,
    width: "100%",
  },
  errorText: {
    color: "#ff3b30",
    textAlign: "center",
    fontWeight: "500",
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
    flexWrap: "wrap",
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6c757d",
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    marginVertical: 5,
  },
  
  // Styles pour la modal de changement de mot de passe
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#343a40',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#495057',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#495057',
    color: 'white',
    padding: 12,
    borderRadius: 5,
    marginBottom: 15,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  modalConfirmButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});