import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { TextInput, Button, Text, Checkbox } from "react-native-paper";
import { useRouter } from "expo-router";

// Définition des constantes pour les identifiants
const USERNAME = "Admin";
const PASSWORD = "1234";

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [wantsToSendEmail, setWantsToSendEmail] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleLogin = () => {
    if (username === USERNAME && password === PASSWORD) {
      if (wantsToSendEmail && email) {
        sendEmail(email);
      }
      Alert.alert("Connexion réussie", `Bienvenue, ${username} !`);
      router.push("/home"); // Redirection vers home.tsx
    } else {
      Alert.alert("Erreur", "Nom d'utilisateur ou mot de passe incorrect");
    }
  };

  const sendEmail = (email: string) => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dGlsaXNhdGV1ciI6InBheWV0Iiwicm9sZSI6Ik5ld3RvbkNpZWw5MkFJQDIwMjUhIiwiaWF0IjoxNzM4NjU0NTE4LCJleHAiOjE3Mzg2NTgxMTh9.95Yed7YjKzW8uXnncY3fo4Tk13-U23muORzdQXFtaNA"; 

    
    const data = {
      mail: email
    };
    
    fetch('https://api.arrosage.cielnewton.fr/mail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
      console.log('Données reçues:', data);
      Alert.alert("Succès", "Email envoyé avec succès");
    })
    .catch(error => {
      console.error('Erreur:', error);
      Alert.alert("Erreur", "Échec de l'envoi de l'email");
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>Connexion</Text>
      <TextInput
        label="Nom d'utilisateur"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      
      <View style={styles.checkboxContainer}>
        <Checkbox
          status={wantsToSendEmail ? 'checked' : 'unchecked'}
          onPress={() => setWantsToSendEmail(!wantsToSendEmail)}
        />
        <Text style={styles.checkboxLabel}>Je souhaite recevoir un email de confirmation</Text>
      </View>
      
      {wantsToSendEmail && (
        <TextInput
          label="Adresse email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
        />
      )}
      
      <Button mode="contained" onPress={handleLogin} style={styles.button}>
        Se connecter
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { textAlign: "center", marginBottom: 20 },
  input: { marginBottom: 10 },
  button: { marginTop: 10 },
  checkboxContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 10 
  },
  checkboxLabel: { 
    marginLeft: 8 
  }
});

export default LoginScreen;