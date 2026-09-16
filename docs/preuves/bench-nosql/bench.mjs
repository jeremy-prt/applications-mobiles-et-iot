import { MongoClient } from 'mongodb'
import pg from 'pg'

const TOTAL = Number(process.env.TOTAL ?? 1_000_000)
const LOT = Number(process.env.LOT ?? 1000)
const OBJETS = 100

// Un message identique au contrat du kit, pour que la mesure porte sur des
// donnees realistes et pas sur un document jouet.
function message(i) {
  const device = `sensor-${String((i % OBJETS) + 1).padStart(3, '0')}`
  const t = new Date(Date.now() - (TOTAL - i) * 100)
  return {
    schema_version: 1,
    message_id: `boot-${Math.floor(i / 50_000)}-${i}`,
    device_id: device,
    room_id: `salle-${200 + (i % OBJETS)}`,
    observed_at: t.toISOString(),
    temperature: { value: 20 + (i % 500) / 100, unit: '°C' },
    co2: { value: 420 + (i % 2000), unit: 'ppm' },
  }
}

function chrono() {
  const t0 = process.hrtime.bigint()
  return () => Number(process.hrtime.bigint() - t0) / 1e9
}

async function mongo() {
  const client = new MongoClient('mongodb://127.0.0.1:27018')
  await client.connect()
  const db = client.db('bench')
  await db.dropDatabase()
  const col = db.collection('brut')
  await col.createIndex({ device_id: 1, message_id: 1 }, { unique: true })

  const fin = chrono()
  const jalons = []
  let lot = []
  for (let i = 0; i < TOTAL; i++) {
    lot.push(message(i))
    if (lot.length === LOT) {
      await col.insertMany(lot, { ordered: false })
      lot = []
      if ((i + 1) % 100_000 === 0) jalons.push([i + 1, fin()])
    }
  }
  if (lot.length) await col.insertMany(lot, { ordered: false })
  const ecriture = fin()

  const stats = await db.command({ collStats: 'brut' })

  const q = chrono()
  const agg = await col.aggregate([
    { $group: { _id: { d: '$device_id', h: { $substr: ['$observed_at', 0, 13] } },
                moy: { $avg: '$co2.value' }, max: { $max: '$co2.value' } } },
    { $count: 'lignes' },
  ], { allowDiskUse: true }).toArray()
  const requete = q()

  // Ecriture message par message, ce que ferait un consommateur MQTT naif.
  const u = chrono()
  const unitaire = db.collection('unitaire')
  await unitaire.drop().catch(() => {})
  for (let i = 0; i < 10_000; i++) await unitaire.insertOne(message(i))
  const parMessage = u() / 10_000 * 1000

  await client.close()
  return { ecriture, jalons, octets: stats.storageSize + (stats.totalIndexSize ?? 0),
           requete, groupes: agg[0]?.lignes ?? 0, parMessage }
}

async function postgres() {
  const pool = new pg.Pool({ host: '127.0.0.1', port: 55433, user: 'bench',
                             password: 'bench', database: 'bench' })
  await pool.query('drop table if exists brut')
  await pool.query(`create table brut (
    device_id text not null, message_id text not null,
    observed_at timestamptz not null, payload jsonb not null,
    unique (device_id, message_id))`)

  const fin = chrono()
  const jalons = []
  let lot = []
  const ecrire = async (docs) => {
    const vals = [], params = []
    docs.forEach((d, k) => {
      const o = k * 4
      vals.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4})`)
      params.push(d.device_id, d.message_id, d.observed_at, JSON.stringify(d))
    })
    await pool.query(
      `insert into brut (device_id, message_id, observed_at, payload)
       values ${vals.join(',')} on conflict do nothing`, params)
  }
  for (let i = 0; i < TOTAL; i++) {
    lot.push(message(i))
    if (lot.length === LOT) {
      await ecrire(lot); lot = []
      if ((i + 1) % 100_000 === 0) jalons.push([i + 1, fin()])
    }
  }
  if (lot.length) await ecrire(lot)
  const ecriture = fin()

  const { rows: taille } = await pool.query(
    "select pg_total_relation_size('brut') as o")

  const q = chrono()
  const { rows: agg } = await pool.query(`
    select count(*) as lignes from (
      select device_id, date_trunc('hour', observed_at) h,
             avg((payload->'co2'->>'value')::numeric) moy,
             max((payload->'co2'->>'value')::numeric) mx
      from brut group by 1, 2) x`)
  const requete = q()

  const u = chrono()
  await pool.query('drop table if exists unitaire')
  await pool.query(`create table unitaire (
    device_id text, message_id text, observed_at timestamptz, payload jsonb)`)
  for (let i = 0; i < 10_000; i++) {
    const d = message(i)
    await pool.query(
      'insert into unitaire values ($1,$2,$3,$4)',
      [d.device_id, d.message_id, d.observed_at, JSON.stringify(d)])
  }
  const parMessage = u() / 10_000 * 1000

  await pool.end()
  return { ecriture, jalons, octets: Number(taille[0].o),
           requete, groupes: Number(agg[0].lignes), parMessage }
}

const cible = process.argv[2]
const r = cible === 'mongo' ? await mongo() : await postgres()
console.log(JSON.stringify({ cible, total: TOTAL, lot: LOT, ...r }))
