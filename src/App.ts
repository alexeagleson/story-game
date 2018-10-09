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
// cookie-parser for secure cookies?

const jwtSecret = 'sadsaf7dsasd292mde963329';
const saltRounds = 10;

const publicPath = path.join(__dirname, "public");

const validateUsername = (textValue: string, formName: string, min: number = null, max: number = null) => {
  if (!(typeof textValue === 'string'))  return `${formName} must be text.`;
  if (textValue.length === 0) return `${formName} cannot be empty.`;
  if ((min !== null && max !== null) && (textValue.length < min || textValue.length > max)) return `${formName} must be between ${min} and ${max} characters long.`;
  const matchValidBasicUsername = textValue.match(/^[a-zA-Z0-9_ .-]*$/);
  if (!matchValidBasicUsername) return `${formName} can only contain basic letters and numbers.`; 
  return true;
};

// const validateStory = (textValue, formName) => {
//   if (!(typeof textValue === 'string'))  return `${formName} must be text.`;
//   if (textValue.length === 0) return `${formName} cannot be empty.`;
//   const matchValidExtended = textValue.match(/^[a-zA-Z0-9\r\n_ .,!;()?&'$-]*$/);
//   if (!matchValidExtended) return `${formName} cannot contain double quotes or weird punctuation.`;
//   return true;
// };

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
        req.username = (usernameResult[0] && usernameResult[0].username) || null;
        next();
      });
    };

    router.get("/", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(200).render(publicPath + "/views/login.hbs");
      res.status(200).render(publicPath + "/views/index.hbs", { user: req.username });
    });

    router.get("/addstory", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(200).render(publicPath + "/views/login.hbs");
      let storyID = null;

      this.sql.pool.query(`SELECT * FROM stories WHERE finished = ?`, [false], (error1, currentStoryResult, fields1) => {
        if (currentStoryResult && currentStoryResult.length > 0) storyID = currentStoryResult[currentStoryResult.length - 1].id;
        
        this.sql.pool.query(`SELECT * FROM story_portions WHERE story_id = ? ORDER BY date_added DESC`, [storyID], (error2, storyPortionResult, fields2) => {
          let totalLength = 0;
          if (storyPortionResult && storyPortionResult.length > 0) {
            const reducer = (accumulator, storyPortion) => accumulator + storyPortion.story_text.length;
            totalLength = storyPortionResult.reduce(reducer, 0);
          }
          const finishButton = totalLength > 1000 ? true : false;

          let uniqueAuthors = [];

          storyPortionResult.forEach((storyPortion) => {
            if (!uniqueAuthors.find(author => author === storyPortion.author_username)) uniqueAuthors.push(storyPortion.author_username);
          });

          const hbsArgs = {
            user: req.username,
            storyPiece: storyPortionResult[0],
            storyID,
            titleNeeded: !storyID,
            finishButton,
            uniqueAuthors,
            totalLength,
          }
          res.status(200).render(publicPath + "/views/addstory.hbs", hbsArgs);
        });
      });
    });

    router.get("/fullstory", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(200).render(publicPath + "/views/login.hbs");
      
      this.sql.pool.query(`SELECT story_portions.story_text, story_portions.id, story_portions.author_username, stories.title FROM story_portions INNER JOIN stories ON story_portions.story_id = stories.id WHERE stories.finished = 1 ORDER BY story_portions.date_added ASC`,
      (error, storyPortionsResult, fields) => {
        const allStories = [];
        if (storyPortionsResult && storyPortionsResult.length > 0) {
          let currentStory = [];
          let currentTitle = storyPortionsResult[0].title;
          let uniqueAuthors = [];

          storyPortionsResult.forEach((storyPortion) => {
            if (currentTitle !== storyPortion.title) {
              allStories.push({ title: currentTitle, story: currentStory, authors: uniqueAuthors });
              currentTitle = storyPortion.title;
              currentStory = [];
              uniqueAuthors = [];
            }
            if (!uniqueAuthors.find(author => author === storyPortion.author_username)) uniqueAuthors.push(storyPortion.author_username);
            currentStory.push({ story_portion: storyPortion.story_text, story_portion_id: storyPortion.id });
          });
          allStories.push({ title: currentTitle, story: currentStory, authors: uniqueAuthors });
          allStories.reverse();
        }
        res.status(200).render(publicPath + "/views/fullstory.hbs", { user: req.username, allStories });
      });
    });

    router.get("/login", (req, res) => {
      res.status(200).render(publicPath + "/views/login.hbs");
    });

    router.get("/register", (req, res) => {
      res.status(200).render(publicPath + "/views/register.hbs");
    });

    router.get("/dashboard", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(200).render(publicPath + "/views/login.hbs");

      this.sql.pool.query(`SELECT * from story_portions WHERE author_username = ?`, [req.username], (error, storyPortionsResult, fields) => {
        if (!(storyPortionsResult && storyPortionsResult.length > 0)) return res.status(200).render(publicPath + "/views/dashboard.hbs", { user: req.username, numberOfStories: 0, likedCount: 0, mostPopularStory: 'aint written anything yet' });
        const reducer = (accumulator, storyPortion) => accumulator + storyPortion.liked;
        const likedCount = storyPortionsResult.reduce(reducer, 0);
        const sortedLiked = storyPortionsResult.sort((a, b) => a.liked > b.liked).reverse();
        const topThreeLiked = sortedLiked.slice(0, 3)|| null;
        res.status(200).render(publicPath + "/views/dashboard.hbs", { user: req.username, numberOfStories: storyPortionsResult.length, likedCount, topThreeLiked });
      });
    });

    // BUILD DATABASE

    router.get("/createtablestories", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(401).send();

      this.sql.pool.query(`CREATE TABLE stories 
        (id CHAR(18),
        title VARCHAR(255),
        finished TINYINT(1),
        PRIMARY KEY (id))`, (error, result, fields) => {
          res.status(200).render(publicPath + "/views/index.hbs");
      });
    });

    router.get("/createtablestoryportions", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(401).send();

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

    router.get("/createtableusers", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(401).send();

      this.sql.pool.query(`CREATE TABLE story_portions 
          (username VARCHAR(20),
          password CHAR(60),
          PRIMARY KEY (username))`, (error, result, fields) => {
            res.status(200).render(publicPath + "/views/index.hbs");
        });
    });

    // POST

    router.post("/addstory", authenticate, (req, res) => {
      if (!(req && req.username)) return res.status(401).send();

      const currentDateAndTime = new Date().toISOString().split("T");
      const currentDateAndTimeSqlFormat = `${currentDateAndTime[0]} ${currentDateAndTime[1].split(".")[0]}`;
      const storyID = req.body.storyID || uniqid();
      const storyText = firstLetterLowercase(req.body.story);



      this.sql.pool.query(`INSERT INTO stories (id, title, finished) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE finished = ?`,
      [storyID, req.body.title, false, req.body.completeStory], (error2, insertResult, fields2) => {
        this.sql.pool.query(`INSERT INTO story_portions (id, story_text, num_words, date_added, story_id, author_username) VALUES (?, ?, ?, ?, ?, ?)`,
        [uniqid(), storyText, req.body.numWords, currentDateAndTimeSqlFormat, storyID, req.username], (error2, insertResult2, fields2) => {
          this.sql.pool.query(`UPDATE stories SET finished = ? WHERE id = ?`,
          [req.body.completeStory, storyID], (error3, updateResult, fields3) => {
            res.header('x-auth', 'success').send({});
          });
        });
      });
    });

    router.post("/login", (req, res) => {
      let formError = validateUsername(req.body.data.username, 'Username', 1, 20);
      if (typeof formError === 'string') return res.header('x-auth', 'error').send({ error: formError });

      this.sql.pool.query(`SELECT password FROM users WHERE username = ?`, [req.body.data.username], (error, passwordResult, fields) => {
        if (passwordResult && passwordResult.length > 0) {
          bcrypt.compare(req.body.data.password, passwordResult[0].password).then((compareResult) => {
            if (compareResult) {
              const currentUser = new User(req.body.data.username);
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
      let formError = validateUsername(req.body.username, 'Username', 1, 20);
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
      if (!(req && req.username)) res.header('x-auth', 'success').send({ success: false });
      
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


