let LESSONS = {};

async function init() {
  const res = await fetch('../data/lessons.json');
  LESSONS = await res.json();
  renderPackList();
}

function renderPackList() {
  const nav = document.getElementById('packList');
  nav.innerHTML = '';
  Object.keys(LESSONS).forEach((name) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.onclick = () => selectPack(name, btn);
    nav.appendChild(btn);
  });
}

function selectPack(name, btn) {
  document.querySelectorAll('#packList button').forEach((b) => b.classList.remove('on'));
  btn.classList.add('on');
  renderLessons(name);
}

function renderLessons(packName) {
  const view = document.getElementById('lessonView');
  view.innerHTML = '';
  const lessons = LESSONS[packName] || [];
  lessons.forEach((lesson) => {
    const div = document.createElement('div');
    div.className = 'lesson';

    const h2 = document.createElement('h2');
    h2.textContent = `Day ${lesson.day}: ${lesson.title}`;
    div.appendChild(h2);

    const pre = document.createElement('pre');
    let text = lesson.content;
    if (lesson.action) text += `\n\nToday's action:\n${lesson.action}`;
    if (lesson.reflection) text += `\n\nReflection:\n${lesson.reflection}`;
    pre.textContent = text;
    div.appendChild(pre);

    view.appendChild(div);
  });
}

init();
