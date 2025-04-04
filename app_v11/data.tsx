import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { 
  fetchSensorData, 
  getLatestSensorData, 
  setModeStateCallback, 
  setRawDataCallback,
  fetchHistoricalSensorData 
} from "./websocket";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { Picker } from "@react-native-picker/picker";

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

  // Fonction pour récupérer les données historiques
  const fetchHistoricalDataHandler = async () => {
    setLoadingHistorical(true);
    try {
      // Utiliser la fonction du module websocket
      const histData = await fetchHistoricalSensorData(duration, durationType);
      if (histData) {
        setHistoricalData(histData);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données historiques :", error);
    }
    setLoadingHistorical(false);
  };

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
  }, []);

  // Effet pour recharger les données historiques lorsque les filtres changent
  useEffect(() => {
    fetchHistoricalDataHandler();
  }, [duration, durationType]);

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
    const labels = dataArray.map(item => item.time);
    const values = dataArray.map(item => item.value);
    
    return {
      labels: labels.length > 6 ? labels.filter((_, idx) => idx % Math.ceil(labels.length / 6) === 0) : labels,
      datasets: [
        {
          data: values.length === 0 ? [0] : values,
          color: () => "#3498db",
          strokeWidth: 2
        }
      ],
      legend: [label]
    };
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
      
      <View style={styles.filtersContainer}>
        <Text style={styles.sectionTitle}>Historique des données</Text>
        <View style={styles.filterRow}>
          <TextInput
            style={styles.durationInput}
            value={duration}
            onChangeText={setDuration}
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
          >
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.filterInfo}>
          Affichage des données des {duration} {getDurationTypeLabel()} précédentes
        </Text>
      </View>
      
      {loadingHistorical ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.chartLoader} />
      ) : (
        <View style={styles.chartsContainer}>
          {/* Graphique d'humidité */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Humidité du sol (%)</Text>
            {historicalData.Humidité.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.Humidité, "Humidité (%)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </View>
          
          {/* Graphique de niveau d'eau */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Niveau d'eau (cm)</Text>
            {historicalData.NiveauDeau.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.NiveauDeau, "Niveau d'eau (cm)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            ) : (
              <Text style={styles.noDataText}>Aucune donnée disponible</Text>
            )}
          </View>
          
          {/* Graphique de débit */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Débit d'eau (L/min)</Text>
            {historicalData.Débit.length > 0 ? (
              <LineChart
                data={prepareChartData(historicalData.Débit, "Débit (L/min)")}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
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