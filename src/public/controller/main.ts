let funnyPending = false;

const axios = window['axios'];

const updateWordCount = () => {
  const wordCount = (<HTMLInputElement>document.getElementById('story')).value.length;
  const warningElement = document.getElementById('word-count');
  warningElement.innerHTML = `Number of characters: ${wordCount.toString()}/350}`;
}

const addStory = (completeStory = false) => {
  const storyInput = (<HTMLInputElement>document.getElementById('story')).value;
  const numWordsInput = (<HTMLInputElement>document.getElementById('numWords')).value;
  const storyIDInput = (<HTMLInputElement>document.getElementById('storyID')).value;

  const titleElement = (<HTMLInputElement>document.getElementById('title'));
  const titleInput = titleElement ? titleElement.value : null;

  fetch(`/addstory`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ story: storyInput, numWords: numWordsInput, storyID: storyIDInput, completeStory, title: titleInput })
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        document.getElementById('error-addstory').innerHTML = data.error;
        return;
      };

      const discordMessage = completeStory ? 'A new story has been finished!' : 'The story has been updated.';

      axios.post('https://discordapp.com/api/webhooks/499340810240786462/4C3w250HfRD4K9dp9Esange0vfTJekWVyzC2UXN7CsPbDdtcn4zoUJCFtSd-n7PNPoTE', {
        content: discordMessage
      })
      .then(function (response) {})
      .catch(function (error) {
        console.log(error);
      });

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

  axios.post('/login', {
    data: { username: usernameInput, password: passwordInput }
  })
  .then(function (response) {
    if (response.data.error) {
      (<HTMLInputElement>document.getElementById('username')).value = '';
      (<HTMLInputElement>document.getElementById('password')).value = '';
      document.getElementById('error-login').innerHTML = response.data.error;
      return;
    };
    document.cookie = `jwtCookie=${response.data.token}`;
    document.location.href = '/dashboard';    
  })
  .catch(function (error) {
    console.log(error);
  });
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
  target.style.color = 'red';
  setTimeout(() => { target.style.color = 'black'; }, 1000);
};

const hideFunnyButton = (e) => {
  e = e || window.event;
  const target = e.target || e.srcElement;
  if (target.className === 'story_portion') return;
  const funnyButton = document.getElementById('funny-button');
  if (funnyButton) funnyButton.style.display = 'none';
};

const funnyConfirm = (e) => {
  e = e || window.event;
  const target = e.target || e.srcElement;

  if (funnyPending) return;
  funnyPending = true;

  fetch(`/markfunny`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ story_portion_id: target.targetid })
  })
    .then(response => response.json())
    .then(data => {
      funnyPending = false;
    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};

window.addEventListener('click', hideFunnyButton);