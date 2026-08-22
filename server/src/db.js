import pg from 'pg';

const { Pool } = pg;

/* Подключение задаётся одним из двух способов.
   1. DATABASE_URL — одной строкой. Спецсимволы в пароле (@ : / ? # % [ ]) обязаны быть
      закодированы процентами, иначе строка распарсится не так, как выглядит.
   2. PGUSER / PGPASSWORD / PGHOST / PGPORT / PGDATABASE — по отдельности.
      Кодировать ничего не нужно, поэтому этот способ надёжнее для сложных паролей. */
const hasUrl = Boolean(process.env.DATABASE_URL);
const hasParts = Boolean(process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE);

if (!hasUrl && !hasParts) {
  throw new Error(
    'Не задано подключение к базе. Укажите в .env либо DATABASE_URL, ' +
      'либо PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE. Образец — в .env.example'
  );
}

/* Деньги хранятся целыми копейками, длительности — целыми минутами.
   Драйвер по умолчанию отдаёт bigint строкой, чтобы не терять точность;
   нам это не нужно, идентификаторы влезают в number. */
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new Pool(
  hasUrl
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST ?? 'localhost',
        port: Number(process.env.PGPORT ?? 5433),
        database: process.env.PGDATABASE
      }
);

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
