import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { config } from '../config/index.ts'
import type { Database } from './types.ts'

// Sans ces deux lignes, pg renvoie les entiers 8 octets et les décimaux sous
// forme de chaînes : un count() vaudrait "42" et un calcul dessus donnerait
// n'importe quoi.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v))
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v))

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 })

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
})
