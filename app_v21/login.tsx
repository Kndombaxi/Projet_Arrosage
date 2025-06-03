import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Checkbox, Text, TextInput } from "react-native-paper";
import { initWebSocket } from './websocket'; // Importation de la fonction initWebSocket

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [wantsToSendEmail, setWantsToSendEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Erreur", "Veuillez saisir un nom d'utilisateur et un mot de passe");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('https://api.arrosage.cielnewton.fr/connexion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: username,
          mdp: password
        }),
      });

      const data = await response.json();
      console.log('Réponse brute du serveur:', data);

      if (!response.ok) {
        // Vérifier si l'erreur est due à un mot de passe trop faible
        if (data.message && data.message.includes("Le mot de passe est trop faible")) {
          throw new Error("mot_de_passe_faible");
        }
        // Vérifier si l'erreur est due à un identifiant ou mot de passe incorrect
        else if (data.message && data.message.includes("identifiant ou mot de passe incorrect")) {
          throw new Error("Identifiant ou mot de passe incorrect");
        } else {
          throw new Error(data.message || "Erreur d'authentification");
        }
      }

      // Vérifier si le token existe avant de le stocker
      const token = data.token;
      if (!token) {
        // Modifié: Si aucun token n'est reçu, considérer que c'est un mot de passe incorrect
        throw new Error("Mot de passe incorrect");
      }
      
      console.log('Token:', token);
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('username', username);

      // Initialiser la connexion WebSocket après avoir obtenu le token
      const connected = await initWebSocket();
      console.log('WebSocket connecté:', connected);

      if (wantsToSendEmail && email) {
        await sendEmail(email);
      }

      Alert.alert("Connexion réussie", `Bienvenue, ${username} !`);
      router.push("/home");
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erreur de connexion:', error);
        
        // Message spécifique pour les différentes erreurs
        if (error.message === "mot_de_passe_faible") {
          Alert.alert(
            "Mot de passe trop faible", 
            "Le mot de passe doit avoir au moins 8 caractères, 1 lettre majuscule et minuscule, au moins 1 chiffre et au moins un caractère spécial."
          );
        } else if (error.message.includes("mot de passe incorrect") || error.message.includes("Mot de passe incorrect")) {
          Alert.alert("Erreur d'authentification", "Le mot de passe que vous avez saisi est incorrect");
        } else {
          Alert.alert("Erreur", error.message);
        }
      } else {
        console.error('Erreur inconnue:', error);
        Alert.alert("Erreur", "Une erreur inconnue est survenue");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmail = async (email: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token non disponible');
      }

      const data = { mail: email };

      const response = await fetch('https://api.arrosage.cielnewton.fr/mail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      console.log('Données reçues:', responseData);

      // Vérifier spécifiquement le message d'erreur de format d'email
      if (responseData === "L'adresse mail ne correspond pas au format attendu." || 
          (typeof responseData === 'object' && responseData.message === "L'adresse mail ne correspond pas au format attendu.")) {
        Alert.alert("Erreur", "Le format de l'adresse email est incorrect");
        return;
      }
      
      // Vérifier le message de succès
      if (responseData === "L'adresse mail a bien été enregistrée" || 
          (typeof responseData === 'object' && responseData.message === "L'adresse mail a bien été enregistrée")) {
        Alert.alert("Succès", "Le mail a été enregistré avec succès");
        return;
      }

      // Gérer d'autres réponses
      if (!response.ok) {
        if (typeof responseData === 'string') {
          throw new Error(responseData);
        } else {
          throw new Error(responseData.message || 'Erreur lors de l\'envoi de l\'email');
        }
      } else {
        Alert.alert("Succès", "Email envoyé avec succès");
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erreur:', error);
        Alert.alert("Erreur", error.message);
      } else {
        console.error('Erreur inconnue:', error);
        Alert.alert("Erreur", "Une erreur inconnue est survenue");
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>Connexion</Text>
        
        <TextInput
          label="Nom d'utilisateur"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          theme={{
            colors: {
              primary: '#007bff',
              text: 'white',
              placeholder: '#ffffff',
              background: '#495057',
              onSurfaceVariant: '#ffffff', // Couleur du label
              outline: '#007bff',
            }
          }}
          textColor="white"
          placeholderTextColor="#ffffff"
        />
        
        <TextInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          theme={{
            colors: {
              primary: '#007bff',
              text: 'white',
              placeholder: '#ffffff',
              background: '#495057',
              onSurfaceVariant: '#ffffff', // Couleur du label
              outline: '#007bff',
            }
          }}
          textColor="white"
          placeholderTextColor="#ffffff"
        />

        <View style={styles.checkboxContainer}>
          <Checkbox
            status={wantsToSendEmail ? 'checked' : 'unchecked'}
            onPress={() => setWantsToSendEmail(!wantsToSendEmail)}
            theme={{ colors: { primary: '#007bff' } }}
          />
          <Text style={styles.checkboxLabel}>Recevoir des informations concernant la cuve</Text>
        </View>

        {wantsToSendEmail && (
          <TextInput
            label="Adresse email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            theme={{
              colors: {
                primary: '#007bff',
                text: 'white',
                placeholder: '#ffffff',
                background: '#495057',
                onSurfaceVariant: '#ffffff', // Couleur du label
                outline: '#007bff',
              }
            }}
            textColor="white"
            placeholderTextColor="#ffffff"
          />
        )}

        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          loading={isLoading}
          disabled={isLoading}
          buttonColor="#007bff"
        >
          Se connecter
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#25292e",
  },
  loginContainer: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 30,
  },
  input: {
    marginBottom: 15,
    backgroundColor: "#495057",
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
  },
  checkboxContainer: {
    flexDirection: "row", 
    alignItems: "center",
    marginBottom: 15,
    marginTop: 5,
  },
  checkboxLabel: {
    marginLeft: 8,
    color: "#adb5bd",
    fontSize: 16,
    flex: 1,
  }
});

export default LoginScreen;