import SQLHandler from "./model/SQLHandler";
import User from './model/User';

const express = require("express");
const path = require("path");
const hbs = require("hbs");
const bodyParser = require('body-parser')
const uniqid = require('uniqid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/// jwt secret unsecure
// database queries unsecure
// cookie-parser for secure cookies?

const jwtSecret = 'abc';

const saltRounds = 10;

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
        if (!!storyArray[i]) words = `${words} ${storyArray[i]}`;
      }
      return new hbs.SafeString(`<p>${words}</p>`);
    });
  }

  private mountRoutes(): void {
    const router = express.Router();

    router.get("/", (req, res) => {
      res.status(200).render(publicPath + "/views/index.hbs");
    });

    router.get("/create", (req, res) => {
      this.sql.runQuery(`CREATE TABLE story_portions (story_id VARCHAR(255), story_text TEXT, num_words INT, date_added DATETIME)`)
        .then(result => { res.status(200).render(publicPath + "/views/index.hbs"); })
        .catch(err => { console.log(err); });
    });

    router.get("/addstory", (req, res) => {
      this.sql.runQuery(`SELECT * FROM story_portions ORDER BY date_added DESC LIMIT 1`)
        .then(result => {
          res.status(200).render(publicPath + "/views/addstory.hbs", { databaseResult: result });
        })
        .catch(err => {
          console.log(err);
        });
    });

    router.get("/fullstory", (req, res) => {
      this.sql.runQuery(`SELECT * FROM story_portions`)
        .then(result => {
          res.status(200).render(publicPath + "/views/fullstory.hbs", { databaseResult: result });
        })
        .catch(err => {
          console.log(err);
        });
    });

    router.get("/login", (req, res) => {
      res.status(200).render(publicPath + "/views/login.hbs");
    });

    router.get("/register", (req, res) => {
      res.status(200).render(publicPath + "/views/register.hbs");
    });

    router.get("/dashboard", (req, res) => {
      if (!req.headers.cookie) {
        return res.status(200).render(publicPath + "/views/index.hbs", { status: `Not logged in.` });
      }
      const token = req.headers.cookie.split('=')[1];
      const decodedID = jwt.verify(token, jwtSecret);
      this.sql.runQuery(`SELECT username FROM users WHERE username = '${decodedID}'`)
        .then(result => {
          res.status(200).render(publicPath + "/views/index.hbs", { status: `Logged in as ${result[0].username}` });
        })
        .catch(err => {
          console.log(err);
        });
    });

    // POST

    router.post("/addstory", (req, res) => {
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

    router.post("/login", (req, res) => {
      this.sql.runQuery(`SELECT password FROM users WHERE username = '${req.body.username}'`)
        .then(result => {
          if (result.length > 0) {
            bcrypt.compare(req.body.password, result[0].password).then((compareResult) => {
              if (compareResult) {
                const currentUser = new User(req.body.username);
                currentUser.generateAuthToken(jwtSecret);
                res.header('x-auth', currentUser.token).send({ token: currentUser.token });
              } else {
                res.status(200).render(publicPath + "/views/login.hbs", { status: 'Password did not match.' });
              }
            });
          } else {
            res.status(200).render(publicPath + "/views/login.hbs", { status: 'Username not found.' });
          }
        })
        .catch(err => {
          console.log(err);
        });
    });

    router.post("/register", (req, res) => {
      this.sql.runQuery(`SELECT username FROM users WHERE username = '${req.body.username}'`)
        .then(result => {
          if (result.length > 0) {
            res.status(200).render(publicPath + "/views/register.hbs", { status: 'Username already registered.' });
          } else {
            bcrypt.hash(req.body.password, saltRounds).then((hash) => {
              this.sql.runQuery(`INSERT INTO users (username, password) VALUES ('${req.body.username}', '${hash}')`)
              .then(result => {
                res.status(200).render(publicPath + "/views/index.hbs", { status: `Registered user: ${req.body.username}.` });
              })
              .catch(err => {
                console.log(err);
              });
            });
          }
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
