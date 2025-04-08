import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { 
  getLatestSensorData, 
  setModeStateCallback, 
  setRawDataCallback,
  fetchHistoricalSensorData 
} from "./websocket";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

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

// Interface pour les données historiques
interface HistoricalData {
  Humidité: Array<{ time: string; value: number }>;
  NiveauDeau: Array<{ time: string; value: number }>;
  Débit: Array<{ time: string; value: number }>;
}

// Interface pour les données de graphique
interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
  legend?: string[];
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
  
  // États pour les données historiques et leur chargement
  const [historicalData, setHistoricalData] = useState<HistoricalData>({
    Humidité: [],
    NiveauDeau: [],
    Débit: []
  });
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  
  // États pour les filtres de durée
  const [duration, setDuration] = useState<string>("10");
  const [durationType, setDurationType] = useState<string>("m"); // m, h, d, mo, y
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Largeur de l'écran pour les graphiques
  const screenWidth = Dimensions.get("window").width - 40;

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
      // Récupérer uniquement les données WebSocket
      const wsData = getLatestSensorData();
      
      if (wsData && (wsData.Humidité !== null || wsData.NiveauDeau !== null || wsData.Débit !== null)) {
        // Utiliser les données WebSocket
        setSensorData(prev => ({ ...prev, ...wsData }));
        setLastUpdate(new Date());
      } else {
        console.log("Aucune donnée disponible actuellement");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données des capteurs :", error);
    }
    setLoading(false);
  };

  // Fonction pour récupérer les données historiques avec gestion des erreurs
  const fetchHistoricalDataHandler = useCallback(async () => {
    setLoadingHistorical(true);
    setErrorMessage(null);
    
    try {
      // Valider les entrées
      if (!duration || isNaN(parseInt(duration)) || parseInt(duration) <= 0) {
        throw new Error("Veuillez entrer une durée valide");
      }
      
      console.log(`Récupération des données historiques pour: ${duration} ${durationType}`);
      
      // Appeler la fonction du module websocket
      const histData = await fetchHistoricalSensorData(duration, durationType);
      
      if (histData) {
        const hasSomeData = 
          histData.Humidité.length > 0 || 
          histData.NiveauDeau.length > 0 || 
          histData.Débit.length > 0;
        
        if (hasSomeData) {
          setHistoricalData(histData);
          console.log("Données historiques récupérées avec succès");
        } else {
          setErrorMessage("Aucune donnée disponible pour cette période");
          console.warn("Aucune donnée historique disponible pour cette période");
        }
      }
    } catch (error: any) {
      console.error("Erreur lors de la récupération des données historiques:", error);
      setErrorMessage(error.message || "Erreur lors de la récupération des données historiques");
    } finally {
      setLoadingHistorical(false);
    }
  }, [duration, durationType]);

  useEffect(() => {
    // Configuration du callback pour les mises à jour WebSocket
    setModeStateCallback((newState: any) => {
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
    fetchHistoricalDataHandler(); // Charger les données historiques au démarrage
    
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      // Réinitialiser les callbacks
      setModeStateCallback(null);
      setRawDataCallback(null);
    };
  }, [fetchHistoricalDataHandler]);

  // Effet pour recharger les données historiques lorsque les filtres changent
  useEffect(() => {
    // Délai pour éviter trop de requêtes lors de la saisie rapide
    const delayTimer = setTimeout(() => {
      fetchHistoricalDataHandler();
    }, 500);
    
    return () => clearTimeout(delayTimer);
  }, [duration, durationType, fetchHistoricalDataHandler]);

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

  // Conversion des données historiques au format pour LineChart
  const prepareChartData = (dataArray: Array<{ time: string; value: number }>, label: string): ChartData => {
    // S'assurer qu'il y a des données
    if (!dataArray || dataArray.length === 0) {
      return {
        labels: ["Aucune donnée"],
        datasets: [{ data: [0] }],
        legend: [label]
      };
    }
    
    try {
      const labels = dataArray.map(item => item.time);
      const values = dataArray.map(item => item.value);
      
      // Limiter le nombre d'étiquettes pour éviter l'encombrement
      const maxLabels = 6;
      let displayLabels;
      
      if (labels.length > maxLabels) {
        // Créer un tableau d'indices espacés régulièrement
        const step = Math.ceil(labels.length / maxLabels);
        const indices = Array.from({ length: maxLabels }, (_, i) => Math.min(i * step, labels.length - 1));
        
        // Extraire les étiquettes aux indices calculés
        displayLabels = indices.map(i => labels[i]);
      } else {
        displayLabels = labels;
      }
      
      return {
        labels: displayLabels,
        datasets: [
          {
            data: values,
            color: () => "#3498db",
            strokeWidth: 2
          }
        ],
        legend: [label]
      };
    } catch (error) {
      console.error("Erreur dans la préparation des données du graphique:", error);
      return {
        labels: ["Erreur"],
        datasets: [{ data: [0] }],
        legend: [label]
      };
    }
  };

  // Options du graphique
  const chartConfig = {
    backgroundColor: "#343a40",
    backgroundGradientFrom: "#343a40",
    backgroundGradientTo: "#343a40",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#ffa726"
    }
  };

  // Traduction du type de durée pour l'affichage
  const getDurationTypeLabel = () => {
    switch (durationType) {
      case "m": return "minutes";
      case "h": return "heures";
      case "d": return "jours";
      case "mo": return "mois";
      case "y": return "années";
      default: return "minutes";
    }
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
          <Text style={styles.dataLabel}>Dernière mise à jour :</Text>
          <Text style={styles.dataValue}>{formatLastUpdate()}</Text>
        </View>
      </View>
      
      <View style={styles.filtersContainer}>
        <Text style={styles.sectionTitle}>Historique des données</Text>
        <View style={styles.filterRow}>
          <TextInput
            style={styles.durationInput}
            value={duration}
            onChangeText={(text) => {
              // Accepter uniquement les nombres
              if (/^\d*$/.test(text)) {
                setDuration(text);
              }
            }}
            keyboardType="numeric"
            placeholder="Durée"
            placeholderTextColor="#8d9094"
          />
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={durationType}
              style={styles.picker}
              onValueChange={(itemValue) => setDurationType(itemValue)}
              dropdownIconColor="#ffffff"
            >
              <Picker.Item label="Minutes" value="m" />
              <Picker.Item label="Heures" value="h" />
              <Picker.Item label="Jours" value="d" />
              <Picker.Item label="Mois" value="mo" />
              <Picker.Item label="Années" value="y" />
            </Picker>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchHistoricalDataHandler}
            disabled={loadingHistorical}
          >
            <Text style={styles.refreshButtonText}>
              {loadingHistorical ? "Chargement..." : "Actualiser"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.filterInfo}>
          Affichage des données des {duration || "0"} {getDurationTypeLabel()} précédentes
        </Text>
        
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </View>
      
      {loadingHistorical ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.chartLoader} />
      ) : (
        <View style={styles.chartsContainer}>
          {/* Graphique d'humidité */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Humidité du sol (%)</Text>
            {historicalData.Humidité && historicalData.Humidité.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.Humidité, "Humidité (%)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                // Protection contre les erreurs de rendu
                fromZero
                withDots={historicalData.Humidité.length < 50}
                withInnerLines={false}
                withOuterLines={true}
                withVerticalLines={false}
              />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </View>
          
          {/* Graphique de niveau d'eau */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Niveau d'eau (cm)</Text>
            {historicalData.NiveauDeau && historicalData.NiveauDeau.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.NiveauDeau, "Niveau d'eau (cm)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                // Protection contre les erreurs de rendu
                fromZero
                withDots={historicalData.NiveauDeau.length < 50}
                withInnerLines={false}
                withOuterLines={true}
                withVerticalLines={false}
              />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </View>
          
          {/* Graphique de débit */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Débit d'eau (L/min)</Text>
            {historicalData.Débit && historicalData.Débit.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.Débit, "Débit (L/min)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                // Protection contre les erreurs de rendu
                fromZero
                withDots={historicalData.Débit.length < 50}
                withInnerLines={false}
                withOuterLines={true}
                withVerticalLines={false}
              />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </View>
        </View>
      )}
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
  filtersContainer: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  durationInput: {
    backgroundColor: "#495057",
    color: "white",
    borderRadius: 5,
    padding: 10,
    flex: 1,
    marginRight: 10,
  },
  pickerContainer: {
    backgroundColor: "#495057",
    borderRadius: 5,
    flex: 2,
    marginRight: 10,
  },
  picker: {
    color: "white",
    height: 40,
  },
  refreshButton: {
    backgroundColor: "#3498db",
    borderRadius: 5,
    padding: 10,
    alignItems: "center",
    flex: 1,
  },
  refreshButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  filterInfo: {
    color: "#adb5bd",
    fontStyle: "italic",
    marginTop: 5,
  },
  errorContainer: {
    backgroundColor: "rgba(220, 53, 69, 0.2)",
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  errorText: {
    color: "#f8d7da",
    textAlign: "center",
  },
  chartsContainer: {
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
    textAlign: "center",
  },
  chart: {
    borderRadius: 10,
    paddingRight: 10,
  },
  noDataText: {
    color: "#adb5bd",
    textAlign: "center",
    padding: 30,
    fontSize: 16,
  },
  chartLoader: {
    marginVertical: 30,
  }
});