import { z } from 'zod'

/**
 * Les réponses de l'API sont validées à l'arrivée. Les types TypeScript
 * disparaissent à la compilation : ils ne vérifient rien à l'exécution.
 */

const Valeur = z.object({
  value: z.number(),
  unit: z.string(),
})

export const Objet = z.object({
  device_id: z.string(),
  room_id: z.string(),
  temperature: Valeur.nullable(),
  co2: Valeur.nullable(),
  recorded_at: z.string().nullable(),
  is_stale: z.boolean(),
  availability: z.string().nullable(),
  ventilation: z.boolean().nullable(),
})
export type Objet = z.infer<typeof Objet>

export const Salle = z.object({
  id: z.string(),
  label: z.string(),
  devices: z.array(Objet),
})
export type Salle = z.infer<typeof Salle>

export const ReponseSalles = z.object({
  rooms: z.array(Salle),
})

/**
 * Un point d'historique. Les champs `samples` et les bornes ne sont remplis que
 * pour les tranches agrégées : sur les mesures brutes, il n'y a rien à agréger.
 */
export const Point = z.object({
  at: z.string(),
  temperature: z.number(),
  co2: z.number(),
  samples: z.number().nullable(),
  temperature_min: z.number().nullable(),
  temperature_max: z.number().nullable(),
  co2_min: z.number().nullable(),
  co2_max: z.number().nullable(),
})
export type Point = z.infer<typeof Point>

export const ReponseHistorique = z.object({
  device_id: z.string(),
  resolution: z.enum(['raw', '5m']),
  from: z.string(),
  to: z.string(),
  limit: z.number(),
  // Le serveur signale que la période contenait plus de points que la limite.
  truncated: z.boolean(),
  points: z.array(Point),
})
