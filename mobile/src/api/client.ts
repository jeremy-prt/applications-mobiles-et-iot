import type { z } from 'zod'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL

if (BASE_URL === undefined || BASE_URL === '') {
  throw new Error(
    "EXPO_PUBLIC_API_URL n'est pas défini. Copiez .env.example en .env et mettez " +
      "l'adresse IP de la machine qui fait tourner le backend.",
  )
}

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
    // Le backend n'est pas joignable : éteint, mauvaise adresse, ou téléphone
    // sur un autre réseau. On ne sait pas lequel, on ne le prétend pas.
    throw new ErreurApi('Le serveur est injoignable', null)
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
