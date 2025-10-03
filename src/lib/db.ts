import 'dotenv/config';
import mssql from 'mssql';

// Store database connection (demo functional)
export const storePool = new mssql.ConnectionPool({
  server: process.env.MSSQL_STORE_SERVER!,
  database: process.env.MSSQL_STORE_DB!,
  user: process.env.MSSQL_STORE_USER!,
  password: process.env.MSSQL_STORE_PASS!,
  options: { encrypt: true, trustServerCertificate: true },
}).connect();

// 🎮 GAME DATABASE INTEGRATION POINTS:
// In a real implementation, you would also configure and export game database connections:
//
// export const gamePool = new mssql.ConnectionPool({
//   server: process.env.MSSQL_GAME_SERVER!,
//   database: process.env.MSSQL_GAME_DB!,
//   user: process.env.MSSQL_GAME_USER!,
//   password: process.env.MSSQL_GAME_PASS!,
//   options: { encrypt: true, trustServerCertificate: true },
// }).connect();
//
// export const worldPool = new mssql.ConnectionPool({
//   server: process.env.MSSQL_WORLD_SERVER!,
//   database: process.env.MSSQL_WORLD_DB!,
//   user: process.env.MSSQL_WORLD_USER!,
//   password: process.env.MSSQL_WORLD_PASS!,
//   options: { encrypt: true, trustServerCertificate: true },
// }).connect();
//
// These connect to your game's databases for:
// - gamePool: Account creation, item delivery, character data
// - worldPool: Leaderboards, game statistics, world data