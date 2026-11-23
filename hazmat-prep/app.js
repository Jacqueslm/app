(function () {
  "use strict";

  const DATA = window.HAZMAT_DATA;
  if (!DATA || !Array.isArray(DATA.QUESTIONS) || !DATA.QUESTIONS.length) {
    document.getElementById("main").innerHTML =
      '<div class="empty-state"><h3>The question bank did not load.</h3><p>Make sure questions.js is loaded after data.js and before app.js.</p></div>';
    return;
  }

  const {
    TOPICS,
    LESSONS,
    SOURCES,
    LAST_VERIFIED,
    EXAM_LENGTH,
    EXAM_PASS_COUNT,
    QUIZ_LENGTH
  } = DATA;

  const QUESTIONS = DATA.QUESTIONS.map(function (q, index) {
    return Object.assign({}, q, { id: "q" + (index + 1) });
  });

  const STORAGE_KEY = "hazmat-h-progress-v1";
  const LETTERS = ["A", "B", "C", "D"];
  const PASS_PERCENT = 80;

  const DEFAULT_PROGRESS = {
    completedLessons: [],
    quizBest: 0,
    quizAttempts: 0,
    examBest: 0,
    examPassed: false,
    examAttempts: [],
    missed: [],
    checklist: {},
    lastLesson: null
  };

  let progress = loadProgress();
  let view = "dashboard";
  let currentLesson = null;
  let quiz = null;
  let exam = null;
  let lastResult = null;
  let examTimer = null;
  let toastTimer = null;

  const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const speech = {
    token: 0,
    queue: [],
    index: 0,
    speaking: false,
    paused: false,
    context: null
  };

  const app = document.getElementById("main");
  const toast = document.getElementById("toast");

  const STEPS = [
    {
      id: "eligibility",
      title: "Confirm you are eligible",
      desc: "Be at least 21, be a U.S. citizen or lawful permanent resident, and hold a Missouri CDL. H cannot be added to a CLP.",
      meta: ["Required", "Before testing"],
      link: "https://dor.mo.gov/driver-license/issuance/commercial/hazmat.html",
      linkLabel: "Missouri DOR"
    },
    {
      id: "eldt",
      title: "Complete H ELDT theory",
      desc: "This is the gate before the knowledge test. First-time H applicants on or after Feb. 7, 2022 must complete hazardous materials theory from an FMCSA Training Provider Registry provider; Missouri checks it electronically before you test.",
      meta: ["Gate before test", "First-time H"],
      link: "https://tpr.fmcsa.dot.gov",
      linkLabel: "Find a TPR provider"
    },
    {
      id: "tsa",
      title: "Start the TSA threat assessment early",
      desc: "Apply online or by phone, pay the fee, and complete fingerprints at an approved enrollment site. TSA approval is required before H is issued, not before the knowledge test. Start at least 60 days early; processing can exceed 45 days.",
      meta: ["Parallel step", "Before issuance"],
      link: "https://tsaenrollmentbyidemia.tsa.dhs.gov/programs/hme",
      linkLabel: "TSA enrollment"
    },
    {
      id: "study",
      title: "Study Section 9 and pass the practice final",
      desc: "Use the lessons and question bank in this app. Aim for consistent scores above 80% before you sit the official test.",
      meta: ["Study", "80% target"],
      link: "https://dor.mo.gov/forms/CDL%20Manual.pdf",
      linkLabel: "Missouri CDL Manual"
    },
    {
      id: "test",
      title: "Pass the 30-question Missouri test",
      desc: "Take the H written test at a Missouri State Highway Patrol examination station once ELDT is on file. You need 24 of 30 correct. You can test while TSA is pending; H is issued only after approval. Commercial exams are English only; no interpreter.",
      meta: ["30 questions", "24 to pass"],
      link: "https://www.mshp.dps.missouri.gov/MSHPWeb/PatrolDivisions/DED/index.html",
      linkLabel: "MSHP testing"
    },
    {
      id: "issue",
      title: "Add H at a Missouri license office",
      desc: "After you pass the test and TSA approves you, complete the CDL transaction at a license office. Bring your TSA approval and required identity/residency documents.",
      meta: ["After approval", "CDL transaction"],
      link: "https://dor.mo.gov/driver-license/issuance/commercial/hazmat.html",
      linkLabel: "DOR requirements"
    },
    {
      id: "renew",
      title: "Calendar the renewal",
      desc: "Retake the H written test at renewal and complete a new TSA assessment at least every five years. A CDL with H cannot be issued beyond the current assessment date.",
      meta: ["Every renewal", "5-year TSA cycle"],
      link: "https://dor.mo.gov/faq/driver-license/hazmat.html",
      linkLabel: "DOR renewal FAQ"
    }
  ];

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);

  render();

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshProgress();
      const parsed = JSON.parse(raw);
      return {
        completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
        quizBest: Number(parsed.quizBest) || 0,
        quizAttempts: Number(parsed.quizAttempts) || 0,
        examBest: Number(parsed.examBest) || 0,
        examPassed: Boolean(parsed.examPassed),
        examAttempts: Array.isArray(parsed.examAttempts) ? parsed.examAttempts : [],
        missed: Array.isArray(parsed.missed) ? parsed.missed.filter(function (id) {
          return QUESTIONS.some(function (q) { return q.id === id; });
        }) : [],
        checklist: parsed.checklist && typeof parsed.checklist === "object" ? parsed.checklist : {},
        lastLesson: parsed.lastLesson || null
      };
    } catch (error) {
      return freshProgress();
    }
  }

  function freshProgress() {
    return {
      completedLessons: [],
      quizBest: 0,
      quizAttempts: 0,
      examBest: 0,
      examPassed: false,
      examAttempts: [],
      missed: [],
      checklist: {},
      lastLesson: null
    };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      showToast("Progress could not be saved in this browser.");
    }
  }

  function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const index = Number(target.dataset.index);

    if (action === "nav") {
      showView(target.dataset.view);
    } else if (action === "start-quiz") {
      startQuiz(false);
    } else if (action === "start-missed") {
      startQuiz(true);
    } else if (action === "topic-quiz") {
      startQuiz(false, target.dataset.topic);
    } else if (action === "start-exam") {
      startExam();
    } else if (action === "open-lesson") {
      openLesson(id);
    } else if (action === "toggle-speech") {
      toggleSpeech(target.dataset.context);
    } else if (action === "stop-speech") {
      stopSpeech();
    } else if (action === "mark-complete") {
      toggleLesson(id);
    } else if (action === "next-lesson") {
      openNextLesson(id);
    } else if (action === "answer-quiz") {
      answerQuiz(index);
    } else if (action === "prev-quiz") {
      if (quiz && quiz.index > 0) {
        quiz.index -= 1;
        render();
      }
    } else if (action === "next-quiz") {
      nextQuiz();
    } else if (action === "finish-quiz") {
      finishQuiz();
    } else if (action === "exit-quiz") {
      if (window.confirm("Leave this practice quiz? Your answers on this attempt will be lost.")) {
        quiz = null;
        showView("dashboard");
      }
    } else if (action === "retake-quiz") {
      startQuiz(false);
    } else if (action === "back-dashboard") {
      showView("dashboard");
    } else if (action === "exam-answer") {
      answerExam(index);
    } else if (action === "exam-goto") {
      if (exam) {
        exam.index = index;
        renderPreservingScroll();
      }
    } else if (action === "exam-flag") {
      if (exam) {
        exam.flags[exam.index] = !exam.flags[exam.index];
        renderPreservingScroll();
      }
    } else if (action === "exam-prev") {
      if (exam && exam.index > 0) {
        exam.index -= 1;
        renderPreservingScroll();
      }
    } else if (action === "exam-next") {
      if (exam && exam.index < exam.questions.length - 1) {
        exam.index += 1;
        renderPreservingScroll();
      }
    } else if (action === "submit-exam") {
      submitExam();
    } else if (action === "retake-exam") {
      startExam();
    } else if (action === "toggle-check") {
      toggleCheck(id);
    } else if (action === "reset-progress") {
      resetProgress();
    }
  }

  function handleKeydown(event) {
    if (view === "quiz" && quiz && !quiz.finished) {
      if (event.key >= "1" && event.key <= "4") {
        const optionIndex = Number(event.key) - 1;
        if (optionIndex < quiz.questions[quiz.index].options.length) {
          answerQuiz(optionIndex);
        }
      }
      if (event.key === "ArrowRight" && quiz.revealed[quiz.index]) {
        nextQuiz();
      }
    }

    if (view === "exam" && exam && !exam.submitted) {
      if (event.key >= "1" && event.key <= "4") {
        const optionIndex = Number(event.key) - 1;
        if (optionIndex < exam.questions[exam.index].options.length) {
          answerExam(optionIndex);
        }
      }
      if (event.key === "ArrowRight" && exam.index < exam.questions.length - 1) {
        exam.index += 1;
        renderPreservingScroll();
      }
      if (event.key === "ArrowLeft" && exam.index > 0) {
        exam.index -= 1;
        renderPreservingScroll();
      }
    }
  }

  function showView(nextView) {
    if (nextView === "quiz" && (!quiz || quiz.finished)) {
      startQuiz(false);
      return;
    }
    if (nextView === "exam" && (!exam || exam.submitted)) {
      startExam();
      return;
    }
    if (nextView === "quiz-result" && !lastResult) {
      nextView = "dashboard";
    }
    if (nextView === "exam-result" && !lastResult) {
      nextView = "dashboard";
    }

    view = nextView;
    if (view !== "exam") {
      clearExamTimer();
    }
    render();
  }

  function render(options) {
    const opts = options || {};
    if (view !== "exam") clearExamTimer();
    if (speech.speaking && speech.context !== getSpeechContext()) {
      stopSpeech();
    }

    const navKey = view === "lesson" ? "study" : view === "quiz-result" ? "quiz" : view === "exam-result" ? "exam" : view;
    document.querySelectorAll("[data-nav]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.nav === navKey);
    });

    if (view === "dashboard") app.innerHTML = renderDashboard();
    else if (view === "study") app.innerHTML = renderStudy();
    else if (view === "lesson") app.innerHTML = renderLesson();
    else if (view === "quiz") app.innerHTML = renderQuiz();
    else if (view === "quiz-result") app.innerHTML = renderQuizResult();
    else if (view === "exam") app.innerHTML = renderExam();
    else if (view === "exam-result") app.innerHTML = renderExamResult();
    else if (view === "steps") app.innerHTML = renderSteps();
    else if (view === "resources") app.innerHTML = renderResources();
    else app.innerHTML = renderDashboard();

    if (opts.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
    if (view === "exam" && exam && !exam.submitted) ensureExamTimer();
  }

  function renderPreservingScroll() {
    const y = window.scrollY;
    render({ scroll: false });
    window.scrollTo({ top: y, behavior: "instant" });
  }

  function renderDashboard() {
    const readiness = getReadiness();
    const completed = progress.completedLessons.length;
    const missed = progress.missed.length;
    const next = getNextAction();
    const examLabel = progress.examAttempts.length
      ? Math.max.apply(null, progress.examAttempts.map(function (a) { return a.percent || 0; })) + "%"
      : "—";

    return (
      '<section class="hero">' +
        '<div>' +
          '<div class="eyebrow">Missouri H endorsement · Federal rules</div>' +
          '<h1>Know the load.<br>Pass the test.</h1>' +
          '<p class="lede">A focused study room for the Missouri HAZMAT knowledge test. Learn the rules, drill 100 original questions, and sit a 30-question final that mirrors the state format: 24 correct to pass.</p>' +
          '<div class="hero-meta">' +
            '<span class="chip is-yellow"><strong>30</strong> questions</span>' +
            '<span class="chip"><strong>24</strong> to pass</span>' +
            '<span class="chip"><strong>80%</strong> required</span>' +
            '<span class="chip is-green">Official-source aligned</span>' +
          '</div>' +
          '<div class="hero-actions">' +
            '<button class="button primary" type="button" data-action="' + (next.action === "open-lesson" ? "open-lesson" : next.action) + '"' + (next.id ? ' data-id="' + esc(next.id) + '"' : "") + '>' + esc(next.label) + '</button>' +
            '<button class="button" type="button" data-action="start-quiz">Practice quiz</button>' +
          '</div>' +
        '</div>' +
        '<div class="hero-side">' +
          '<div class="ring" style="--p:' + readiness + '" role="img" aria-label="Study readiness ' + readiness + ' percent">' +
            '<div class="ring-inner"><strong>' + readiness + '%</strong><span>Study readiness</span></div>' +
          '</div>' +
          '<p class="ring-caption">A local estimate from lessons, practice scores, and the final. It is not a prediction of your official result.</p>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><div><div class="eyebrow">Your route</div><h2>The path, in order</h2></div><p>ELDT gates the knowledge test. TSA approval gates issuance — start it early.</p></div>' +
        '<div class="route">' +
          '<div class="route-step"><h3>ELDT theory</h3><p>Complete H theory through a TPR-listed provider. This is the gate before the knowledge test.</p></div>' +
          '<div class="route-step"><h3>TSA assessment</h3><p>Apply, pay, fingerprint — early. Approval is required before H is issued, not before the test.</p></div>' +
          '<div class="route-step"><h3>Missouri test</h3><p>30 questions at a Highway Patrol station. 24 correct is the pass line.</p></div>' +
          '<div class="route-step"><h3>Add the H</h3><p>Take your approval to a license office and complete the CDL transaction.</p></div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="grid cols-4">' +
          '<div class="card metric"><span class="metric-label">Lessons complete</span><span class="metric-value">' + completed + '<span class="muted" style="font-size:18px"> / ' + LESSONS.length + '</span></span><span class="metric-note">' + Math.round((completed / LESSONS.length) * 100) + '% of the study plan</span></div>' +
          '<div class="card metric"><span class="metric-label">Best practice</span><span class="metric-value">' + (progress.quizBest || 0) + '%</span><span class="metric-note">' + progress.quizAttempts + ' attempt' + (progress.quizAttempts === 1 ? "" : "s") + '</span></div>' +
          '<div class="card metric"><span class="metric-label">Final exam best</span><span class="metric-value">' + examLabel + '</span><span class="metric-note">' + (progress.examPassed ? "Pass benchmark cleared" : "24 / 30 needed") + '</span></div>' +
          '<div class="card metric"><span class="metric-label">Missed questions</span><span class="metric-value">' + missed + '</span><span class="metric-note">Saved for review on this device</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="grid cols-2">' +
          '<div class="card">' +
            '<div class="card-head"><div><div class="eyebrow">Next best action</div><h3>' + esc(next.title) + '</h3></div><span class="chip is-yellow">Recommended</span></div>' +
            '<p class="muted" style="font-size:14px">' + esc(next.body) + '</p>' +
            '<button class="button primary" type="button" data-action="' + next.action + '"' + (next.id ? ' data-id="' + esc(next.id) + '"' : "") + '>' + esc(next.label) + '</button>' +
          '</div>' +
          '<div class="card">' +
            '<div class="card-head"><div><div class="eyebrow">The real test</div><h3>30 questions. 24 correct.</h3></div><span class="chip">Missouri</span></div>' +
            '<p class="muted" style="font-size:14px;margin-bottom:14px">The official H test is 30 questions with an 80% passing score. This app uses original practice questions, not leaked or actual exam questions.</p>' +
            '<div class="progress-meta"><span>Exam readiness</span><strong>' + (progress.examPassed ? "Passed practice final" : progress.examBest + "% best") + '</strong></div>' +
            progressBar(progress.examPassed ? 100 : progress.examBest) +
            '<div class="hero-actions"><button class="button" type="button" data-action="start-exam">Take final exam</button><button class="button ghost" type="button" data-action="nav" data-view="steps">See Missouri steps</button></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><div><div class="eyebrow">Test blueprint</div><h2>What the H test covers</h2></div><p>Pulled from 49 CFR 383.121 and Missouri Section 9.</p></div>' +
        '<div class="grid cols-3">' +
          blueprintCard("Hazard classes", "Classes 1–9, divisions, examples, and hazard communication.") +
          blueprintCard("Shipping papers", "Basic descriptions, emergency response info, retention, waste manifest.") +
          blueprintCard("Marks and placards", "Labels, Table 1, Table 2, bulk, inhalation hazards, ID numbers.") +
          blueprintCard("Loading and segregation", "Heaters, no-smoking zones, explosives, corrosives, poisons, Do Not Load.") +
          blueprintCard("Bulk and tanks", "Cargo tanks, portable tanks, attendance, grounding, valves.") +
          blueprintCard("Driving and emergencies", "Parking, routes, tunnels, crossings, ERG, NRC, spills.") +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="callout blue"><strong>Unofficial study tool.</strong> This app is independent. Rules and fees change. Confirm the current process with the Missouri DOR, TSA, and the Missouri CDL Manual before you pay or test. Sources were checked ' + esc(LAST_VERIFIED) + '.</div>' +
        '<div style="margin-top:14px;text-align:right"><button class="button small danger" type="button" data-action="reset-progress">Reset local progress</button></div>' +
      '</section>'
    );
  }

  function blueprintCard(title, body) {
    return '<div class="card tight"><h3>' + esc(title) + '</h3><p class="muted" style="font-size:12px;margin:0">' + esc(body) + '</p></div>';
  }

  function getNextAction() {
    const firstIncomplete = LESSONS.find(function (lesson) {
      return progress.completedLessons.indexOf(lesson.id) === -1;
    });

    if (firstIncomplete) {
      return {
        title: "Continue the study plan",
        body: "Pick up " + firstIncomplete.title + ". Each lesson is short enough to finish in one sitting.",
        label: "Open lesson " + (LESSONS.indexOf(firstIncomplete) + 1),
        action: "open-lesson",
        id: firstIncomplete.id,
        variant: "primary"
      };
    }

    if (progress.quizBest < PASS_PERCENT) {
      return {
        title: "Raise your practice score",
        body: "You have completed the lessons. A 20-question practice quiz gives immediate explanations and saves missed questions for review.",
        label: "Start practice quiz",
        action: "start-quiz",
        variant: "primary"
      };
    }

    if (!progress.examPassed) {
      return {
        title: "Sit the 30-question final",
        body: "You have the lessons and a solid practice score. Take the final under exam conditions: no feedback until you submit, 24 of 30 to pass.",
        label: "Take final exam",
        action: "start-exam",
        variant: "primary"
      };
    }

    if (progress.missed.length) {
      return {
        title: "Review what you missed",
        body: "You have cleared the final benchmark. Spend one short session on the questions still flagged in your missed list.",
        label: "Review missed questions",
        action: "start-missed",
        variant: "primary"
      };
    }

    return {
      title: "Stay sharp",
      body: "You have completed the study plan and cleared the final. Retake a practice quiz or the final to keep the details fresh before test day.",
      label: "Retake final exam",
      action: "start-exam",
      variant: "primary"
    };
  }

  function getReadiness() {
    const lessonScore = (progress.completedLessons.length / LESSONS.length) * 40;
    const quizScore = Math.min(progress.quizBest / PASS_PERCENT, 1) * 25;
    const examScore = progress.examPassed ? 35 : Math.min(progress.examBest / PASS_PERCENT, 1) * 35;
    return Math.max(0, Math.min(100, Math.round(lessonScore + quizScore + examScore)));
  }

  function renderStudy() {
    const completed = progress.completedLessons.length;
    const pct = Math.round((completed / LESSONS.length) * 100);
    const missed = progress.missed.length;

    return (
      '<section class="section" style="margin-top:0">' +
        '<div class="eyebrow">Study plan</div>' +
        '<h1 style="font-size:clamp(34px,5vw,56px)">Build the map before the drill.</h1>' +
        '<p class="lede">Ten short lessons, in the order the test thinks. Finish them once, then use the practice quiz and missed-question review to sharpen the details.</p>' +
        '<div class="grid cols-3" style="margin-top:24px">' +
          '<div class="card"><div class="progress-meta"><span>Lessons complete</span><strong>' + completed + ' / ' + LESSONS.length + '</strong></div>' + progressBar(pct) + '</div>' +
          '<div class="card"><div class="progress-meta"><span>Study readiness</span><strong>' + getReadiness() + '%</strong></div>' + progressBar(getReadiness()) + '</div>' +
          '<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div class="metric-label">Saved review</div><div style="font-size:14px;font-weight:700;margin-top:4px">' + missed + ' missed question' + (missed === 1 ? "" : "s") + '</div></div><button class="button small" type="button" data-action="start-missed" ' + (missed ? "" : "disabled") + '>Review</button></div>' +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><div><h2>The ten lessons</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button small" type="button" data-action="start-quiz">Practice all topics</button></div></div>' +
        '<div class="lesson-list">' +
          LESSONS.map(function (lesson, index) {
            const done = progress.completedLessons.indexOf(lesson.id) !== -1;
            return '<button class="lesson-card ' + (done ? "is-done" : "") + '" type="button" data-action="open-lesson" data-id="' + esc(lesson.id) + '">' +
              '<span class="lesson-number">' + (done ? "✓" : String(index + 1).padStart(2, "0")) + '</span>' +
              '<span class="lesson-copy"><h3>' + esc(lesson.title) + '</h3><p>' + esc(lesson.summary) + '</p></span>' +
              '<span class="lesson-tail"><span class="status-dot ' + (done ? "done" : "") + '"></span>' + lesson.minutes + ' min</span>' +
            '</button>';
          }).join("") +
        '</div>' +
      '</section>' +

      '<section class="section"><div class="callout"><strong>How to use this plan:</strong> read one lesson, close it, then answer the topic quiz. The practice quiz explains every answer immediately. The final exam withholds feedback until you submit, so it feels closer to the real thing.</div></section>'
    );
  }

  function openLesson(id) {
    const lesson = LESSONS.find(function (item) { return item.id === id; });
    if (!lesson) return;
    currentLesson = lesson.id;
    progress.lastLesson = lesson.id;
    saveProgress();
    view = "lesson";
    render();
  }

  function openNextLesson(id) {
    const index = LESSONS.findIndex(function (lesson) { return lesson.id === id; });
    if (index === -1) return;
    const next = LESSONS[index + 1];
    if (next) openLesson(next.id);
    else showView("study");
  }

  function toggleLesson(id) {
    const index = progress.completedLessons.indexOf(id);
    if (index === -1) {
      progress.completedLessons.push(id);
      showToast("Lesson marked complete.");
    } else {
      progress.completedLessons.splice(index, 1);
      showToast("Lesson marked incomplete.");
    }
    saveProgress();
    render();
  }

  function renderLesson() {
    const lesson = LESSONS.find(function (item) { return item.id === currentLesson; });
    if (!lesson) return renderStudy();

    const index = LESSONS.indexOf(lesson);
    const isDone = progress.completedLessons.indexOf(lesson.id) !== -1;
    const topic = TOPICS[lesson.topic] || { name: lesson.topic, short: "" };

    return (
      '<div class="breadcrumb"><button type="button" data-action="nav" data-view="study">Study plan</button><span>/</span><span>Lesson ' + (index + 1) + '</span></div>' +
      '<section class="lesson-hero">' +
        '<div><div class="eyebrow">' + esc(topic.name) + '</div><h1>' + esc(lesson.title) + '</h1><p>' + esc(lesson.summary) + '</p></div>' +
        '<div class="lesson-hero-side"><span class="chip">' + lesson.minutes + ' min</span><span class="chip ' + (isDone ? "is-green" : "is-yellow") + '">' + (isDone ? "Complete" : "Not complete") + '</span>' + speechControls("lesson:" + lesson.id) + '</div>' +
      '</section>' +
      '<div class="lesson-layout">' +
        '<article class="lesson-body">' +
          lesson.sections.map(function (section) {
            return renderSection(section);
          }).join("") +
          (lesson.table ? renderDataTable(lesson.table) : "") +
          '<div class="lesson-actions">' +
            '<button class="button ' + (isDone ? "" : "primary") + '" type="button" data-action="mark-complete" data-id="' + esc(lesson.id) + '">' + (isDone ? "Mark incomplete" : "Mark complete") + '</button>' +
            '<button class="button" type="button" data-action="topic-quiz" data-topic="' + esc(lesson.topic) + '">Practice this topic</button>' +
            '<button class="button ghost" type="button" data-action="next-lesson" data-id="' + esc(lesson.id) + '">' + (index === LESSONS.length - 1 ? "Back to study plan" : "Next lesson") + '</button>' +
          '</div>' +
        '</article>' +
        '<aside class="lesson-aside">' +
          '<div class="key-facts"><h3>Key facts</h3><ul>' + lesson.keyFacts.map(function (fact) { return "<li>" + esc(fact) + "</li>"; }).join("") + '</ul></div>' +
          '<div class="card flat tight"><div class="metric-label" style="margin-bottom:8px">Official sources</div><div class="source-list">' + lesson.sources.map(function (source) {
            return '<a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.label) + ' ↗</a>';
          }).join("") + '</div></div>' +
        '</aside>' +
      '</div>'
    );
  }

  function renderSection(section) {
    return (
      '<section>' +
        (section.h ? "<h2>" + esc(section.h) + "</h2>" : "") +
        (section.p ? section.p.map(function (paragraph) { return "<p>" + esc(paragraph) + "</p>"; }).join("") : "") +
        (section.bullets ? "<ul>" + section.bullets.map(function (bullet) { return "<li>" + esc(bullet) + "</li>"; }).join("") + "</ul>" : "") +
        (section.note ? '<div class="callout"><strong>Test trap:</strong> ' + esc(section.note) + '</div>' : "") +
        (section.table ? renderDataTable(section.table) : "") +
      '</section>'
    );
  }

  function renderDataTable(table) {
    return (
      '<div class="data-table-wrap"><table class="data-table"><thead><tr>' +
        table.headers.map(function (header) { return "<th>" + esc(header) + "</th>"; }).join("") +
      '</tr></thead><tbody>' +
        table.rows.map(function (row) {
          return "<tr>" + row.map(function (cell) { return "<td>" + esc(cell) + "</td>"; }).join("") + "</tr>";
        }).join("") +
      '</tbody></table></div>' +
      (table.caption ? '<p class="small muted" style="margin-top:-10px">' + esc(table.caption) + '</p>' : "")
    );
  }

  function startQuiz(missedOnly, topicId) {
    let pool = QUESTIONS.slice();

    if (missedOnly) {
      const missed = new Set(progress.missed);
      pool = pool.filter(function (q) { return missed.has(q.id); });
      if (!pool.length) {
        showToast("There are no missed questions yet. Take a practice quiz first.");
        return;
      }
    }

    if (topicId) {
      pool = pool.filter(function (q) { return q.topic === topicId; });
    }

    const count = topicId ? Math.min(10, pool.length) : Math.min(QUIZ_LENGTH, pool.length);
    const questions = shuffle(pool).slice(0, count);
    if (!questions.length) return;

    quiz = {
      questions: questions,
      answers: new Array(questions.length).fill(null),
      revealed: new Array(questions.length).fill(false),
      index: 0,
      finished: false,
      mode: missedOnly ? "missed" : topicId ? "topic" : "practice",
      topicId: topicId || null,
      label: missedOnly ? "Missed question review" : topicId ? (TOPICS[topicId] ? TOPICS[topicId].name : "Topic drill") : "Practice quiz"
    };
    view = "quiz";
    render();
  }

  function answerQuiz(optionIndex) {
    if (!quiz || quiz.finished) return;
    if (quiz.answers[quiz.index] !== null) return;

    quiz.answers[quiz.index] = optionIndex;
    quiz.revealed[quiz.index] = true;

    const q = quiz.questions[quiz.index];
    if (optionIndex === q.answer) {
      progress.missed = progress.missed.filter(function (id) { return id !== q.id; });
    } else if (progress.missed.indexOf(q.id) === -1) {
      progress.missed.push(q.id);
    }
    saveProgress();
    renderPreservingScroll();
  }

  function nextQuiz() {
    if (!quiz) return;
    if (quiz.index < quiz.questions.length - 1) {
      quiz.index += 1;
      renderPreservingScroll();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    if (!quiz) return;
    const total = quiz.questions.length;
    const score = quiz.questions.reduce(function (sum, question, index) {
      return sum + (quiz.answers[index] === question.answer ? 1 : 0);
    }, 0);
    const percent = Math.round((score / total) * 100);

    progress.quizBest = Math.max(progress.quizBest, percent);
    progress.quizAttempts += 1;
    progress.missed = Array.from(new Set(progress.missed)).filter(function (id) {
      return QUESTIONS.some(function (q) { return q.id === id; });
    });
    saveProgress();

    quiz.finished = true;
    lastResult = {
      type: "quiz",
      questions: quiz.questions,
      answers: quiz.answers,
      score: score,
      total: total,
      percent: percent,
      passed: percent >= PASS_PERCENT,
      label: quiz.label,
      mode: quiz.mode
    };
    view = "quiz-result";
    render();
  }

  function renderQuiz() {
    if (!quiz) return renderDashboard();
    const q = quiz.questions[quiz.index];
    const selected = quiz.answers[quiz.index];
    const revealed = quiz.revealed[quiz.index];
    const topic = TOPICS[q.topic] || { name: q.topic };
    const progressPercent = Math.round(((quiz.index + (revealed ? 1 : 0)) / quiz.questions.length) * 100);

    return (
      '<div class="quiz-shell">' +
        '<div class="quiz-topline"><div><div class="eyebrow">' + esc(quiz.label) + '</div><h1>' + (quiz.mode === "missed" ? "Review the misses." : quiz.mode === "topic" ? "Drill the topic." : "Practice with feedback.") + '</h1></div><button class="button small ghost" type="button" data-action="exit-quiz">Exit</button></div>' +
        '<div class="quiz-meta"><span class="chip is-yellow">Question ' + (quiz.index + 1) + ' of ' + quiz.questions.length + '</span><span class="chip">' + esc(topic.name) + '</span><span class="chip">' + progressPercent + '%</span></div>' +
        '<div class="progress-track" style="margin-bottom:18px"><div class="progress-fill" style="width:' + progressPercent + '%"></div></div>' +
        '<div class="quiz-card">' +
          '<div class="question-kicker"><span>' + esc(topic.name) + '</span><div class="question-kicker-tools">' + speechControls("quiz:" + q.id) + '<span>' + (revealed ? (selected === q.answer ? "Correct" : "Review the answer") : "Select one") + '</span></div></div>' +
          '<h2 class="question-text">' + esc(q.q) + '</h2>' +
          '<div class="options">' +
            q.options.map(function (option, index) {
              let cls = "option";
              if (revealed) {
                cls += " is-disabled";
                if (index === q.answer) cls += " is-correct";
                if (index === selected && index !== q.answer) cls += " is-wrong";
              } else if (index === selected) {
                cls += " is-selected";
              }
              return '<button class="' + cls + '" type="button" data-action="answer-quiz" data-index="' + index + '"' + (revealed ? " disabled" : "") + '>' +
                '<span class="option-letter">' + LETTERS[index] + '</span><span>' + esc(option) + '</span></button>';
            }).join("") +
          '</div>' +
          (revealed ? renderFeedback(q, selected) : "") +
          '<div class="quiz-footer">' +
            '<button class="button ghost" type="button" data-action="prev-quiz" ' + (quiz.index === 0 ? "disabled" : "") + '>Previous</button>' +
            '<div class="right">' +
              (revealed
                ? '<button class="button primary" type="button" data-action="' + (quiz.index === quiz.questions.length - 1 ? "finish-quiz" : "next-quiz") + '">' + (quiz.index === quiz.questions.length - 1 ? "See results" : "Next question") + '</button>'
                : '<span class="kbd-hint">Press <kbd>1</kbd>–<kbd>4</kbd> to answer</span>') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<p class="small muted" style="margin-top:14px">Questions are original practice items based on the Missouri CDL Manual and federal HAZMAT rules. They are not actual exam questions.</p>' +
      '</div>'
    );
  }

  function renderFeedback(q, selected) {
    const correct = selected === q.answer;
    return (
      '<div class="feedback ' + (correct ? "good" : "bad") + '">' +
        '<strong>' + (correct ? "Correct." : "Not quite.") + '</strong>' +
        '<div>' + esc(q.explain) + '</div>' +
        (!correct ? '<div class="source-line" style="margin-top:8px;color:var(--text)">Correct answer: ' + LETTERS[q.answer] + '. ' + esc(q.options[q.answer]) + '</div>' : "") +
        '<div class="source-line">Source: ' + esc(q.source) + '</div>' +
      '</div>'
    );
  }

  function renderQuizResult() {
    if (!lastResult) return renderDashboard();
    const result = lastResult;
    const missed = result.questions.filter(function (q, index) { return result.answers[index] !== q.answer; }).length;

    return (
      '<section class="result-hero ' + (result.passed ? "" : "fail") + '">' +
        '<div class="result-score" style="--p:' + result.percent + ';--ring-color:' + (result.passed ? "var(--green)" : "var(--orange)") + '"><div><strong>' + result.percent + '%</strong><span>' + result.score + ' / ' + result.total + '</span></div></div>' +
        '<div>' +
          '<div class="eyebrow">' + esc(result.label || "Practice result") + '</div>' +
          '<h1>' + (result.passed ? "Above the line." : "Close the gaps.") + '</h1>' +
          '<p class="muted">You answered ' + result.score + ' of ' + result.total + ' correctly. The practice benchmark is 80%. The official Missouri test is 30 questions, and 24 correct is passing.</p>' +
          '<div class="result-actions">' +
            '<button class="button primary" type="button" data-action="retake-quiz">Practice again</button>' +
            (missed ? '<button class="button" type="button" data-action="start-missed">Review ' + missed + ' missed</button>' : "") +
            '<button class="button ghost" type="button" data-action="back-dashboard">Dashboard</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="section"><div class="grid cols-2">' +
        '<div class="card"><div class="eyebrow">By topic</div>' + topicBreakdown(result) + '</div>' +
        '<div class="card"><div class="eyebrow">What next</div><p class="muted" style="font-size:14px">' + (result.passed ? "You are above the practice line. Keep the missed questions in rotation, then take the 30-question final." : "Read the explanation for every miss, then run the missed-question review. Do not just memorize the letter.") + '</p><button class="button" type="button" data-action="nav" data-view="study">Back to lessons</button></div>' +
      '</div></section>' +
      '<section class="section"><div class="section-head"><div><h2>Review answers</h2></div><p>' + missed + ' miss' + (missed === 1 ? "" : "es") + ' open by default</p></div>' + reviewList(result) + '</section>'
    );
  }

  function startExam() {
    const questions = shuffle(QUESTIONS).slice(0, Math.min(EXAM_LENGTH, QUESTIONS.length));
    exam = {
      questions: questions,
      answers: new Array(questions.length).fill(null),
      flags: new Array(questions.length).fill(false),
      index: 0,
      startedAt: Date.now(),
      submitted: false
    };
    lastResult = null;
    view = "exam";
    render();
  }

  function answerExam(optionIndex) {
    if (!exam || exam.submitted) return;
    exam.answers[exam.index] = optionIndex;
    renderPreservingScroll();
  }

  function submitExam() {
    if (!exam || exam.submitted) return;
    const unanswered = exam.answers.filter(function (answer) { return answer === null; }).length;
    if (unanswered && !window.confirm("You have " + unanswered + " unanswered question" + (unanswered === 1 ? "" : "s") + ". Submit anyway?")) {
      return;
    }
    finishExam();
  }

  function finishExam() {
    if (!exam) return;
    clearExamTimer();
    const total = exam.questions.length;
    const score = exam.questions.reduce(function (sum, question, index) {
      return sum + (exam.answers[index] === question.answer ? 1 : 0);
    }, 0);
    const percent = Math.round((score / total) * 100);
    const passCount = Math.ceil(total * 0.8);
    const passed = score >= passCount;
    const seconds = Math.max(1, Math.floor((Date.now() - exam.startedAt) / 1000));

    progress.examBest = Math.max(progress.examBest, percent);
    progress.examPassed = progress.examPassed || passed;
    progress.examAttempts.unshift({
      date: new Date().toISOString(),
      score: score,
      total: total,
      percent: percent,
      passed: passed,
      seconds: seconds
    });
    progress.examAttempts = progress.examAttempts.slice(0, 20);

    exam.questions.forEach(function (q, index) {
      if (exam.answers[index] === q.answer) {
        progress.missed = progress.missed.filter(function (id) { return id !== q.id; });
      } else if (progress.missed.indexOf(q.id) === -1) {
        progress.missed.push(q.id);
      }
    });
    saveProgress();

    lastResult = {
      type: "exam",
      questions: exam.questions,
      answers: exam.answers,
      score: score,
      total: total,
      percent: percent,
      passed: passed,
      passCount: passCount,
      seconds: seconds,
      date: new Date().toISOString()
    };
    exam.submitted = true;
    view = "exam-result";
    render();
  }

  function renderExam() {
    if (!exam) return renderDashboard();
    if (exam.submitted) return renderExamResult();
    const q = exam.questions[exam.index];
    const selected = exam.answers[exam.index];
    const topic = TOPICS[q.topic] || { name: q.topic };
    const answered = exam.answers.filter(function (answer) { return answer !== null; }).length;
    const percent = Math.round(((exam.index + 1) / exam.questions.length) * 100);

    return (
      '<div class="quiz-topline"><div><div class="eyebrow">Final exam · 30 questions</div><h1>No feedback until submit.</h1></div><span class="chip is-yellow">24 / 30 to pass</span></div>' +
      '<div class="exam-clock"><span>Elapsed time</span><strong id="exam-clock">0:00</strong><span>Timer is for pace, not a limit</span></div>' +
      '<div class="exam-layout">' +
        '<div class="exam-main">' +
          '<div class="quiz-meta"><span class="chip is-yellow">Question ' + (exam.index + 1) + ' of ' + exam.questions.length + '</span><span class="chip">' + esc(topic.name) + '</span><span class="chip">' + answered + ' answered</span></div>' +
          '<div class="progress-track" style="margin-bottom:18px"><div class="progress-fill" style="width:' + percent + '%"></div></div>' +
          '<div class="quiz-card">' +
            '<div class="question-kicker"><span>' + esc(topic.name) + '</span><div class="question-kicker-tools">' + speechControls("exam:" + q.id) + '<button class="button small ghost" type="button" data-action="exam-flag" aria-pressed="' + (exam.flags[exam.index] ? "true" : "false") + '">' + (exam.flags[exam.index] ? "Flagged" : "Flag for review") + '</button></div></div>' +
            '<h2 class="question-text">' + esc(q.q) + '</h2>' +
            '<div class="options">' +
              q.options.map(function (option, index) {
                return '<button class="option ' + (selected === index ? "is-selected" : "") + '" type="button" data-action="exam-answer" data-index="' + index + '">' +
                  '<span class="option-letter">' + LETTERS[index] + '</span><span>' + esc(option) + '</span></button>';
              }).join("") +
            '</div>' +
            '<div class="quiz-footer">' +
              '<button class="button ghost" type="button" data-action="exam-prev" ' + (exam.index === 0 ? "disabled" : "") + '>Previous</button>' +
              '<div class="right">' +
                '<button class="button" type="button" data-action="exam-next" ' + (exam.index === exam.questions.length - 1 ? "disabled" : "") + '>Next</button>' +
                '<button class="button primary" type="button" data-action="submit-exam">Submit exam</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<aside class="exam-side">' +
          '<div class="exam-side-card"><h3>Question navigator</h3><div class="question-nav">' +
            exam.questions.map(function (question, index) {
              let cls = "qnav";
              if (exam.answers[index] !== null) cls += " is-answered";
              if (exam.flags[index]) cls += " is-flagged";
              if (index === exam.index) cls += " is-current";
              return '<button class="' + cls + '" type="button" data-action="exam-goto" data-index="' + index + '" aria-label="Question ' + (index + 1) + (exam.flags[index] ? ", flagged" : "") + '">' + (index + 1) + '</button>';
            }).join("") +
          '</div>' +
          '<div class="legend"><span><i style="background:var(--yellow)"></i> answered</span><span><i style="background:var(--red);border-radius:50%"></i> flagged</span></div>' +
          '</div>' +
          '<div class="exam-side-card"><h3>Exam rules</h3><p class="small muted" style="margin:0">30 questions. 24 correct to pass. You can go back, flag questions, and change answers before submitting.</p></div>' +
          '<button class="button primary" type="button" data-action="submit-exam">Submit exam</button>' +
        '</aside>' +
      '</div>'
    );
  }

  function renderExamResult() {
    if (!lastResult || lastResult.type !== "exam") return renderDashboard();
    const result = lastResult;
    const missed = result.questions.filter(function (q, index) { return result.answers[index] !== q.answer; }).length;

    return (
      '<section class="result-hero ' + (result.passed ? "" : "fail") + '">' +
        '<div class="result-score" style="--p:' + result.percent + ';--ring-color:' + (result.passed ? "var(--green)" : "var(--orange)") + '"><div><strong>' + result.percent + '%</strong><span>' + result.score + ' / ' + result.total + '</span></div></div>' +
        '<div>' +
          '<div class="eyebrow">Final exam result · ' + esc(formatDate(result.date)) + '</div>' +
          '<h1>' + (result.passed ? "You cleared the benchmark." : "You need 24 of 30.") + '</h1>' +
          '<p class="muted">You answered ' + result.score + ' of ' + result.total + ' correctly. Passing is ' + result.passCount + ' of ' + result.total + ' (80%). Time: ' + formatTime(result.seconds) + '.</p>' +
          '<div class="result-actions">' +
            (result.passed ? '<span class="chip is-green">Practice pass</span>' : '<span class="chip is-red">Below 80%</span>') +
            '<button class="button primary" type="button" data-action="retake-exam">Retake final</button>' +
            (missed ? '<button class="button" type="button" data-action="start-missed">Review missed</button>' : "") +
            '<button class="button ghost" type="button" data-action="back-dashboard">Dashboard</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="section"><div class="grid cols-2">' +
        '<div class="card"><div class="eyebrow">By topic</div>' + topicBreakdown(result) + '</div>' +
        '<div class="card"><div class="eyebrow">Recent attempts</div>' + renderExamHistory() + '</div>' +
      '</div></section>' +
      '<section class="section"><div class="callout ' + (result.passed ? "" : "red") + '"><strong>' + (result.passed ? "This is a practice pass, not a license." : "This is a practice result, not the official test.") + '</strong> The official Missouri H test is 30 questions with a 24/30 pass line. Confirm your ELDT is on file before test day, and start TSA early — approval is required before H is issued.</div></section>' +
      '<section class="section"><div class="section-head"><div><h2>Review answers</h2></div><p>' + missed + ' miss' + (missed === 1 ? "" : "es") + ' open by default</p></div>' + reviewList(result) + '</section>'
    );
  }

  function renderExamHistory() {
    if (!progress.examAttempts.length) {
      return '<p class="muted" style="font-size:13px">No final attempts yet. The first one sets the baseline.</p>';
    }
    return '<div class="stack" style="gap:8px">' + progress.examAttempts.slice(0, 6).map(function (attempt) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)">' +
        '<div><div style="font-size:12px">' + esc(formatDate(attempt.date)) + '</div><div class="small muted">' + formatTime(attempt.seconds || 0) + '</div></div>' +
        '<span class="chip ' + (attempt.passed ? "is-green" : "") + '">' + attempt.score + '/' + attempt.total + ' · ' + attempt.percent + '%</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  function renderSteps() {
    const checked = STEPS.filter(function (step) { return progress.checklist[step.id]; }).length;
    const pct = Math.round((checked / STEPS.length) * 100);

    return (
      '<section class="section" style="margin-top:0">' +
        '<div class="eyebrow">Missouri process</div>' +
        '<h1 style="font-size:clamp(34px,5vw,56px)">The paperwork path, gate by gate.</h1>' +
        '<p class="lede">Eligibility and ELDT come before the 30-question exam. TSA runs alongside your study: start it early, because approval is required before H is issued, not before you test. Check items off as you complete them.</p>' +
        '<div class="card" style="margin-top:22px"><div class="progress-meta"><span>Checklist progress</span><strong>' + checked + ' / ' + STEPS.length + '</strong></div>' + progressBar(pct) + '</div>' +
      '</section>' +
      '<section class="section"><div class="checklist">' +
        STEPS.map(function (step) {
          const isChecked = Boolean(progress.checklist[step.id]);
          return '<div class="check-item">' +
            '<button class="check-toggle ' + (isChecked ? "is-checked" : "") + '" type="button" data-action="toggle-check" data-id="' + esc(step.id) + '" aria-label="' + (isChecked ? "Mark incomplete" : "Mark complete") + ': ' + esc(step.title) + '" aria-pressed="' + (isChecked ? "true" : "false") + '">✓</button>' +
            '<div class="check-copy"><h3>' + esc(step.title) + '</h3><p>' + esc(step.desc) + '</p><div class="check-meta">' + step.meta.map(function (tag) { return '<span class="chip">' + esc(tag) + '</span>'; }).join("") + '</div></div>' +
            '<a class="check-link" href="' + esc(step.link) + '" target="_blank" rel="noopener noreferrer">' + esc(step.linkLabel) + ' ↗</a>' +
          '</div>';
        }).join("") +
      '</div></section>' +
      '<section class="section"><div class="grid cols-2">' +
        '<div class="card"><div class="eyebrow">Fees at a glance</div>' +
          '<div class="data-table-wrap"><table class="data-table fees-table"><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>' +
            '<tr><td>TSA HME threat assessment</td><td>$88.25 standard; $41 reduced with TWIC comparability (Nov. 2026)</td></tr>' +
            '<tr><td>Missouri CDL written test</td><td>$25</td></tr>' +
            '<tr><td>Missouri CDL transaction</td><td>$20 for 3 years or less; $40 for 3 years + 1 day up to 6 years</td></tr>' +
            '<tr><td>License-office processing</td><td>$9 for 3 years or less; $18 for longer terms</td></tr>' +
          '</tbody></table></div>' +
          '<p class="small muted">Fees can change and endorsement transactions can vary. Confirm the total with the license office before you pay.</p>' +
        '</div>' +
        '<div class="card"><div class="eyebrow">Bring to the license office</div><ul class="muted" style="font-size:13px;padding-left:18px">' +
          '<li>Your Missouri CDL and required identity/residency documents.</li>' +
          '<li>Proof of U.S. citizenship or lawful permanent resident status.</li>' +
          '<li>TSA approval / final notice of threat assessment.</li>' +
          '<li>ELDT completion confirmation, if this is your first H.</li>' +
          '<li>Payment for the CDL transaction and processing fees.</li>' +
        '</ul><p class="small muted">The DOR page lists acceptable citizenship documents. Check it before you go.</p></div>' +
      '</div></section>' +
      '<section class="section"><div class="callout"><strong>Start TSA early.</strong> TSA recommends enrolling at least 60 days before you need the endorsement, and some assessments take more than 45 days. ELDT is the gate before the knowledge test; TSA approval is the gate before H is issued. You can study and test while the assessment is pending — Missouri may issue a temporary CDL without H in the meantime.</div></section>' +
      '<section class="section"><div class="callout blue"><strong>H vs. X:</strong> H covers hazardous materials. X combines H with N (tank vehicle). If you haul hazardous materials in cargo tanks, ask the license office which endorsement combination you need.</div></section>'
    );
  }

  function renderResources() {
    return (
      '<section class="section" style="margin-top:0">' +
        '<div class="eyebrow">Sources</div>' +
        '<h1 style="font-size:clamp(34px,5vw,56px)">Go to the source.</h1>' +
        '<p class="lede">This app is a study aid. The official manuals, rules, and agency pages are the authority. Open them in a new tab and verify anything that affects money, eligibility, or test day.</p>' +
        '<div class="callout" style="margin-top:20px"><strong>Checked ' + esc(LAST_VERIFIED) + '.</strong> Content is aligned to the Missouri CDL Manual, 12 CSR 10-24.300, 49 CFR 383.121, TSA HME guidance, and FMCSA ELDT rules. Rules and fees can change without notice.</div>' +
      '</section>' +
      SOURCES.map(function (group) {
        return '<section class="section"><div class="section-head"><div><h2>' + esc(group.group) + '</h2></div><p>' + group.items.length + ' official links</p></div><div class="resource-group">' +
          group.items.map(function (item) {
            return '<a class="resource-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"><span class="resource-icon">↗</span><span><strong>' + esc(item.label) + '</strong><small>' + esc(item.note) + '</small></span><span class="arrow">OPEN</span></a>';
          }).join("") +
        '</div></section>';
      }).join("") +
      '<section class="section"><div class="grid cols-2">' +
        '<div class="card"><div class="eyebrow">What this app is</div><p class="muted" style="font-size:13px">An independent study tool with original practice questions. It is not affiliated with FMCSA, TSA, Missouri DOR, or the Missouri State Highway Patrol. It does not issue a certificate or guarantee a passing score.</p></div>' +
        '<div class="card"><div class="eyebrow">What it is not</div><p class="muted" style="font-size:13px">It is not the official Missouri CDL Manual, not legal advice, and not a substitute for your employer’s HAZMAT training. Always follow the current federal and Missouri rules.</p></div>' +
      '</div></section>'
    );
  }

  function topicBreakdown(result) {
    const map = {};
    result.questions.forEach(function (q, index) {
      if (!map[q.topic]) map[q.topic] = { correct: 0, total: 0 };
      map[q.topic].total += 1;
      if (result.answers[index] === q.answer) map[q.topic].correct += 1;
    });

    return '<div class="topic-breakdown">' + Object.keys(map).sort(function (a, b) {
      return (TOPICS[a] ? TOPICS[a].name : a).localeCompare(TOPICS[b] ? TOPICS[b].name : b);
    }).map(function (topicId) {
      const row = map[topicId];
      const pct = Math.round((row.correct / row.total) * 100);
      return '<div class="topic-row"><span>' + esc(TOPICS[topicId] ? TOPICS[topicId].name : topicId) + '</span><div class="topic-bar"><i style="width:' + pct + '%;background:' + (pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)") + '"></i></div><strong>' + row.correct + '/' + row.total + '</strong></div>';
    }).join("") + '</div>';
  }

  function reviewList(result) {
    return '<div class="review-list">' + result.questions.map(function (q, index) {
      const user = result.answers[index];
      const correct = user === q.answer;
      return '<details class="review-item" ' + (correct ? "" : "open") + '>' +
        '<summary><span class="topic-tag">' + esc(TOPICS[q.topic] ? TOPICS[q.topic].name : q.topic) + '</span><span>' + esc(q.q) + '</span></summary>' +
        '<div class="review-body">' +
          '<p class="answer-line"><strong>Your answer:</strong> ' + (user === null || user === undefined ? "No answer" : LETTERS[user] + ". " + esc(q.options[user])) + '</p>' +
          '<p class="answer-line"><strong>Correct answer:</strong> ' + LETTERS[q.answer] + ". " + esc(q.options[q.answer]) + '</p>' +
          '<p class="why">' + esc(q.explain) + '</p>' +
          '<p class="source-line">Source: ' + esc(q.source) + '</p>' +
        '</div>' +
      '</details>';
    }).join("") + '</div>';
  }

  function toggleCheck(id) {
    progress.checklist[id] = !progress.checklist[id];
    saveProgress();
    render();
  }

  function resetProgress() {
    if (!window.confirm("Reset all local progress on this device? This clears completed lessons, quiz scores, exam attempts, missed questions, and the checklist.")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors; the in-memory reset still applies.
    }
    progress = freshProgress();
    quiz = null;
    exam = null;
    lastResult = null;
    clearExamTimer();
    showView("dashboard");
    showToast("Local progress reset.");
  }

  function ensureExamTimer() {
    if (examTimer) return;
    examTimer = setInterval(updateExamClock, 1000);
    updateExamClock();
  }

  function clearExamTimer() {
    if (examTimer) {
      clearInterval(examTimer);
      examTimer = null;
    }
  }

  function updateExamClock() {
    const el = document.getElementById("exam-clock");
    if (!el || !exam || exam.submitted) return;
    const seconds = Math.max(0, Math.floor((Date.now() - exam.startedAt) / 1000));
    el.textContent = formatTime(seconds);
  }

  function getSpeechContext() {
    if (view === "lesson" && currentLesson) return "lesson:" + currentLesson;
    if (view === "quiz" && quiz && !quiz.finished) {
      const q = quiz.questions[quiz.index];
      return q ? "quiz:" + q.id : null;
    }
    if (view === "exam" && exam && !exam.submitted) {
      const q = exam.questions[exam.index];
      return q ? "exam:" + q.id : null;
    }
    return null;
  }

  function speechControls(context) {
    if (!speechSupported) return "";
    const active = speech.speaking && speech.context === context;
    return '<div class="speech-controls" data-speech-controls="' + esc(context) + '">' +
      '<button class="button small" type="button" data-action="toggle-speech" data-context="' + esc(context) + '">' + (active ? (speech.paused ? "Resume" : "Pause") : "Read aloud") + '</button>' +
      '<button class="button small ghost" type="button" data-action="stop-speech"' + (active ? "" : " hidden") + '>Stop</button>' +
    '</div>';
  }

  function toggleSpeech(context) {
    if (!speechSupported) {
      showToast("Read aloud is not supported in this browser.");
      return;
    }

    if (speech.speaking && speech.context === context) {
      if (speech.paused) {
        window.speechSynthesis.resume();
        speech.paused = false;
      } else {
        window.speechSynthesis.pause();
        speech.paused = true;
      }
      updateSpeechButtons();
      return;
    }

    const text = speechTextFor(context);
    if (text) startSpeech(text, context);
  }

  function startSpeech(text, context) {
    const chunks = chunkForSpeech(text);
    if (!chunks.length) return;

    stopSpeech();
    const token = speech.token + 1;
    speech.token = token;
    speech.queue = chunks;
    speech.index = 0;
    speech.speaking = true;
    speech.paused = false;
    speech.context = context;
    updateSpeechButtons();

    // Chrome can drop an utterance queued in the same tick as cancel().
    window.setTimeout(function () {
      if (token === speech.token) speakChunk(token);
    }, 60);
  }

  function speakChunk(token) {
    if (token !== speech.token || !speech.speaking) return;
    if (speech.index >= speech.queue.length) {
      finishSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speech.queue[speech.index]);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    const voice = pickSpeechVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = function () {
      if (token !== speech.token || !speech.speaking) return;
      speech.index += 1;
      speakChunk(token);
    };

    utterance.onerror = function (event) {
      if (token !== speech.token) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      finishSpeech();
      showToast("Read aloud could not start. Try another browser voice.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    speech.token += 1;
    speech.queue = [];
    speech.index = 0;
    speech.speaking = false;
    speech.paused = false;
    speech.context = null;
    if (speechSupported) window.speechSynthesis.cancel();
    updateSpeechButtons();
  }

  function finishSpeech() {
    speech.token += 1;
    speech.queue = [];
    speech.index = 0;
    speech.speaking = false;
    speech.paused = false;
    speech.context = null;
    updateSpeechButtons();
  }

  function updateSpeechButtons() {
    document.querySelectorAll("[data-speech-controls]").forEach(function (container) {
      const active = speech.speaking && speech.context === container.dataset.speechControls;
      const toggle = container.querySelector('[data-action="toggle-speech"]');
      const stop = container.querySelector('[data-action="stop-speech"]');
      if (toggle) toggle.textContent = active ? (speech.paused ? "Resume" : "Pause") : "Read aloud";
      if (stop) stop.hidden = !active;
    });

    const dock = document.getElementById("speech-dock");
    if (!dock) return;
    dock.hidden = !speech.speaking;
    const status = document.getElementById("speech-dock-status");
    const toggle = document.getElementById("speech-dock-toggle");
    if (status) status.textContent = speech.paused ? "Paused" : "Reading aloud";
    if (toggle) {
      toggle.dataset.context = speech.context || "";
      toggle.textContent = speech.paused ? "Resume" : "Pause";
    }
  }

  function speechTextFor(context) {
    if (context.indexOf("lesson:") === 0) {
      const lesson = LESSONS.find(function (item) { return "lesson:" + item.id === context; });
      return lesson ? lessonSpeechText(lesson) : "";
    }

    if (context.indexOf("quiz:") === 0) {
      const q = quiz && quiz.questions[quiz.index];
      if (!q || "quiz:" + q.id !== context) return "";
      return questionSpeechText(q, quiz.revealed[quiz.index], quiz.answers[quiz.index]);
    }

    if (context.indexOf("exam:") === 0) {
      const q = exam && exam.questions[exam.index];
      if (!q || "exam:" + q.id !== context) return "";
      return questionSpeechText(q, false, null);
    }

    return "";
  }

  function lessonSpeechText(lesson) {
    const parts = [lesson.title + ". " + lesson.summary];
    lesson.sections.forEach(function (section) {
      if (section.h) parts.push(section.h + ".");
      if (section.p) section.p.forEach(function (paragraph) { parts.push(paragraph); });
      if (section.bullets) section.bullets.forEach(function (bullet) { parts.push(bullet); });
      if (section.note) parts.push("Test trap. " + section.note);
      if (section.table) parts.push(tableSpeechText(section.table));
    });
    if (lesson.table) parts.push(tableSpeechText(lesson.table));
    if (lesson.keyFacts && lesson.keyFacts.length) {
      parts.push("Key facts.");
      lesson.keyFacts.forEach(function (fact) { parts.push(fact); });
    }
    return parts.join(" ");
  }

  function tableSpeechText(table) {
    const parts = [];
    if (table.caption) parts.push(table.caption + ".");
    table.rows.forEach(function (row) {
      parts.push(table.headers.map(function (header, index) {
        return header + ": " + row[index];
      }).join(". ") + ".");
    });
    return parts.join(" ");
  }

  function questionSpeechText(q, reveal, selected) {
    const parts = ["Question. " + q.q, "Options."];
    q.options.forEach(function (option, index) {
      parts.push(LETTERS[index] + ". " + option);
    });
    if (reveal) {
      parts.push("Correct answer. " + LETTERS[q.answer] + ". " + q.options[q.answer]);
      if (selected !== null && selected !== undefined && selected !== q.answer) {
        parts.push("Your answer. " + LETTERS[selected] + ". " + q.options[selected]);
      }
      if (q.explain) parts.push(q.explain);
    }
    return parts.join(" ");
  }

  function chunkForSpeech(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];

    const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [clean];
    const chunks = [];
    let current = "";

    function add(piece) {
      const trimmed = piece.trim();
      if (!trimmed) return;
      if (current && current.length + trimmed.length + 1 > 220) {
        chunks.push(current);
        current = trimmed;
      } else {
        current = current ? current + " " + trimmed : trimmed;
      }
    }

    sentences.forEach(function (sentence) {
      if (sentence.length <= 220) {
        add(sentence);
        return;
      }

      let rest = sentence.trim();
      while (rest.length > 220) {
        let cut = rest.lastIndexOf(", ", 220);
        if (cut < 120) cut = rest.lastIndexOf(" ", 220);
        if (cut <= 0) cut = 220;
        add(rest.slice(0, cut + 1));
        rest = rest.slice(cut + 1).trim();
      }
      add(rest);
    });

    if (current) chunks.push(current);
    return chunks;
  }

  function pickSpeechVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    return voices.find(function (voice) { return /^en[-_]US/i.test(voice.lang) && voice.localService; }) ||
      voices.find(function (voice) { return /^en[-_]US/i.test(voice.lang); }) ||
      voices.find(function (voice) { return /^en/i.test(voice.lang); }) ||
      null;
  }

  function progressBar(percent) {
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    return '<div class="progress-track"><div class="progress-fill" style="width:' + safe + '%"></div></div>';
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours) return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    return minutes + ":" + String(secs).padStart(2, "0");
  }

  function formatDate(dateLike) {
    if (!dateLike) return "Unknown date";
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }
})();
