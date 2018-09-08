import SQLHandler from "./model/SQLHandler";
import Story from './model/Story';
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
// escape chars for quotes
// clsoe sql connection

const jwtSecret = 'abc';

const saltRounds = 10;

const publicPath = path.join(__dirname, "public");

const validateUsername = (textValue, formName) => {
  if (!(typeof textValue === 'string'))  return `${formName} must be text.`;
  if (textValue.length === 0) return `${formName} cannot be empty.`;
  const matchValidBasicUsername = textValue.match(/^[a-zA-Z0-9_ .-]*$/);
  if (!matchValidBasicUsername) return `${formName} can only contain basic letters and numbers.`; 
  return true;
};

const validateStory = (textValue, formName) => {
  if (!(typeof textValue === 'string'))  return `${formName} must be text.`;
  if (textValue.length === 0) return `${formName} cannot be empty.`;
  const matchValidExtended = textValue.match(/^[a-zA-Z0-9\r\n_ .,!;()?&'$-]*$/);
  if (!matchValidExtended) return `${formName} cannot contain double quotes or weird punctuation.`;
  return true;
};

// const validateNumber = (numberValue, formName, min, max) => {
//   if (isNaN(numberValue)) return `${formName} must be a number.`;
//   if (numberValue % 1 !== 0) return `${formName} cannot be a decimal or fraction.`;
//   if (min && max) {
//       if (numberValue < min || numberValue > max) return `${formName} must be between ${min} and ${max}.`;
//   }
//   return true;
// };

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
      if (!storyText || !numWords) return new hbs.SafeString(``);
      let words: string = '';
      const storyArray = storyText.split(' ');
      for (let i = (storyArray.length - numWords); i < storyArray.length; i += 1) {
        if (!!storyArray[i]) words = `${words} ${storyArray[i]}`;
      }
      return new hbs.SafeString(`${words.trim()}`);
    });
  }

  private mountRoutes(): void {
    const router = express.Router();

    const authenticate = (req, res, next) => {
      const token = req.headers.cookie ? req.headers.cookie.split('=')[1] : null;
      if (!token) return next();
      const decodedID = jwt.verify(token, jwtSecret);
      this.sql.runQuery(`SELECT username FROM users WHERE username = '${decodedID}'`)
        .then(result => {
          req.username = result[0].username;
          next();
        })
        .catch(err => res.status(401).send());
    };

    router.get("/", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/index.hbs", { user: req.username });
    });

    router.get("/addstory", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();
      let storyID = null;

      this.sql.runQuery(`SELECT * FROM stories WHERE finished = ${false}`)
        .then(currentStoryResult => {
          if (currentStoryResult.length > 0) storyID = currentStoryResult[currentStoryResult.length - 1].id
          
          this.sql.runQuery(`SELECT * FROM story_portions WHERE story_id = '${storyID}' ORDER BY date_added DESC`)
          .then(storyPortionResult => {
            let totalLength = 0;
            if (storyPortionResult.length > 0) {
              const reducer = (accumulator, storyPortion) => accumulator + storyPortion.story_text.length;
              totalLength = storyPortionResult.reduce(reducer, 0);
            }
            const finishButton = totalLength > 500 ? true : false;

            const hbsArgs = {
              user: req.username,
              storyPiece: storyPortionResult[0],
              storyID,
              titleNeeded: !storyID,
              finishButton,
            }
            res.status(200).render(publicPath + "/views/addstory.hbs", hbsArgs);
          })
          .catch(err => { console.log(err); });
        })
        .catch(err => { console.log(err); }); 
    });

    router.get("/fullstory", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();
      
      this.sql.runQuery(`SELECT * FROM story_portions INNER JOIN stories ON story_portions.story_id = stories.id WHERE stories.finished = 1 ORDER BY story_portions.date_added ASC`)
        .then(result => {
          const allStories = [];
          if (result.length > 0) {
            let currentStory = '';
            let currentTitle = result[0].title;
  
            result.forEach((storyPortion) => {
              if (currentTitle !== storyPortion.title) {
                allStories.push({title: currentTitle, story: currentStory});
                currentTitle = storyPortion.title;
                currentStory = '';
              }
              currentStory = `${currentStory} ${storyPortion.story_text}`;
            });
            allStories.push({title: currentTitle, story: currentStory});
            allStories.reverse();
          }
          res.status(200).render(publicPath + "/views/fullstory.hbs", { user: req.username, allStories });
        })
        .catch(err => { console.log(err); });
    });

    router.get("/login", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/login.hbs", { user: req.username, registerOrLoginFunction: 'login()' });
    });

    router.get("/register", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/register.hbs", { user: req.username, registerOrLoginFunction: 'register()' });
    });

    router.get("/dashboard", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();

      this.sql.runQuery(`SELECT * from story_portions WHERE author_username = '${req.username}'`)
        .then(result => {
          res.status(200).render(publicPath + "/views/dashboard.hbs", { user: req.username, numberOfStories: result.length });
        })
        .catch(err => { console.log(err); });
    });

    // BUILD DATABASE

    // router.get("/create", authenticate, (req, res) => {
    //   this.sql.runQuery(`CREATE TABLE story_portions (story_id VARCHAR(255), story_text TEXT, num_words INT, date_added DATETIME, PRIMARY KEY (story_id))`)
    //     .then(result => { res.status(200).render(publicPath + "/views/index.hbs"); })
    //     .catch(err => { console.log(err); });
    // });

    // POST

    router.post("/addstory", authenticate, (req, res) => {
      let formError = validateStory(req.body.story, 'Story');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      if (!req.body.storyID) {
        let formError = validateStory(req.body.title, 'Title');
        if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });
      }

      const currentDateAndTime = new Date().toISOString().split("T");
      const currentDateAndTimeSqlFormat = `${currentDateAndTime[0]} ${currentDateAndTime[1].split(".")[0]}`;

      const storyID = req.body.storyID || uniqid();
      const title = req.body.title && req.body.title.replace(`'`, `\'`);
      const storyText = req.body.story.replace(`'`, `\'`);

      this.sql.runQuery(`INSERT INTO stories (id, title, finished) VALUES ("${storyID}", "${title}", ${false}) ON DUPLICATE KEY UPDATE finished = ${req.body.finishStory}`)
        .then(insertResult => {
          this.sql.runQuery(`INSERT INTO story_portions (id, story_text, num_words, date_added, story_id, author_username) VALUES ("${uniqid()}", "${storyText}", ${req.body.numWords}, "${currentDateAndTimeSqlFormat}", "${storyID}", "${req.username}")`)
          .then(result => {
            res.header('x-auth', 'success').send({});
          })
          .catch(err => { console.log(err); });
        })
        .catch(err => { console.log(err); });
    });

    router.post("/login", (req, res) => {
      let formError = validateUsername(req.body.username, 'Username');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      formError = validateUsername(req.body.password, 'Password');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      this.sql.runQuery(`SELECT password FROM users WHERE username = '${req.body.username}'`)
        .then(result => {
          if (result.length > 0) {
            bcrypt.compare(req.body.password, result[0].password).then((compareResult) => {
              if (compareResult) {
                const currentUser = new User(req.body.username);
                currentUser.generateAuthToken(jwtSecret);
                res.header('x-auth', currentUser.token).send({ token: currentUser.token });
              } else {
                res.header('x-auth', 'error').send({ error: 'Password did not match.' });
              }
            });
          } else {
            res.header('x-auth', 'error').send({ error: 'Username not found.' });
          }
        })
        .catch(err => { console.log(err); });
    });

    router.post("/register", (req, res) => {
      let formError = validateUsername(req.body.username, 'Username');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      formError = validateUsername(req.body.password, 'Password');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      this.sql.runQuery(`SELECT username FROM users WHERE username = '${req.body.username}'`)
        .then(result => {
          if (result.length > 0) {
            res.header('x-auth', 'error').send({ error: 'Username already registered.' });
          } else {
            bcrypt.hash(req.body.password, saltRounds).then((hash) => {
              this.sql.runQuery(`INSERT INTO users (username, password) VALUES ('${req.body.username}', '${hash}')`)
              .then(result => {
                const currentUser = new User(req.body.username);
                currentUser.generateAuthToken(jwtSecret);
                res.header('x-auth', currentUser.token).send({ token: currentUser.token });
              })
              .catch(err => { console.log(err); });
            });
          }
        })
        .catch(err => { console.log(err); });
    });

    this.express.use("/", router);
  }

  connectToDatabase(config) {
    this.sql = new SQLHandler(config);
    this.sql.connect();
  }

  closeAllConnections() {
    return this.sql.closeAllConnections();
  }
}

export default App;
