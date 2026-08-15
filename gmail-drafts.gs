// GMAIL DRAFTS — 22 school follow-ups (EMAIL 2 in SCHOOLS.md), due 16 Aug 2026.
// Creates DRAFTS only — it never sends. Review each draft in Gmail, then Send.
// Run once. Running twice = 22 duplicates.
//
// USAGE: script.google.com → + New project → paste this whole file → the
// dropdown next to Debug should say "createDrafts" → Run → Advanced →
// "Go to [project] (unsafe)" → Allow → log says "Finished - 22 draft(s)".
// Then Gmail → Drafts → review each → Send.

var Q = [
"hr@parkwayschools.net|Parkway staff|",
"humanresources@lindberghschools.ws|Lindbergh staff|",
"wiley.sandy@wgmail.org|Webster Groves staff|Dr. Wiley Skinner",
"tcampball@fergflor.org|FFSD staff|Ms. Campbell",
"rebouletkatie@rsdmo.org|Rockwood staff|Dr. Reboulet",
"nedwards@ladueschools.net|Ladue staff|Nancy",
"sherri.cox@mehvlilleschooldistrict.com|Mehlville staff|Sherri",
"kathy.monahan@kirkwoodschools.org|Kirkwood staff|Kathy",
"benefits@psdr3.org|Pattonville staff|",
"lachancem@ritenourschools.org|Ritenour staff|Mr. LaChance",
"benefits@fhsdschools.org|FHSD staff|",
"rebecca.anderson@slps.org|SLPS staff|Rebecca",
"wellness@osceolaschools.net|your staff newsletter|",
"BeWell@ncps-k12.org|your staff newsletter|",
"wellness@mcpasd.k12.wi.us|your staff newsletter|",
"Andrea.Fish@k12.sd.us|your staff newsletter|Andrea",
"drycreekwellness@dcjesd.us|your staff newsletter|",
"Klrichm@sunprairieschools.org|your staff newsletter|",
"payrollbenefits@verona.k12.wi.us|your staff newsletter|",
"lchristenson@ccsd.k12.wy.us|your staff newsletter|Laurie",
"human-resources@sasd.net|your staff newsletter|",
"brittany.hazzard@capital.k12.de.us|your staff newsletter|Dr. Hazzard"
];

function createDrafts(){
  var NL = String.fromCharCode(10);
  var made = 0;
  for (var i = 0; i < Q.length; i++) {
    var p = Q[i].split("|");
    var subj = "Re: A free wellbeing resource for " + p[1];
    var body = "Hi" + (p[2] ? " " + p[2] : "") + "," + NL + NL +
      "Floating this up once. One-line version: free, private wellbeing app for your staff (recovery + supporting a loved one), nothing for your office to run, and I'll write the newsletter blurb myself. Built by one guy who lived it: turnsomedayintodayone.com" + NL + NL +
      "Thanks either way - the fact that your district has a wellness program at all puts it ahead of most." + NL + NL +
      "Jacques";
    GmailApp.createDraft(p[0], subj, body);
    made++;
  }
  Logger.log("Finished - " + made + " draft(s) created. Open Gmail > Drafts, review each, press Send.");
}
