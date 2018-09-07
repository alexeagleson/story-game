const jwt = require('jsonwebtoken');
const uniqid = require('uniqid');

class User {
    public id: string;
    public username: string;
    public token: string;

    constructor(username) {
        this.id = uniqid();
        this.username = username;
    }

    generateAuthToken(jwtSecret) {
        this.token = jwt.sign(this.username, jwtSecret);
    }
}

export default User;