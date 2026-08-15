// GMAIL DRAFTS — puts each email below into your Gmail as a DRAFT (never sends).
// You review and press Send yourself. This is the 22 school follow-ups
// (EMAIL 2 in SCHOOLS.md), due 16 Aug 2026 — one week after the first email.
//
// HOW TO USE (5 minutes, on a computer):
// 1. Go to https://script.google.com — signed into the SAME Google account as your Gmail.
// 2. Click "+ New project" (top left).
// 3. Select everything already in the editor (Ctrl+A), delete it.
// 4. Copy this whole file and paste it in.
// 5. In the toolbar, make sure the dropdown next to "Debug" says "createDrafts".
// 6. Click "Run". Google asks permission to touch your Gmail: pick your account,
//    click "Advanced" on the warning, then "Go to [project] (unsafe)", then "Allow".
//    (That warning is normal for a script you pasted yourself — it is not a virus.)
// 7. Wait for the log at the bottom to say "Finished - 22 draft(s) created."
// 8. Open Gmail → Drafts (left menu). Read each one, press Send.
//
// It NEVER sends anything by itself — createDraft only writes a draft.
// If you run it twice you get 22 duplicates, so run it once.

var NL = String.fromCharCode(10);

var QUEUE = [
  // to = the email address, subject = subject line, name = greeting ("" = no name)
  { to: "hr@parkwayschools.net",                 subject: "Re: A free wellbeing resource for Parkway staff",         name: "" },
  { to: "humanresources@lindberghschools.ws",    subject: "Re: A free wellbeing resource for Lindbergh staff",       name: "" },
  { to: "wiley.sandy@wgmail.org",                subject: "Re: A free wellbeing resource for Webster Groves staff",  name: "Dr. Wiley Skinner" },
  { to: "tcampball@fergflor.org",                subject: "Re: A free wellbeing resource for FFSD staff",            name: "Ms. Campbell" },
  { to: "rebouletkatie@rsdmo.org",               subject: "Re: A free wellbeing resource for Rockwood staff",        name: "Dr. Reboulet" },
  { to: "nedwards@ladueschools.net",             subject: "Re: A free wellbeing resource for Ladue staff",           name: "Nancy" },
  { to: "sherri.cox@mehlvilleschooldistrict.com",subject: "Re: A free wellbeing resource for Mehlville staff",       name: "Sherri" },
  { to: "kathy.monahan@kirkwoodschools.org",     subject: "Re: A free wellbeing resource for Kirkwood staff",        name: "Kathy" },
  { to: "benefits@psdr3.org",                    subject: "Re: A free wellbeing resource for Pattonville staff",     name: "" },
  { to: "lachancem@ritenourschools.org",         subject: "Re: A free wellbeing resource for Ritenour staff",        name: "Mr. LaChance" },
  { to: "benefits@fhsdschools.org",              subject: "Re: A free wellbeing resource for FHSD staff",            name: "" },
  { to: "rebecca.anderson@slps.org",             subject: "Re: A free wellbeing resource for SLPS staff",            name: "Rebecca" },
  { to: "wellness@osceolaschools.net",           subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "BeWell@ncps-k12.org",                   subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "wellness@mcpasd.k12.wi.us",             subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "Andrea.Fish@k12.sd.us",                 subject: "Re: A free wellbeing resource for your staff newsletter", name: "Andrea" },
  { to: "drycreekwellness@dcjesd.us",            subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "Klrichm@sunprairieschools.org",         subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "payrollbenefits@verona.k12.wi.us",      subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "lchristenson@ccsd.k12.wy.us",           subject: "Re: A free wellbeing resource for your staff newsletter", name: "Laurie" },
  { to: "human-resources@sasd.net",              subject: "Re: A free wellbeing resource for your staff newsletter", name: "" },
  { to: "brittany.hazzard@capital.k12.de.us",    subject: "Re: A free wellbeing resource for your staff newsletter", name: "Dr. Hazzard" }
];

var FOLLOW_UP = [
  "Floating this up once. One-line version: free, private wellbeing app for your staff (recovery + supporting a loved one), nothing for your office to run, and I'll write the newsletter blurb myself. Built by one guy who lived it: turnsomedayintodayone.com",
  "Thanks either way — the fact that your district has a wellness program at all puts it ahead of most.",
  "Jacques"
];

function createDrafts() {
  if (QUEUE.length === 0) {
    Logger.log("The queue is empty.");
    return;
  }
  var made = 0;
  for (var i = 0; i < QUEUE.length; i++) {
    var e = QUEUE[i];
    if (!e.to || !e.subject) {
      Logger.log("Skipped entry #" + (i + 1) + " - missing to or subject.");
      continue;
    }
    var greeting = "Hi" + (e.name ? " " + e.name : "") + "," + NL + NL;
    var body = greeting + FOLLOW_UP.join(NL + NL);
    GmailApp.createDraft(e.to, e.subject, body);
    made++;
  }
  Logger.log("Finished - " + made + " draft(s) created. Open Gmail, then Drafts, review each, press Send.");
}
