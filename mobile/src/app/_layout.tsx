import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2 },
  },
})

/**
 * Racine de l'application : les fournisseurs communs et la pile de navigation.
 * Les écrans sont dans les autres fichiers de `src/app/`, un fichier par route.
 */
export default function RacineLayout() {
  // Le téléphone peut être en mode clair ou sombre. Sans ce branchement, les
  // composants suivent le réglage du système mais pas les écrans autour, et le
  // texte devient illisible sur un fond de la mauvaise couleur.
  const sombre = useColorScheme() === 'dark'
  const theme = sombre ? MD3DarkTheme : MD3LightTheme

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <StatusBar style={sombre ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTitleStyle: { color: theme.colors.onSurface },
            headerTintColor: theme.colors.onSurface,
            // Sans cela, l'en-tête pose un trait sur Android et sur le web, et
            // une ombre sur iOS, alors que le fond est déjà de la même couleur.
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Campus connecté' }} />
          {/* Les écrans de détail remplacent ce titre par le nom de la salle ou
              du capteur dès qu'ils l'ont. Sans ce titre d'attente, l'en-tête
              afficherait le nom du fichier de route pendant le chargement. */}
          <Stack.Screen name="salles/[id]" options={{ title: 'Salle' }} />
          <Stack.Screen name="objets/[id]" options={{ title: 'Capteur' }} />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  )
}
