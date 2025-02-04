import { View, Text, Button, StyleSheet } from "react-native";
import { useState } from "react";

export default function DataScreen() {
  const [data, setData] = useState<any>(null);  // Stocker les données
  const [loading, setLoading] = useState(false); // Indicateur de chargement

  // Fonction pour récupérer les données
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://64.225.104.146:3005'); 
      const result = await response.json();
      setData(result);  // Mettre à jour les données récupérées
      alert(JSON.stringify(result, null, 2));  // Afficher un alert avec les données
    } catch (error) {
      alert('Erreur de récupération des données');
    } finally {
      setLoading(false);  // Réinitialiser l'état de chargement
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Données de l'Arrosage Intelligent</Text>

      {/* Afficher un message de chargement si les données sont en cours de récupération */}
      {loading ? (
        <Text style={styles.loadingText}>Chargement des données...</Text>
      ) : (
        <View style={styles.dataContainer}>
          {/* Afficher les données si elles existent */}
          {data ? (
            <Text style={styles.dataText}>{JSON.stringify(data, null, 2)}</Text>
          ) : (
            <Text style={styles.noDataText}>Aucune donnée disponible.</Text>
          )}
        </View>
      )}

      {/* Bouton pour récupérer les données */}
      <Button 
        title="Charger les Données" 
        onPress={fetchData} 
        color="#ffd33d"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#25292e" 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    color: "white", 
    marginBottom: 20 
  },
  loadingText: { 
    fontSize: 18, 
    color: "yellow", 
    marginVertical: 20 
  },
  dataContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  dataText: { 
    fontSize: 16, 
    color: "white" 
  },
  noDataText: { 
    fontSize: 16, 
    color: "white", 
    textAlign: "center" 
  }
});
