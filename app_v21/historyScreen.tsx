import Ionicons from "@expo/vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { fetchHistoricalData } from "./websocket";

interface HistoricalDataPoint {
  date: string;
  deviceName: string;
  valeur?: string;
  capteur1?: number;
  capteur2?: number;
}

interface HistoricalData {
  humidite: Array<{ date: string, valeur: number }>;
  debit: Array<{ date: string, valeur: number }>;
  capteur1: Array<{ date: string, valeur: number }>;
  capteur2: Array<{ date: string, valeur: number }>;
  [key: string]: Array<{ date: string, valeur: number }>;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [historicalData, setHistoricalData] = React.useState<HistoricalData>({
    humidite: [],
    debit: [],
    capteur1: [],
    capteur2: []
  });
  const [historicalLoading, setHistoricalLoading] = React.useState(false);
  const [selectedDuration, setSelectedDuration] = React.useState("1");
  const [selectedUnit, setSelectedUnit] = React.useState("jours");
  const [error, setError] = React.useState<string | null>(null);
  const [showGraphs, setShowGraphs] = React.useState(false);

  const screenWidth = Dimensions.get("window").width - 40;

  // Fonction pour traiter les données historiques reçues de l'API
  const processHistoricalData = (data: any): HistoricalData => {
    try {
      const processed: HistoricalData = {
        humidite: [],
        debit: [],
        capteur1: [],
        capteur2: []
      };

      // Vérification plus stricte
      if (!data || !Array.isArray(data)) {
        console.warn("Données historiques non valides:", data);
        return processed;
      }

      // Traiter chaque élément du tableau avec une gestion d'erreur par élément
      data.forEach(item => {
        if (!item) return;

        try {
          // Traitement InfluxDB
          if (item._time && item._value !== undefined) {
            let formattedDate = "00:00";

            if (typeof item._time === 'string') {
              try {
                const date = new Date(item._time);
                if (!isNaN(date.getTime())) {
                  formattedDate = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
              } catch {
                // Utiliser la valeur par défaut
              }
            }

            const valeur = Number(item._value);
            if (isNaN(valeur)) return;

            // Classification
            if ((item._field === "Humidité" || item.tagname === "Capteur sol")) {
              processed.humidite.push({ date: formattedDate, valeur });
            } else if ((item._field === "Débit" || item.tagname === "Débitmètre")) {
              processed.debit.push({ date: formattedDate, valeur });
            } else if ((item._field === "capteur1" || item.tagname === "Capteur eau supérieur à 500L" || item.tagname === "Capteu de présence d'eau 1")) {
              processed.capteur1.push({ date: formattedDate, valeur });
            } else if ((item._field === "capteur2" || item.tagname === "Capteur de présence d'eau" || item.tagname === "Capteu de présence d'eau 2")) {
              processed.capteur2.push({ date: formattedDate, valeur });
            }
          }
          // Format ancien
          else if (item.date && item.deviceName) {
            let formattedDate = "00:00";
            let valeur = 0;

            try {
              const date = new Date(item.date);
              if (!isNaN(date.getTime())) {
                formattedDate = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
              }
            } catch {
              // Utiliser la valeur par défaut
            }

            try {
              valeur = parseFloat(item.valeur);
              if (isNaN(valeur)) valeur = 0;
            } catch {
              valeur = 0;
            }

            // Classification
            if (item.deviceName === "Capteur d'humidité") {
              processed.humidite.push({ date: formattedDate, valeur });
            } else if (item.deviceName === "Débitmètre") {
              processed.debit.push({ date: formattedDate, valeur });
            } else if (item.deviceName === "Capteur eau supérieur à 500L" || item.deviceName === "Capteu de présence d'eau 1") {
              processed.capteur1.push({ date: formattedDate, valeur });
            } else if (item.deviceName === "Capteur de présence d'eau" || item.deviceName === "Capteu de présence d'eau 2") {
              processed.capteur2.push({ date: formattedDate, valeur });
            }
          }
        } catch (itemError) {
          console.warn("Erreur lors du traitement d'un élément:", itemError);
        }
      });

      return processed;
    } catch (error) {
      console.error("Erreur dans processHistoricalData:", error);
      return {
        humidite: [],
        debit: [],
        capteur1: [],
        capteur2: []
      };
    }
  };

  // Fonction pour récupérer les données historiques
  const fetchHistorical = async () => {
    // Vérification préalable de la durée pour éviter les crashes
    const duration = parseInt(selectedDuration);
    if (isNaN(duration) || duration <= 0 || selectedDuration.trim() === "") {
      setError(null);
      Alert.alert(
        "Erreur de saisie",
        "Veuillez entrer une valeur numérique valide pour la durée",
        [{ text: "OK" }]
      );
      return;
    }
    
    setHistoricalLoading(true);
    setError(null);

    try {
      let uniteAPI = "d";

      switch (selectedUnit) {
        case "minutes": uniteAPI = "m"; break;
        case "heures": uniteAPI = "h"; break;
        case "jours": uniteAPI = "d"; break;
        case "semaines": uniteAPI = "w"; break;
      }

      console.log(`Récupération des données historiques: ${duration} ${uniteAPI}`);

      // Ajouter un timeout pour éviter le blocage trop long
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout dépassé")), 15000)
      );

      const dataPromise = fetchHistoricalData(duration, uniteAPI);
      const data = await Promise.race([dataPromise, timeoutPromise]);

      if (!data) {
        throw new Error("Données non reçues");
      }

      // Protection supplémentaire contre les données invalides
      if (!Array.isArray(data)) {
        console.warn("Format de données historiques invalide:", data);
        setError("Format de données invalide");
        setHistoricalData({
          humidite: [],
          debit: [],
          capteur1: [],
          capteur2: []
        });
        return;
      }

      const processedData = processHistoricalData(data);
      setHistoricalData(processedData);
      setShowGraphs(true); // Afficher les graphiques après avoir récupéré les données
    } catch (error) {
      console.error("Erreur lors de la récupération des données historiques:", error);
      setError("Impossible de récupérer les données historiques");

      // Réinitialiser pour éviter d'afficher des données obsolètes
      setHistoricalData({
        humidite: [],
        debit: [],
        capteur1: [],
        capteur2: []
      });
    } finally {
      setHistoricalLoading(false);
    }
  };

