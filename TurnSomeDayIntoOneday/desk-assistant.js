/* The desk assistant's instructions - the deltas. 21 Sep 2026.
 *
 * WHY THIS FILE EXISTS. Jacques put a picture of his own chart on the desk, asked
 * a question, and got back "Entry: Not provided. Wrong if: Not provided. Target:
 * Not provided." That was the instructions working exactly as written, and the
 * instructions were wrong: one rule told the assistant to ask for the missing line
 * and give no levels at all in that first reply, and the note about a picture said
 * how to be careful with one without ever saying that a picture he attached IS the
 * answer. He does not want a form filled in before he can get a read. He wants the
 * read.
 *
 * The words themselves still live in desk.html, with the rest of the desk, so
 * there is one place to read the desk from. This file carries only the three
 * lines that were wrong.
 *
 * desk.html loads it with <script defer src="/desk-assistant.js"></script> above
 * its own script. defer means it runs after the page has been parsed, which is
 * after desk.html has defined DESK_SYS and picText - the two things it patches.
 * server/test/desk.test.js runs it the same way, so the prompt the tests read is
 * the prompt a phone gets.
 *
 * Each replacement is keyed on a phrase in desk.html. If a phrase ever goes away,
 * this file stops applying quietly - which is why the tests assert the new wording
 * is present in the assembled prompt, not just that this file loads.
 */
(function () {
  'use strict';

  if (typeof DESK_SYS === 'undefined') return;   // not the desk page

  // The two rules that read the chart in front of him, and the answer format.
  var RULES = [
    [
      'If he has not said where he is wrong, ask for it.',
      'If he has not said where he is wrong, read the invalidation you can see in his picture and say it is off his screenshot, and only ask him for it when no picture came with the question.'
    ],
    [
      'If he has not told you what price is doing, ask one short question rather than answering round it. One question, not a list.',
      'If he has not told you what price is doing, read it off the picture he attached and answer from it, and ask one short question only about the part the picture does not show. One question, not a list.'
    ],
    [
      '- Say what you do not know rather than filling it in. "I cannot see your chart" is a complete answer.',
      '- Say what you do not know rather than filling it in, but when he has handed you a chart you can see, the read IS the answer, and a reply that only lists what is missing is not one. "I cannot see your chart" completes an answer only when no picture came with the question.\n'
      + '- With a picture attached, every level line carries either a number read off it or the plain words that the picture does not show that line. Never answer a picture with Not provided on its own, and never leave the Entry, Wrong if or Target lines out because the form on the page is empty.'
    ]
  ];

  for (var i = 0; i < RULES.length; i++) {
    DESK_SYS = DESK_SYS.split(RULES[i][0]).join(RULES[i][1]);
  }

  // The picture block, which has to say out loud what a picture is for. Wrapped
  // rather than rewritten so the rest of it stays in desk.html.
  if (typeof picText === 'function') {
    var pictured = picText;
    picText = function () {
      var text = pictured();
      if (text.indexOf('NO CHART PICTURE IS ATTACHED') === 0) return text;
      return text + ' HE SENT IT BECAUSE HE WANTS THE READ OUT OF IT: give him the'
        + ' Entry, the Wrong if and the Target you can read in it, each on its own'
        + ' labelled line and each said to be off his screenshot, and say which of'
        + ' those lines the picture does not show instead of leaving it out.';
    };
  }
})();
