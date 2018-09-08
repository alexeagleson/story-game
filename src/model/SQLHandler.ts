const mysql = require("mysql");

class SQLHandler {
  private config;
  private pool;

  constructor(databaseConfig) {
    this.config = databaseConfig;
  }

  connect() {
    this.pool = mysql.createPool(this.config);
  }

  runQuery(queryString) {
    return new Promise((resolve, reject) => {
      this.pool.query(queryString, (error, results, fields) => {
        if (error) return reject(error);
        resolve(results);
      });
    });
  }

  closeAllConnections() {
    return new Promise((resolve, reject) => {
      this.pool.end((error) => {
        if (error) return reject(error);
        resolve('All database connections closed');
      });
    });
  }
}

export default SQLHandler;
