const jwt = require('jsonwebtoken');

class User {
    public username: string;
    public token: string;

    constructor(username) {
        this.username = username;
    }

    generateAuthToken(jwtSecret) {
        this.token = jwt.sign(this.username, jwtSecret);
    }
}

export default User;