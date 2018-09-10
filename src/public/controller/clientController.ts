const updateWordCount = () => {
  const wordCount = (<HTMLInputElement>document.getElementById('story')).value.length;
  const warningElement = document.getElementById('word-count');
  warningElement.innerHTML = `Number of characters: ${wordCount.toString()}/250`;
}

const addStory = (finishStory = false) => {
  const storyInput = (<HTMLInputElement>document.getElementById('story')).value;
  const numWordsInput = (<HTMLInputElement>document.getElementById('numWords')).value;
  const storyIDInput = (<HTMLInputElement>document.getElementById('storyID')).value;

  const titleElement = (<HTMLInputElement>document.getElementById('title'));
  const titleInput = titleElement ? titleElement.value : null;

  fetch(`/addstory`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ story: storyInput, numWords: numWordsInput, storyID: storyIDInput, finishStory, title: titleInput })
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        document.getElementById('error-addstory').innerHTML = data.error;
        return;
      };
      document.location.href = '/';
    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};

const finishStory = () => addStory(true);

const register = () => {
  const usernameInput = (<HTMLInputElement>document.getElementById('username')).value;
  const passwordInput = (<HTMLInputElement>document.getElementById('password')).value;

  fetch(`/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        (<HTMLInputElement>document.getElementById('username')).value = '';
        (<HTMLInputElement>document.getElementById('password')).value = '';
        document.getElementById('error-register').innerHTML = data.error;
        return;
      };
      document.cookie = `jwtCookie=${data.token}`;
      document.location.href = '/dashboard';
    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};

const login = () => {
  const usernameInput = (<HTMLInputElement>document.getElementById('username')).value;
  const passwordInput = (<HTMLInputElement>document.getElementById('password')).value;

  fetch(`/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        (<HTMLInputElement>document.getElementById('username')).value = '';
        (<HTMLInputElement>document.getElementById('password')).value = '';
        document.getElementById('error-login').innerHTML = data.error;
        return;
      };
      document.cookie = `jwtCookie=${data.token}`;
      document.location.href = '/dashboard';      
    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};

const logout = () => {
  document.cookie = "jwtCookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.location.href = '/';
};

const showFunnyButton = (e) => {
  e = e || window.event;
  const target = e.target || e.srcElement;
  const funnyButton = document.getElementById('funny-button');
  funnyButton.style.display = 'block';
  funnyButton.style.left = `${e.pageX}px`
  funnyButton.style.top = `${e.pageY}px`
  funnyButton['targetid'] = target.id;
};

const hideFunnyButton = (e) => {
  e = e || window.event;
  const target = e.target || e.srcElement;
  if (target.className === 'story_portion') return;
  const funnyButton = document.getElementById('funny-button');
  funnyButton.style.display = 'none';
};

const funnyConfirm = (e) => {
  e = e || window.event;
  const target = e.target || e.srcElement;

  fetch(`/markfunny`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ story_portion_id: target.targetid })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) document.location.href = '/fullstory';
    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};

window.addEventListener('click', hideFunnyButton);