import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { 
  getLatestSensorData, 
  setModeStateCallback, 
  setRawDataCallback,
  fetchHistoricalData
} from "./websocket";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { Picker } from "@react-native-picker/picker";

interface SensorData {
  Humidité?: number | null;
  NiveauDeau?: number | null;
  Débit?: number | null;
  capteur1?: number | null;
  capteur2?: number | null;
}

interface HistoricalDataPoint {
  date: string;
  deviceName: string;
  valeur?: string;
  capteur1?: number;
  capteur2?: number;
}

interface HistoricalData {
  humidite: Array<{date: string, valeur: number}>;
  niveauEau: Array<{date: string, valeur: number}>;
  debit: Array<{date: string, valeur: number}>;
}

// Interface pour les données brutes reçues du WebSocket
interface RawSensorData {
  données?: {
    date: string;
    deviceName: string;
    valeur?: string;
    capteur1?: number;
    capteur2?: number;
  };
  dernieresDonnees?: Array<{
    date: string;
    deviceName: string;
    valeur?: string;
    capteur1?: number;
    capteur2?: number;
  }>;
}

export default function DataScreen() {
  const router = useRouter();
  const [sensorData, setSensorData] = useState<SensorData>({
    Humidité: null,
    NiveauDeau: null,
    Débit: null,
    capteur1: null,
    capteur2: null
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // États pour l'historique
  const [historicalData, setHistoricalData] = useState<HistoricalData>({
    humidite: [],
    niveauEau: [],
    debit: []
  });
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("1");
  const [selectedUnit, setSelectedUnit] = useState("h");

  const screenWidth = Dimensions.get("window").width - 40;

  // Fonction pour traiter les données brutes et les convertir au format souhaité
  const processSensorData = (data: any): SensorData => {
    // Si les données sont déjà au format attendu de getLatestSensorData
    if (data && (data.Humidité !== undefined || data.NiveauDeau !== undefined || data.Débit !== undefined || data.capteur1 !== undefined || data.capteur2 !== undefined)) {
      return data as SensorData;
    }

    // Pour traiter une seule donnée
    if (data && data.données) {
      const { deviceName, valeur, capteur1, capteur2 } = data.données;
      const newSensorData: SensorData = { ...sensorData };
      
      if (deviceName === "Capteur d'humidité") {
        newSensorData.Humidité = parseFloat(valeur as string);
      } else if (deviceName === "Capteur de niveau d'eau") {
        newSensorData.NiveauDeau = parseFloat(valeur as string);
      } else if (deviceName === "Débitmètre") {
        newSensorData.Débit = parseFloat(valeur as string);
      } else if (deviceName === "level-sensor") {
        if (capteur1 !== undefined) newSensorData.capteur1 = capteur1;
        if (capteur2 !== undefined) newSensorData.capteur2 = capteur2;
      }
      
      return newSensorData;
    }

    // Pour traiter un tableau de données
    if (data && data.dernieresDonnees && Array.isArray(data.dernieresDonnees)) {
      const newSensorData: SensorData = { ...sensorData };
      
      data.dernieresDonnees.forEach((item: any) => {
        const { deviceName, valeur, capteur1, capteur2 } = item;
        
        if (deviceName === "Capteur d'humidité") {
          newSensorData.Humidité = parseFloat(valeur);
        } else if (deviceName === "Capteur de niveau d'eau") {
          newSensorData.NiveauDeau = parseFloat(valeur);
        } else if (deviceName === "Débitmètre") {
          newSensorData.Débit = parseFloat(valeur);
        } else if (deviceName === "level-sensor") {
          if (capteur1 !== undefined) newSensorData.capteur1 = capteur1;
          if (capteur2 !== undefined) newSensorData.capteur2 = capteur2;
        }
      });
      
      return newSensorData;
    }

    return data as SensorData;
  };

  // Fonction pour traiter les données historiques reçues de l'API
  const processHistoricalData = (data: any): HistoricalData => {
    const processed: HistoricalData = {
      humidite: [],
      niveauEau: [],
      debit: []
    };

    // Vérifier si les données sont au format attendu
    if (Array.isArray(data)) {
      data.forEach(item => {
        const date = new Date(item.date);
        const formattedDate = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        if (item.deviceName === "Capteur d'humidité" && item.valeur !== undefined) {
          processed.humidite.push({
            date: formattedDate,
            valeur: parseFloat(item.valeur)
          });
        } else if (item.deviceName === "Capteur de niveau d'eau" && item.valeur !== undefined) {
          processed.niveauEau.push({
            date: formattedDate,
            valeur: parseFloat(item.valeur)
          });
        } else if (item.deviceName === "Débitmètre" && item.valeur !== undefined) {
          processed.debit.push({
            date: formattedDate,
            valeur: parseFloat(item.valeur)
          });
        }
      });

      // Trier les données par date
      processed.humidite.sort((a, b) => a.date.localeCompare(b.date));
      processed.niveauEau.sort((a, b) => a.date.localeCompare(b.date));
      processed.debit.sort((a, b) => a.date.localeCompare(b.date));
    }

    return processed;
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
    }
    setLoading(false);
  };

  // Fonction pour récupérer les données historiques
  const fetchHistorical = async () => {
    setHistoricalLoading(true);
    try {
      // Convertir le type de durée sélectionné au format attendu par l'API
      let uniteAPI = selectedUnit;
      switch (selectedUnit) {
        case "minutes":
          uniteAPI = "m";
          break;
        case "heures":
          uniteAPI = "h";
          break;
        case "jours":
          uniteAPI = "j";
          break;
        case "mois":
          uniteAPI = "mo";
          break;
        case "année":
          uniteAPI = "a";
          break;
      }

      const data = await fetchHistoricalData(parseInt(selectedDuration), uniteAPI);
      const processedData = processHistoricalData(data);
      setHistoricalData(processedData);
    } catch (error) {
      console.error("Erreur lors de la récupération des données historiques:", error);
    }
    setHistoricalLoading(false);
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
    fetchHistorical();
    
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      // Réinitialiser les callbacks
      setModeStateCallback(null);
      setRawDataCallback(null);
    };
  }, []);

  // Déclencher la récupération des données historiques quand la durée ou l'unité change
  useEffect(() => {
    if (selectedDuration && selectedUnit) {
      fetchHistorical();
    }
  }, [selectedDuration, selectedUnit]);

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

  // Rendu des indicateurs de niveau
  const renderLevelIndicator = (value: number | null | undefined): JSX.Element => {
    if (value === null || value === undefined) {
      return <View style={[styles.indicator, styles.indicatorGray]} />;
    }
    return value === 1 ? 
      <View style={[styles.indicator, styles.indicatorGreen]} /> : 
      <View style={[styles.indicator, styles.indicatorRed]} />;
  };

  // Fonction pour formater les labels de date selon l'unité de temps
  const formatDateLabels = (dates: string[], unit: string): string[] => {
    // Pour les durées courtes, afficher moins de points
    if (dates.length > 8) {
      const step = Math.ceil(dates.length / 8);
      return dates.filter((_, i) => i % step === 0);
    }
    return dates;
  };

  // Configuration des graphiques
  const chartConfig = {
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

      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>Historique des données</Text>
        
        <View style={styles.formContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Durée:</Text>
            <TextInput
              style={styles.durationInput}
              value={selectedDuration}
              onChangeText={text => setSelectedDuration(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="Durée"
              placeholderTextColor="#6c757d"
            />
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Unité:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedUnit}
                style={styles.picker}
                onValueChange={(itemValue) => setSelectedUnit(itemValue)}
                dropdownIconColor="#ffffff"
              >
                <Picker.Item label="Minutes" value="minutes" />
                <Picker.Item label="Heures" value="heures" />
                <Picker.Item label="Jours" value="jours" />
                <Picker.Item label="Mois" value="mois" />
                <Picker.Item label="Année" value="année" />
              </Picker>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.fetchButton}
            onPress={fetchHistorical}
            disabled={historicalLoading}
          >
            {historicalLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.fetchButtonText}>Mettre à jour les graphiques</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Graphique d'humidité */}
        {historicalData.humidite.length > 0 ? (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Humidité du sol (%)</Text>
            <LineChart
              data={{
                labels: formatDateLabels(historicalData.humidite.map(item => item.date), selectedUnit),
                datasets: [{
                  data: historicalData.humidite.map(item => item.valeur),
                  color: () => '#28a745', // Vert
                  strokeWidth: 2
                }]
              }}
              width={screenWidth}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`, // Vert
              }}
              bezier
              style={styles.chart}
              yAxisSuffix=" %"
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Aucune donnée d'humidité disponible</Text>
          </View>
        )}
        
        {/* Graphique de niveau d'eau */}
        {historicalData.niveauEau.length > 0 ? (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Niveau d'eau (cm)</Text>
            <LineChart
              data={{
                labels: formatDateLabels(historicalData.niveauEau.map(item => item.date), selectedUnit),
                datasets: [{
                  data: historicalData.niveauEau.map(item => item.valeur),
                  color: () => '#007bff', // Bleu
                  strokeWidth: 2
                }]
              }}
              width={screenWidth}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`, // Bleu
              }}
              bezier
              style={styles.chart}
              yAxisSuffix=" cm"
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Aucune donnée de niveau d'eau disponible</Text>
          </View>
        )}
        
        {/* Graphique de débit */}
        {historicalData.debit.length > 0 ? (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Débit d'eau (L/min)</Text>
            <LineChart
              data={{
                labels: formatDateLabels(historicalData.debit.map(item => item.date), selectedUnit),
                datasets: [{
                  data: historicalData.debit.map(item => item.valeur),
                  color: () => '#fd7e14', // Orange
                  strokeWidth: 2
                }]
              }}
              width={screenWidth}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(253, 126, 20, ${opacity})`, // Orange
              }}
              bezier
              style={styles.chart}
              yAxisSuffix=" L/min"
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Aucune donnée de débit disponible</Text>
          </View>
        )}
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
  },
  historyContainer: {
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
  formContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  inputLabel: {
    width: 80,
    fontSize: 16,
    color: "#adb5bd",
  },
  durationInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#495057",
    color: "white",
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  pickerContainer: {
    flex: 1,
    height: 40,
    backgroundColor: "#495057",
    borderRadius: 5,
    justifyContent: "center",
    overflow: "hidden",
  },
  picker: {
    color: "white",
    height: 40,
  },
  fetchButton: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  fetchButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  chartContainer: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: "center",
  },
  chartTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 10,
    textAlign: "center",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: "#495057",
    borderRadius: 8,
  },
  noDataText: {
    color: "#adb5bd",
    fontSize: 16,
    textAlign: "center",
  }
});