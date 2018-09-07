const uniqid = require('uniqid');

class StoryPiece {
    private id: string;
    private storyID: string;
    public storyText: string;
    public authorID: string;
    
    constructor(storyText) {
        this.id = uniqid();
        this.storyText = storyText;
        // this.storyID = 
        // this.authorID = 
    }
}

export default StoryPiece;