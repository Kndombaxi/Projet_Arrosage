import { View, Text, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { getData } from "./api";  // Import de la fonction API

export default function DataScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fonction pour récupérer les données
  const loadData = async () => {
    setLoading(true);
    const result = await getData();  // Récupération des données
    if (result) setData(result);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Données de l'Arrosage Intelligent</Text>

      {loading ? (
        <Text style={styles.loadingText}>Chargement...</Text>
      ) : (
        <Text style={styles.dataText}>{data ? JSON.stringify(data, null, 2) : "Aucune donnée"}</Text>
      )}

      <Button title="Charger les Données" onPress={loadData} color="#ffd33d" />
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
