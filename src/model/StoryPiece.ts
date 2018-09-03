const uniqid = require('uniqid');

class StoryPiece {
    private id: string;
    public storyText: string;
    
    constructor(storyText) {
        this.id = uniqid();
        this.storyText = storyText;
    }
}

export default StoryPiece;