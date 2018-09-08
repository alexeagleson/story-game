import App from "./App";

require("dotenv").config();

const databaseConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const appWithDB = new App(databaseConfig);
const app = appWithDB.express;

app.listen(3000, () => {
  console.log("App is listening on port " + 3000);
});

process.on('SIGINT', () => {
  appWithDB.closeAllConnections().then((response) => {
    console.log(response);
    console.log('Server shut down.')
    process.exit();
  });
});