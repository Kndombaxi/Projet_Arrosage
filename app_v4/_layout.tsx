import { Stack } from "expo-router";   // Permet la gestion de la navigation de type pile (stack).
import { StatusBar } from "expo-status-bar";  // Permet de personnaliser la barre de statut du téléphone.

import { useEffect } from "react";    // Hook de React pour exécuter des effets secondaires.
import { useRouter } from "expo-router";  // Hook de Expo Router pour la gestion de la navigation.

// Définition du composant RootLayout
export default function RootLayout() {
  // Initialisation du hook useRouter pour accéder à l'objet 'router' qui permet de gérer la navigation.
  const router = useRouter();

  // Utilisation de useEffect pour rediriger l'utilisateur vers la page /home après que le composant soit monté.
  useEffect(() => {
    // Redirection automatique vers la page d'accueil '/home' dès que le composant est rendu.
    router.push("/home");
  }, [router]);  // Le tableau de dépendances contient 'router', donc l'effet se déclenche chaque fois que 'router' change.

  // Retour du JSX, c'est-à-dire la structure de l'interface utilisateur de ce composant.
  return (
    <>
      {/* Personnalisation de la barre de statut pour que le texte soit clair sur un fond sombre */}
      <StatusBar style="light" />
      
      {/* Définition de la navigation avec le Stack, où 'headerShown: false' masque l'en-tête de navigation par défaut */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Le contenu des pages sera rendu ici, mais avec l'en-tête masqué */}
      </Stack>
    </>
  );
}
