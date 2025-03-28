import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { fetchSensorData, getLatestSensorData, setModeStateCallback } from "./websocket";

interface SensorData {
  Humidité?: number;
  NiveauDeau?: number;
  Débit?: number;
}

export default function DataScreen() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Essayer de récupérer d'abord les données WebSocket
      const wsData = getLatestSensorData();
      
      if (wsData) {
        // Si des données WebSocket sont disponibles, les utiliser
        setSensorData(wsData);
      } else {
        // Sinon, utiliser la méthode HTTP
        const result: SensorData | null = await fetchSensorData();
        setSensorData(result);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données des capteurs :", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: { mode?: string; action?: string }) => {
      // Mettre à jour les données si de nouvelles données sont disponibles
      const wsData = getLatestSensorData();
      if (wsData) {
        setSensorData(wsData);
      }
    });

    fetchData();
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      // Réinitialiser le callback
      setModeStateCallback(null);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Données des capteurs</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View>
          <Text style={styles.dataText}>Humidité du sol : {sensorData?.Humidité ?? "N/A"}%</Text>
          <Text style={styles.dataText}>Niveau d'eau : {sensorData?.NiveauDeau ?? "N/A"} cm</Text>
          <Text style={styles.dataText}>Débit d'eau : {sensorData?.Débit ?? "N/A"} L/min</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#25292e",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "white",
  },
  dataText: {
    color: "white",
  },
});