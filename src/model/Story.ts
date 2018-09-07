const uniqid = require('uniqid');

class Story {
    private id: string;
    private title: string;
    private finished: boolean;
    
    constructor() {
        this.id = uniqid();
        this.finished = false;
    }
}

export default Story;