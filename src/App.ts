import SQLHandler from "./model/SQLHandler";

const express = require("express");
const path = require("path");
const hbs = require("hbs");
const bodyParser = require('body-parser')
const uniqid = require('uniqid');

const publicPath = path.join(__dirname, "public");

class App {
  public express;
  private sql;

  constructor(config) {
    this.express = express();
    this.configureRendering();
    this.connectToDatabase(config);
    this.mountRoutes();
  }

  private configureRendering(): void {
    this.express.use(express.static(publicPath));
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: true }));
    this.express.set("view engine", "hbs");
    hbs.registerPartials(publicPath + "/views/partials");

    hbs.registerHelper('lastXwords', (storyText, numWords) => {
      let words = '';
      const storyArray = storyText.split(' ');
      for (let i = (storyArray.length - numWords); i < storyArray.length; i += 1) {
        words = `${words} ${storyArray[i]}`;
      }
      return new hbs.SafeString(`<p>${words}</p>`);
    });
  }

  private mountRoutes(): void {
    const router = express.Router();

    router.get("/", (req, res) => {
      res.status(200).render(publicPath + "/views/index.hbs", {foo: 'bar'});
    });

    router.get("/create", (req, res) => {
      this.sql.runQuery(`CREATE TABLE story_portions (story_id VARCHAR(255), story_text TEXT, num_words INT, date_added DATETIME)`)
        .then(result => { res.status(200).render(publicPath + "/views/index.hbs"); })
        .catch(err => { console.log(err); });
    });

    router.get("/addnew", (req, res) => {
      this.sql.runQuery(`SELECT * FROM story_portions ORDER BY date_added DESC LIMIT 1`)
        .then(result => {
          res.status(200).render(publicPath + "/views/index.hbs", { databaseResult: result });
        })
        .catch(err => {
          console.log(err);
        });
    });

    router.post("/submitstory", (req, res) => {
      const currentDateAndTime = new Date().toISOString().split("T");
      const currentDateAndTimeSqlFormat = `${currentDateAndTime[0]} ${currentDateAndTime[1].split(".")[0]}`;

      this.sql.runQuery(`INSERT INTO story_portions (story_id, story_text, num_words, date_added) VALUES ('${uniqid()}', '${req.body.story}', ${req.body.numWords}, '${currentDateAndTimeSqlFormat}')`)
        .then(result => {
          res.status(200).render(publicPath + "/views/index.hbs");
        })
        .catch(err => {
          console.log(err);
        });
    });

    this.express.use("/", router);
  }

  connectToDatabase(config) {
    this.sql = new SQLHandler(config);
    this.sql.connect();
  }
}

export default App;
