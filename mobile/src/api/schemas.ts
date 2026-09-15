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
