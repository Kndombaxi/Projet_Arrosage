import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { getData } from "./api";

interface SensorData {
  action?: string;
}

export default function DataScreen() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result: SensorData = await getData();
        setSensorData(result);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      }
      setLoading(false);
    };
    
    fetchData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Données du capteur</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View>
          <Text>État actuel : {sensorData?.action ?? "Aucune donnée"}</Text>
        </View>
      )}
    </View>
  );
}

// ✅ Ajout des styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
});