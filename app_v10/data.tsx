import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { fetchSensorData, getLatestSensorData, setModeStateCallback, setRawDataCallback, getLatestModeState } from "./websocket";
import { useRouter } from "expo-router";

interface SensorData {
  Humidité?: number | null;
  NiveauDeau?: number | null;
  Débit?: number | null;
}

// Interface pour les données brutes reçues du WebSocket
interface RawSensorData {
  données?: {
    date: string;
    deviceName: string;
    valeur: string;
  };
  dernieresDonnees?: Array<{
    date: string;
    deviceName: string;
    valeur: string;
  }>;
}

export default function DataScreen() {
  const router = useRouter();
  const [sensorData, setSensorData] = useState<SensorData>({
    Humidité: null,
    NiveauDeau: null,
    Débit: null
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fonction pour traiter les données brutes et les convertir au format souhaité
  const processSensorData = (data: any): SensorData => {
    // Si les données sont déjà au format attendu de getLatestSensorData
    if (data && (data.Humidité !== undefined || data.NiveauDeau !== undefined || data.Débit !== undefined)) {
      return data as SensorData;
    }

    // Pour traiter une seule donnée
    if (data && data.données) {
      const { deviceName, valeur } = data.données;
      const newSensorData: SensorData = { ...sensorData };
      
      if (deviceName === "Capteur d'humidité") {
        newSensorData.Humidité = parseFloat(valeur);
      } else if (deviceName === "Capteur de niveau d'eau") {
        newSensorData.NiveauDeau = parseFloat(valeur);
      } else if (deviceName === "Débimètre") {
        newSensorData.Débit = parseFloat(valeur);
      }
      
      return newSensorData;
    }

    // Pour traiter un tableau de données
    if (data && data.dernieresDonnees && Array.isArray(data.dernieresDonnees)) {
      const newSensorData: SensorData = { ...sensorData };
      
      data.dernieresDonnees.forEach((item: any) => {
        const { deviceName, valeur } = item;
        
        if (deviceName === "Capteur d'humidité") {
          newSensorData.Humidité = parseFloat(valeur);
        } else if (deviceName === "Capteur de niveau d'eau") {
          newSensorData.NiveauDeau = parseFloat(valeur);
        } else if (deviceName === "Débimètre") {
          newSensorData.Débit = parseFloat(valeur);
        }
      });
      
      return newSensorData;
    }

    return data as SensorData;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Essayer de récupérer d'abord les données WebSocket
      const wsData = getLatestSensorData();
      
      if (wsData && (wsData.Humidité !== null || wsData.NiveauDeau !== null || wsData.Débit !== null)) {
        // Si des données WebSocket sont disponibles, les utiliser
        setSensorData(prev => ({ ...prev, ...wsData }));
        setLastUpdate(new Date());
      } else {
        // Sinon, utiliser la méthode HTTP
        const result = await fetchSensorData();
        if (result) {
          const processedData = processSensorData(result);
          setSensorData(prev => ({ ...prev, ...processedData }));
          setLastUpdate(new Date());
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données des capteurs :", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: any) => {
      console.log("DataScreen: Mise à jour WebSocket reçue", newState);
      
      // Traitement des mises à jour de mode et d'action
      if (newState.mode && newState.action) {
        // Naviguer vers la page d'accueil si changement important
        // Ou vous pouvez afficher une notification à la place
        // router.push("/");
        console.log("DataScreen: Nouvel état du système:", newState);
      }
      
      // Vérifier s'il y a de nouvelles données des capteurs
      if (newState && newState.dataUpdate) {
        const wsData = getLatestSensorData();
        if (wsData) {
          setSensorData(prev => ({ ...prev, ...wsData }));
          setLastUpdate(new Date());
        }
      }
    });
    
    // Configuration du callback pour les données brutes
    setRawDataCallback((rawData: any) => {
      if (rawData) {
        try {
          const processedData = processSensorData(rawData);
          setSensorData(prev => ({ ...prev, ...processedData }));
          setLastUpdate(new Date());
        } catch (error) {
          console.error("Erreur lors du traitement des données brutes:", error);
        }
      }
    });

    fetchData();
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      // Ne pas réinitialiser les callbacks pour permettre le traitement en arrière-plan
      // setModeStateCallback(null);
      // setRawDataCallback(null);
    };
  }, []);

  // Formatage des valeurs pour l'affichage
  const formatValue = (value: number | null | undefined, unit: string): string => {
    if (value === null || value === undefined) return "N/A";
    return `${parseFloat(value.toString()).toFixed(2)} ${unit}`;
  };

  // Formatage de la date de dernière mise à jour
  const formatLastUpdate = (): string => {
    if (!lastUpdate) return "Jamais";
    return lastUpdate.toLocaleTimeString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Données des capteurs</Text>
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      <View style={styles.dataContainer}>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Humidité du sol :</Text>
          <Text style={styles.dataValue}>{formatValue(sensorData?.Humidité, "%")}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Niveau d'eau :</Text>
          <Text style={styles.dataValue}>{formatValue(sensorData?.NiveauDeau, "cm")}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Débit d'eau :</Text>
          <Text style={styles.dataValue}>{formatValue(sensorData?.Débit, "L/min")}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Dernière mise à jour :</Text>
          <Text style={styles.dataValue}>{formatLastUpdate()}</Text>
        </View>
      </View>
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "white",
    textAlign: "center",
  },
  dataContainer: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#495057",
  },
  dataLabel: {
    fontSize: 18,
    fontWeight: "500",
    color: "#adb5bd",
  },
  dataValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
});