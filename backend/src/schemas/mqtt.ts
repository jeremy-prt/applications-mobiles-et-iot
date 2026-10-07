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

/**
 * Bornes physiques des deux grandeurs. Elles ne décrivent pas la salle mais le
 * capteur : en dehors, l'objet ne mesure plus, il est en panne, et sa valeur ne
 * doit pas devenir une mesure.
 *
 * Volontairement plus larges que le modèle du kit, qui reste entre 420 et
 * 2500 ppm. Refuser tout ce qui sort de cette plage reviendrait à jeter les
 * valeurs anormales mais vraies, c'est à dire exactement ce qu'un système de
 * supervision doit signaler.
 */
const TEMPERATURE_MIN_C = -40
const TEMPERATURE_MAX_C = 85
const CO2_MIN_PPM = 0
const CO2_MAX_PPM = 40_000

export const Telemetrie = z.object({
  schema_version: z.literal(1),
  message_id: z.string().min(1),
  device_id: z.string().min(1),
  room_id: z.string().min(1),
  observed_at: z.iso.datetime({ offset: true }),
  temperature: Mesure.extend({
    value: z
      .number()
      .finite()
      .min(TEMPERATURE_MIN_C)
      .max(TEMPERATURE_MAX_C),
  }),
  co2: Mesure.extend({
    value: z.number().finite().min(CO2_MIN_PPM).max(CO2_MAX_PPM),
  }),
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

/** Le format imposé par le contrat du kit pour un `command_id`. */
export const CommandId = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)

/** Ce que le backend publie sur `campus/v1/devices/{device_id}/commands`. */
export interface CommandeMqtt {
  schema_version: 1
  command_id: string
  action: 'set_ventilation'
  enabled: boolean
  expires_at: string
}

/**
 * Le résultat d'une commande. Le `command_id` est exigé : un rejet sans
 * corrélation possible, que le contrat du kit prévoit, ne peut être rattaché
 * à aucune commande.
 */
export const Resultat = z.discriminatedUnion('status', [
  z.object({
    schema_version: z.literal(1),
    device_id: z.string().min(1),
    command_id: z.string().min(1),
    status: z.literal('executed'),
    executed_at: z.iso.datetime({ offset: true }),
    ventilation: z.boolean(),
  }),
  z.object({
    schema_version: z.literal(1),
    device_id: z.string().min(1),
    command_id: z.string().min(1),
    status: z.literal('rejected'),
    reason: z.string().min(1),
    reported_at: z.iso.datetime({ offset: true }),
  }),
])
export type Resultat = z.infer<typeof Resultat>
