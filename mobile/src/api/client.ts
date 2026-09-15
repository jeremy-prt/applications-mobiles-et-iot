import Constants from 'expo-constants'
import type { z } from 'zod'

/**
 * Adresse du backend, vue depuis le téléphone.
 *
 * localhost désignerait le téléphone lui-même. Il faut l'adresse de la machine
 * qui fait tourner le backend sur le réseau local, et elle change dès qu'on
 * change de réseau.
 *
 * On la déduit donc du serveur de développement Expo, auquel le téléphone est
 * déjà connecté : c'est forcément la bonne machine et le bon réseau. En cas
 * d'échec, EXPO_PUBLIC_API_URL prend le relais.
 */
function adresseApi(): string {
  const explicite = process.env.EXPO_PUBLIC_API_URL
  if (explicite !== undefined && explicite !== '') return explicite

  const hote = Constants.expoConfig?.hostUri?.split(':')[0]
  if (hote !== undefined && hote !== '') return `http://${hote}:3000`

  throw new Error(
    "Impossible de déterminer l'adresse du backend. Renseignez EXPO_PUBLIC_API_URL " +
      'dans mobile/.env avec l\'adresse IP de la machine qui le fait tourner.',
  )
}

const BASE_URL = adresseApi()

export class ErreurApi extends Error {
  readonly statut: number | null
  constructor(message: string, statut: number | null) {
    super(message)
    this.name = 'ErreurApi'
    this.statut = statut
  }
}

export async function appeler<T extends z.ZodType>(
  chemin: string,
  schema: T,
): Promise<z.infer<T>> {
  let reponse: Response
  try {
    reponse = await fetch(`${BASE_URL}${chemin}`)
  } catch {
    // Le backend n'est pas joignable : éteint, ou téléphone sur un autre
    // réseau. On ne sait pas lequel, on ne le prétend pas.
    throw new ErreurApi(`Serveur injoignable sur ${BASE_URL}`, null)
  }

  if (!reponse.ok) {
    throw new ErreurApi(`Le serveur a répondu ${reponse.status}`, reponse.status)
  }

  const brut: unknown = await reponse.json()
  const parsed = schema.safeParse(brut)

  if (!parsed.success) {
    throw new ErreurApi('Réponse du serveur inattendue', reponse.status)
  }

  return parsed.data
}