  // On ne récupère plus les données au chargement initial
  // React.useEffect(() => {
  //   fetchHistorical();
  // }, []);

  // Fonction pour formater les labels de date selon l'unité de temps
  const formatDateLabels = (dates: string[]): string[] => {
    try {
      if (!dates || dates.length === 0) return [];

      // Pour les durées courtes, afficher moins de points
      if (dates.length > 8) {
        const step = Math.ceil(dates.length / 8);
        return dates.filter((_, i) => i % step === 0);
      }
      return dates;
    } catch (error) {
      console.error("Erreur lors du formatage des labels de date:", error);
      return ["Erreur"];
    }
  };

  // Fonction pour préparer les données du graphique de manière sécurisée
  const prepareChartData = (dataPoints: Array<{ date: string, valeur: number }>, color: string) => {
    try {
      // Vérifications supplémentaires
      if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) {
        console.warn("prepareChartData: données invalides ou vides");
        return null;
      }

      // Filtrer les points de données invalides plus strictement
      const validPoints = dataPoints.filter(point =>
        point &&
        typeof point === 'object' &&
        point.date &&
        typeof point.date === 'string' &&
        point.valeur !== undefined &&
        !isNaN(point.valeur)
      );

      if (validPoints.length === 0) {
        console.warn("prepareChartData: aucun point valide après filtrage");
        return null;
      }

      // Créer les données du graphique avec une structure valide minimale
      return {
        labels: formatDateLabels(validPoints.map(item => item.date || "")),
        datasets: [{
          data: validPoints.map(item => Number(item.valeur) || 0),
          color: () => color,
          strokeWidth: 2
        }]
      };
    } catch (error) {
      console.error("Erreur dans la préparation des données du graphique:", error);
      return null;
    }
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

  // Rendu d'un graphique avec gestion d'erreur
  const renderChart = (
    dataPoints: Array<{ date: string, valeur: number }>,
    title: string,
    color: string,
    yAxisSuffix: string,
    fromZero: boolean = false
  ): React.ReactElement => {
    try {
      // Vérification supplémentaire pour éviter les crashes
      if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) {
        return (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Aucune donnée disponible pour {title}</Text>
          </View>
        );
      }

      const chartData = prepareChartData(dataPoints, color);

      if (!chartData || !chartData.labels || !chartData.datasets || chartData.labels.length === 0) {
        return (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Données insuffisantes pour {title}</Text>
          </View>
        );
      }

      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>{title}</Text>
          <LineChart
            data={chartData}
            width={screenWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            }}
            bezier
            style={styles.chart}
            yAxisSuffix={yAxisSuffix}
            fromZero={fromZero}
          />
        </View>
      );
    } catch (error) {
      console.error(`Erreur lors du rendu du graphique ${title}:`, error);
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Erreur lors de l'affichage du graphique {title}</Text>
        </View>
      );
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
        <Text style={styles.title}>Historique des données</Text>
      </View>

      <View style={styles.historyContainer}>
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
                <Picker.Item label="Semaines" value="semaines" />
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
              <Text style={styles.fetchButtonText}>Afficher historique</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Affichage des erreurs */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Indicateur de chargement pour l'historique */}
        {historicalLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Chargement des données historiques...</Text>
          </View>
        )}

        {/* Invitation à afficher les graphiques si non visible */}
        {!showGraphs && !historicalLoading && (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Veuillez entrer une durée et cliquer sur "Afficher historique" pour visualiser les données
            </Text>
          </View>
        )}

        {/* Graphiques - maintenant conditionnés par showGraphs */}
        {!historicalLoading && showGraphs && (
          <>
            {renderChart(
              historicalData.humidite,
              "Humidité du sol (%)",
              "#28a745", // Vert
              " %"
            )}

            {renderChart(
              historicalData.debit,
              "Consommation d'eau (L)",
              "#fd7e14", // Orange
              " L"
            )}

            {renderChart(
              historicalData.capteur1,
              "Capteur eau supérieur à 500L",
              "#9c27b0", // Violet
              "",
              true
            )}

            {renderChart(
              historicalData.capteur2,
              "Capteur de présence d'eau",
              "#e91e63", // Rose
              "",
              true
            )}
          </>
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
  historyContainer: {
    backgroundColor: "#343a40",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  formContainer: {
    marginVertical: 15,
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
  },
  errorContainer: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  loadingText: {
    color: "white",
    marginTop: 10,
    fontSize: 16,
  },
  instructionContainer: {
    padding: 20,
    backgroundColor: "#495057",
    borderRadius: 8,
    marginVertical: 20,
    alignItems: "center",
  },
  instructionText: {
    color: "#adb5bd",
    fontSize: 16,
    textAlign: "center",
  }
});