const newPostRequest = url => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
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