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
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Campus connecté' }} />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  )
}
