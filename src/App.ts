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

const jwtSecret = 'sadsaf7292mde963329';
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

const firstLetterLowercase = (str) => str.charAt(0).toLowerCase() + str.slice(1);

class App {
  public express;
  public sql;

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
      let storyArray = storyText.split(' ');
      storyArray = storyArray.filter(storyPiece => storyPiece.length > 0);
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
      this.sql.pool.query(`SELECT username FROM users WHERE username = ?`, [decodedID], (error, usernameResult, fields) => {
        req.username = usernameResult[0].username;
        next();
      });
    };

    router.get("/", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/index.hbs", { user: req.username });
    });

    router.get("/addstory", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();
      let storyID = null;

      this.sql.pool.query(`SELECT * FROM stories WHERE finished = ?`, [false], (error1, currentStoryResult, fields1) => {
        if (currentStoryResult && currentStoryResult.length > 0) storyID = currentStoryResult[currentStoryResult.length - 1].id;
        
        this.sql.pool.query(`SELECT * FROM story_portions WHERE story_id = ? ORDER BY date_added DESC`, [storyID], (error2, storyPortionResult, fields2) => {
          let totalLength = 0;
          if (storyPortionResult && storyPortionResult.length > 0) {
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
        });
      });
    });

    router.get("/fullstory", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();
      
      this.sql.pool.query(`SELECT story_portions.story_text, story_portions.id, stories.title FROM story_portions INNER JOIN stories ON story_portions.story_id = stories.id WHERE stories.finished = 1 ORDER BY story_portions.date_added ASC`,
      (error, storyPortionsResult, fields) => {
        const allStories = [];
        if (storyPortionsResult && storyPortionsResult.length > 0) {
          let currentStory = [];
          let currentTitle = storyPortionsResult[0].title;

          storyPortionsResult.forEach((storyPortion) => {
            if (currentTitle !== storyPortion.title) {
              allStories.push({title: currentTitle, story: currentStory});
              currentTitle = storyPortion.title;
              currentStory = [];
            }
            currentStory.push({ story_portion: storyPortion.story_text, story_portion_id: storyPortion.id });
          });
          allStories.push({title: currentTitle, story: currentStory});
          allStories.reverse();
        }
        res.status(200).render(publicPath + "/views/fullstory.hbs", { user: req.username, allStories });
      });
    });

    router.get("/login", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/login.hbs", { user: req.username, registerOrLoginFunction: 'login()' });
    });

    router.get("/register", authenticate, (req, res) => {
      res.status(200).render(publicPath + "/views/register.hbs", { user: req.username, registerOrLoginFunction: 'register()' });
    });

    router.get("/dashboard", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();

      this.sql.pool.query(`SELECT * from story_portions WHERE author_username = ?`, [req.username], (error, storyPortionsResult, fields) => {
        if (!storyPortionsResult) return res.status(200).render(publicPath + "/views/dashboard.hbs", { user: req.username, numberOfStories: 0 });
        const reducer = (accumulator, storyPortion) => accumulator + storyPortion.liked;
        const likedCount = storyPortionsResult.reduce(reducer, 0);
        const mostPopularStory = storyPortionsResult.reduce((prev, current) => current.liked > prev.liked ? current : prev);
        res.status(200).render(publicPath + "/views/dashboard.hbs", { user: req.username, numberOfStories: storyPortionsResult.length, likedCount, mostPopularStory: mostPopularStory.story_text });
      });
    });

    // BUILD DATABASE

    router.get("/createstoriestest", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();

      this.sql.pool.query(`CREATE TABLE stories 
        (id CHAR(18),
        title VARCHAR(255),
        finished TINYINT(1),
        PRIMARY KEY (id))`, (error, result, fields) => {
          res.status(200).render(publicPath + "/views/index.hbs");
      });
    });

    router.get("/createstoryportionstest", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();

      this.sql.pool.query(`CREATE TABLE story_portions 
          (id CHAR(18),
          story_text TEXT,
          num_words INT,
          date_added DATETIME,
          story_id CHAR(18),
          author_username VARCHAR(20),
          liked INT,
          PRIMARY KEY (id))`, (error, result, fields) => {
            res.status(200).render(publicPath + "/views/index.hbs");
        });
    });

    // POST

    router.post("/addstory", authenticate, (req, res) => {
      if (!req.username) return res.status(401).send();

      const currentDateAndTime = new Date().toISOString().split("T");
      const currentDateAndTimeSqlFormat = `${currentDateAndTime[0]} ${currentDateAndTime[1].split(".")[0]}`;
      const storyID = req.body.storyID || uniqid();
      const storyText = firstLetterLowercase(req.body.story);

      this.sql.pool.query(`INSERT INTO stories (id, title, finished) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE finished = ?`,
        [storyID, req.body.title, false, req.body.finishStory], (error1, insertResult, fields1) => {
          this.sql.pool.query(`INSERT INTO story_portions (id, story_text, num_words, date_added, story_id, author_username) VALUES (?, ?, ?, ?, ?, ?)`,
          [uniqid(), storyText, req.body.numWords, currentDateAndTimeSqlFormat, storyID, req.username], (error2, insertResult2, fields2) => {
            res.header('x-auth', 'success').send({});
          });
        });
    });

    router.post("/login", (req, res) => {
      let formError = validateUsername(req.body.username, 'Username');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      formError = validateUsername(req.body.password, 'Password');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });
      this.sql.pool.query(`SELECT password FROM users WHERE username = ?`, [req.body.username], (error, passwordResult, fields) => {
        if (passwordResult && passwordResult.length > 0) {
          bcrypt.compare(req.body.password, passwordResult[0].password).then((compareResult) => {
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
      });
    });

    router.post("/register", (req, res) => {
      let formError = validateUsername(req.body.username, 'Username');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      formError = validateUsername(req.body.password, 'Password');
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      this.sql.pool.query(`SELECT username FROM users WHERE username = ?`, [req.body.username], (error, checkUsername, fields) => {
        if (checkUsername && checkUsername.length > 0) {
          res.header('x-auth', 'error').send({ error: 'Username already registered.' });
        } else {
          bcrypt.hash(req.body.password, saltRounds).then((hash) => {
            this.sql.pool.query(`INSERT INTO users (username, password) VALUES (?, ?)`, [req.body.username, hash], (error, insertResult, fields) => {
              const currentUser = new User(req.body.username);
              currentUser.generateAuthToken(jwtSecret);
              res.header('x-auth', currentUser.token).send({ token: currentUser.token });
            });
          });
        }
      });
    });

    router.post("/markfunny", authenticate, (req, res) => {
      this.sql.pool.query(`UPDATE story_portions SET liked = liked + 1 WHERE id = ?`, [req.body.story_portion_id], (error, updateResult, fields) => {
        res.header('x-auth', 'success').send({ success: true });
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



// remove first caps
// fix SQL injection
// fix undefined user
// lowercase first letter
// added stories
// added funny
// more stats
// fixed number of words