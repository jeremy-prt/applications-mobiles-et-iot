import { z } from 'zod'

/**
 * Format des messages publiés par les objets, décrit dans le contrat du kit
 * (infra/kit/docs/contrat-mqtt.md). Ces schémas sont la frontière du système :
 * un message qui ne les respecte pas est rejeté et tracé, sans arrêter le service.
 */

const Mesure = z.object({
  value: z.number().finite(),
  unit: z.string().min(1),
})

export const Telemetrie = z.object({
  schema_version: z.literal(1),
  message_id: z.string().min(1),
  device_id: z.string().min(1),
  room_id: z.string().min(1),
  observed_at: z.iso.datetime({ offset: true }),
  temperature: Mesure,
  co2: Mesure,
})
export type Telemetrie = z.infer<typeof Telemetrie>

export const Etat = z.object({
  schema_version: z.literal(1),
  device_id: z.string().min(1),
  reported_at: z.iso.datetime({ offset: true }),
  boot_id: z.string().min(1),
  ventilation: z.boolean(),
})
export type Etat = z.infer<typeof Etat>

/**
 * `reported_at` est absent quand le message vient du testament du broker, celui
 * qu'il publie à notre place quand un objet disparaît sans prévenir. Le contrat
 * du kit le dit : « sans date de panne préremplie », c'est au backend
 * d'horodater sa réception. L'exiger revenait à rejeter toutes les
 * déconnexions brutales, c'est à dire le seul cas où cette information compte.
 */
export const Disponibilite = z.object({
  schema_version: z.literal(1),
  device_id: z.string().min(1),
  status: z.enum(['online', 'offline']),
  reported_at: z.iso.datetime({ offset: true }).optional(),
  reason: z.string().min(1).optional(),
})
export type Disponibilite = z.infer<typeof Disponibilite>
