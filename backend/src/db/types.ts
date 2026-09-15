import type { ColumnType, Generated } from 'kysely'

export interface RoomsTable {
  id: string
  label: string
}

export interface DevicesTable {
  id: string
  room_id: string
  first_seen_at: Generated<Date>
}

export interface TelemetryTable {
  device_id: string
  message_id: string
  recorded_at: ColumnType<Date, Date | string, never>
  received_at: Generated<Date>
  temperature_c: number
  co2_ppm: number
}

export interface DeviceStateTable {
  device_id: string
  recorded_at: ColumnType<Date | null, Date | string | null, Date | string | null>
  received_at: ColumnType<Date | null, Date | string | null, Date | string | null>
  temperature_c: number | null
  co2_ppm: number | null
  ventilation: boolean | null
  availability: string | null
  availability_at: ColumnType<Date | null, Date | string | null, Date | string | null>
}

export interface Database {
  rooms: RoomsTable
  devices: DevicesTable
  telemetry: TelemetryTable
  device_state: DeviceStateTable
}
