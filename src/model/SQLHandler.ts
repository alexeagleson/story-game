const mysql = require("mysql");

class SQLHandler {
  private config;
  public pool;

  constructor(databaseConfig) {
    this.config = databaseConfig;
  }

  connect() {
    this.pool = mysql.createPool(this.config);
  }
}

export default SQLHandler;
