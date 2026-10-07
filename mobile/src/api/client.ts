import Constants from 'expo-constants'
import { z } from 'zod'

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
function adresseApi(): string | null {
  const explicite = process.env.EXPO_PUBLIC_API_URL
  if (explicite !== undefined && explicite !== '') return explicite

  const hote = Constants.expoConfig?.hostUri?.split(':')[0]
  if (hote !== undefined && hote !== '') return `http://${hote}:3000`

  return null
}

export class ErreurApi extends Error {
  readonly statut: number | null
  /** Le `code` de l'enveloppe d'erreur, sur lequel le mobile s'appuie, pas le message. */
  readonly code: string | null
  constructor(message: string, statut: number | null, code: string | null = null) {
    super(message)
    this.name = 'ErreurApi'
    this.statut = statut
    this.code = code
  }
}

const EnveloppeErreur = z.object({ error: z.object({ code: z.string() }) })

interface OptionsAppel {
  methode?: 'GET' | 'POST'
  corps?: unknown
  /** Sans délai, iOS attend une minute avant d'abandonner une requête. */
  delaiMs?: number
}

export async function appeler<T extends z.ZodType>(
  chemin: string,
  schema: T,
  { methode = 'GET', corps, delaiMs }: OptionsAppel = {},
): Promise<z.infer<T>> {
  // Résolue à chaque appel, et non au chargement du module : une exception au
  // chargement casserait le bundle entier, alors que l'écran sait afficher une
  // erreur et proposer de réessayer.
  const base = adresseApi()
  if (base === null) {
    throw new ErreurApi(
      "Impossible de déterminer l'adresse du backend. Renseignez EXPO_PUBLIC_API_URL " +
        "dans mobile/.env avec l'adresse de la machine qui le fait tourner.",
      null,
    )
  }

  const annulation = new AbortController()
  const minuteur =
    delaiMs === undefined ? undefined : setTimeout(() => annulation.abort(), delaiMs)

  let reponse: Response
  try {
    reponse = await fetch(`${base}${chemin}`, {
      method: methode,
      headers: corps === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: annulation.signal,
    })
  } catch {
    // Le backend n'est pas joignable : éteint, ou téléphone sur un autre
    // réseau. On ne sait pas lequel, on ne le prétend pas.
    throw new ErreurApi(`Serveur injoignable sur ${base}`, null)
  } finally {
    clearTimeout(minuteur)
  }

  if (!reponse.ok) {
    const enveloppe = EnveloppeErreur.safeParse(await reponse.json().catch(() => null))
    throw new ErreurApi(
      `Le serveur a répondu ${reponse.status}`,
      reponse.status,
      enveloppe.success ? enveloppe.data.error.code : null,
    )
  }

  const brut: unknown = await reponse.json()
  const parsed = schema.safeParse(brut)

  if (!parsed.success) {
    throw new ErreurApi('Réponse du serveur inattendue', reponse.status)
  }

  return parsed.data
}
