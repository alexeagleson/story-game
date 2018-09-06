

const newPostRequest = url => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  return xhr;
};


const newGetRequest = url => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  return xhr;
};

const createTable = () => {
  const xhr = newPostRequest("/create");
  xhr.send(JSON.stringify({ value: "hello" }));
};

const getStory = () => {
  fetch('/getStory', { method: 'GET' })
      .then((response) => {
          if (response.status !== 200) throw Error(`${response.status} ${response.statusText}`);
      })
      .catch(error => console.error(`Fetch Error =\n`, error));
};

const submitStory = () => {
  const storyText = (<HTMLInputElement>document.getElementById("story-field")).value;
  fetch(`/addStory`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ story: storyText })
  })
    .then(response => console.log(response))
    .catch(error => console.error(`Fetch Error =\n`, error));
};



const postLogin = () => {
  const usernameInput = (<HTMLInputElement>document.getElementById('username')).value;
  const passwordInput = (<HTMLInputElement>document.getElementById('password')).value;

  fetch(`/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
    .then(response => response.json())
    .then(data => {
      localStorage.setItem('jwt', data.token);
      document.cookie = `jwtCookie=${data.token}`;

      document.location.href = '/dashboard';

      // const xhr = newGetRequest('/dashboard')
      // xhr.setRequestHeader('x-auth', localStorage.getItem('jwt'));
      // xhr.send(JSON.stringify({ value: "hello" }));

      // fetch(`/dashboard`, {
      //   method: "GET",
      //   headers: { 'x-auth': localStorage.getItem('jwt') }
      // })
      // .then(response => {
      //   document.location.href = '/dashboard';
      // })
      // .catch(error => console.error(`Fetch Error =\n`, error));




    })
    .catch(error => console.error(`Fetch Error =\n`, error));
};
