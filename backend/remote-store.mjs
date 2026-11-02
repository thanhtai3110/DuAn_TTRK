import { createClient } from '@libsql/client';

// Match the existing SQLite statement interface while executing over libSQL.
// Credentials stay on the backend and are never sent to browsers.
export function remoteStore(url, authToken) {
  const client = createClient({ url, authToken, intMode: 'number' });
  const execute = (sql, args) => client.execute({ sql, args });
  return {
    prepare(sql) {
      return {
        async get(...args) { return (await execute(sql, args)).rows[0]; },
        async all(...args) { return (await execute(sql, args)).rows; },
        async run(...args) {
          const result = await execute(sql, args);
          return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
        },
      };
    },
    exec(sql) {
      // The cloud database owns journal and connection settings.
      return client.executeMultiple(sql.replace(/PRAGMA\s+(?:journal_mode|busy_timeout)\s*=[^;]+;/gi, ''));
    },
    close() { client.close(); },
  };
}
