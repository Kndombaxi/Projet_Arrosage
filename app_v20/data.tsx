import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  getLatestSensorData,
  setModeStateCallback,
  setRawDataCallback
} from "./websocket";

interface SensorData {
  Humidité?: number | null;
  NiveauDeau?: number | null;
  Débit?: number | null;
  capteur1?: number | null;
  capteur2?: number | null;
}

export default function DataScreen() {
  const router = useRouter();
  const [sensorData, setSensorData] = React.useState<SensorData>({
    Humidité: null,
    NiveauDeau: null,
    Débit: null,
    capteur1: null,
    capteur2: null
  });
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  // Fonction pour traiter les données brutes et les convertir au format souhaité
  const processSensorData = (data: any): SensorData => {
    try {
      // Si les données sont déjà au format attendu de getLatestSensorData
      if (data && (data.Humidité !== undefined || data.NiveauDeau !== undefined || data.Débit !== undefined || data.capteur1 !== undefined || data.capteur2 !== undefined)) {
        return data as SensorData;
      }

      // Pour traiter une seule donnée
      if (data && data.données) {
        const { deviceName, valeur, capteur1, capteur2 } = data.données;
        const newSensorData: SensorData = { ...sensorData };

        if (deviceName === "Capteur d'humidité" && valeur) {
          newSensorData.Humidité = parseFloat(valeur as string) || 0;
        } else if (deviceName === "Capteur de niveau d'eau" && valeur) {
          newSensorData.NiveauDeau = parseFloat(valeur as string) || 0;
        } else if (deviceName === "Débitmètre" && valeur) {
          newSensorData.Débit = parseFloat(valeur as string) || 0;
        } else if (deviceName === "level-sensor") {
          if (capteur1 !== undefined) newSensorData.capteur1 = capteur1;
          if (capteur2 !== undefined) newSensorData.capteur2 = capteur2;
        } else if ((deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 1") && valeur) {
          newSensorData.capteur1 = parseFloat(valeur as string) || 0;
        } else if ((deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 2") && valeur) {
          newSensorData.capteur2 = parseFloat(valeur as string) || 0;
        }

        return newSensorData;
      }

      // Pour traiter un tableau de données
      if (data && data.dernieresDonnees && Array.isArray(data.dernieresDonnees)) {
        const newSensorData: SensorData = { ...sensorData };

        data.dernieresDonnees.forEach((item: any) => {
          if (!item) return; // Ignorer les éléments null/undefined

          const { deviceName, valeur, capteur1, capteur2 } = item;

          if (deviceName === "Capteur d'humidité" && valeur) {
            newSensorData.Humidité = parseFloat(valeur) || 0;
          } else if (deviceName === "Capteur de niveau d'eau" && valeur) {
            newSensorData.NiveauDeau = parseFloat(valeur) || 0;
          } else if (deviceName === "Débitmètre" && valeur) {
            newSensorData.Débit = parseFloat(valeur) || 0;
          } else if (deviceName === "level-sensor") {
            if (capteur1 !== undefined) newSensorData.capteur1 = capteur1;
            if (capteur2 !== undefined) newSensorData.capteur2 = capteur2;
          } else if ((deviceName === "Capteur eau supérieur à 500L" || deviceName === "Capteu de présence d'eau 1") && valeur) {
            newSensorData.capteur1 = parseFloat(valeur) || 0;
          } else if ((deviceName === "Capteur de présence d'eau" || deviceName === "Capteu de présence d'eau 2") && valeur) {
            newSensorData.capteur2 = parseFloat(valeur) || 0;
          }
        });

        return newSensorData;
      }

      return data as SensorData;
    } catch (error) {
      console.error("Erreur dans processSensorData:", error);
      return sensorData; // Retourner les données actuelles en cas d'erreur
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Récupérer uniquement les données WebSocket
      const wsData = getLatestSensorData();

      if (wsData && (wsData.Humidité !== null || wsData.NiveauDeau !== null || wsData.Débit !== null || wsData.capteur1 !== null || wsData.capteur2 !== null)) {
        // Utiliser les données WebSocket
        setSensorData(prev => ({ ...prev, ...wsData }));
        setLastUpdate(new Date());
      } else {
        console.log("Aucune donnée disponible actuellement");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données des capteurs :", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: any) => {
      try {
        // Vérifier s'il y a de nouvelles données des capteurs
        if (newState && newState.dataUpdate) {
          const wsData = getLatestSensorData();
          if (wsData) {
            setSensorData(prev => ({ ...prev, ...wsData }));
            setLastUpdate(new Date());
          }
        }
      } catch (error) {
        console.error("Erreur dans le callback de mode:", error);
      }
    });

    // Configuration du callback pour les données brutes
    setRawDataCallback((rawData: any) => {
      try {
        if (rawData) {
          const processedData = processSensorData(rawData);
          setSensorData(prev => ({ ...prev, ...processedData }));
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error("Erreur dans le callback des données brutes:", error);
      }
    });

    // Récupérer les données initiales
    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      clearInterval(interval);
      // Réinitialiser les callbacks
      setModeStateCallback(null);
      setRawDataCallback(null);
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
    try {
      return lastUpdate.toLocaleTimeString();
    } catch (error) {
      console.error("Erreur lors du formatage de la date:", error);
      return "Erreur de date";
    }
  };

  // Rendu des indicateurs de niveau
  const renderLevelIndicator = (value: number | null | undefined): React.ReactElement => {
    if (value === null || value === undefined) {
      return <View style={[styles.indicator, styles.indicatorGray]} />;
    }
    return value === 1 ?
      <View style={[styles.indicator, styles.indicatorGreen]} /> :
      <View style={[styles.indicator, styles.indicatorRed]} />;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/home")}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Données des capteurs</Text>
      </View>

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
          <Text style={styles.dataLabel}>Eau supérieur à 500L :</Text>
          {renderLevelIndicator(sensorData?.capteur1)}
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Présence d'eau :</Text>
          {renderLevelIndicator(sensorData?.capteur2)}
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Dernière mise à jour :</Text>
          <Text style={styles.dataValue}>{formatLastUpdate()}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#25292e",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  backButtonText: {
    color: "white",
    marginLeft: 5,
    fontWeight: "bold",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  dataContainer: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
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
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  indicatorRed: {
    backgroundColor: "#dc3545",
  },
  indicatorGreen: {
    backgroundColor: "#28a745",
  },
  indicatorGray: {
    backgroundColor: "#6c757d",
  }
});