import App from "./App";

require("dotenv").config();

const databaseConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const app = new App(databaseConfig).express;

app.listen(3000, () => {
  console.log("App is listening on port " + 3000);
});
