/**
 * Run with: node --experimental-strip-types src/lib/newspaper-copy.test.ts
 * from CommandCenter-main/.
 */
import {
  cleanStoryCopy,
  decodeNewspaperEntities,
  htmlToNewspaperText,
  isBoilerplateLine,
  isGamblingDisclaimer,
  isPrintableStoryBody,
  isTeamNameCaption,
  isVideoTitleSoup,
  joinBrokenDecimals,
  newsImageCaption,
  dropLastSentence,
  sanitizeArticleBody,
  stripBoilerplateCopy,
  stripGettyCredit,
  printHeadline,
  tidy,
  truncateAtSentence,
} from "./newspaper-copy.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertEqual(got: unknown, want: unknown, msg: string) {
  if (got !== want) throw new Error(`FAIL: ${msg}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
}

assertEqual(tidy("Tyreek Hill 's catch"), "Tyreek Hill’s catch", "space before apostrophe");
assertEqual(tidy("Blake Craig 's kick"), "Blake Craig’s kick", "another possessive");
assertEqual(tidy("76ers' preseason opener"), "76ers’ preseason opener", "possessive keeps the space after the mark");
assertEqual(tidy("the Bears' starting quarterback"), "the Bears’ starting quarterback", "Bears' starting keeps its space");
assertEqual(tidy("76ers'preseason opener"), "76ers’ preseason opener", "repairs a possessive that already lost its space");
assertEqual(tidy("Bears'starting quarterback"), "Bears’ starting quarterback", "repairs Bears'starting");
assertEqual(tidy("don't sit"), "don’t sit", "contractions stay glued");
assertEqual(tidy("Giants'36-24 win"), "Giants’ 36-24 win", "score after a possessive keeps a space");
assertEqual(
  printHeadline("James, Embiid, Maxey sit out 76ers'preseason opener vs. Knicks"),
  "James, Embiid, Maxey sit out 76ers’ preseason opener vs. Knicks",
  "printHeadline repairs a filed 76ers sit-out hed",
);
assertEqual(tidy("James, Embiid, Maxey sit out 76ers' preseason opener vs. Knicks"), "James, Embiid, Maxey sit out 76ers’ preseason opener vs. Knicks", "space after a possessive stays");
assertEqual(tidy("the teams' inaugural season"), "the teams’ inaugural season", "teams' inaugural keeps the space");
assertEqual(tidy("HRCC's Committees"), "HRCC’s Committees", "straight tick becomes a curly possessive");
assertEqual(tidy('" The Greatest Offense There Is "'), '"The Greatest Offense There Is"', "quoted title inner spaces");assertEqual(tidy("Raiders ."), "Raiders.", "space before a period still drops");
assertEqual(tidy('Prescott said,"I knew it was a touchdown."'), 'Prescott said, "I knew it was a touchdown."', "space after comma before a quote");
assertEqual(tidy("HOUSTON -- — CeeDee Lamb shined."), "HOUSTON — CeeDee Lamb shined.", "double dash collapses to one em dash");
assertEqual(tidy("HOUSTON --— CeeDee Lamb shined."), "HOUSTON — CeeDee Lamb shined.", "dash run without a space also collapses");

assertEqual(joinBrokenDecimals("532. 8 yards"), "532.8 yards", "join a broken yardage decimal");
assertEqual(joinBrokenDecimals("21. 5%"), "21.5%", "join a broken percentage");
assertEqual(joinBrokenDecimals("above. 500"), "above .500", "batting average after above");
assertEqual(
  joinBrokenDecimals("The season ended. 5 players left."),
  "The season ended. 5 players left.",
  "a sentence end plus a count stays split",
);
assertEqual(
  tidy("He threw for 532. 8 yards and the club sat above. 500 after the bye."),
  "He threw for 532.8 yards and the club sat above .500 after the bye.",
  "tidy applies both decimal rules",
);

assertEqual(decodeNewspaperEntities("Texas A&amp;M"), "Texas A&M", "decode amp once");
assertEqual(decodeNewspaperEntities("Texas A&amp;amp;M"), "Texas A&amp;M", "decode only one layer");
assertEqual(cleanStoryCopy("Texas A&amp;M leads.").text, "Texas A&M leads.", "entities decode in story copy");

assert(isBoilerplateLine("------"), "rule line is chrome");
assert(isBoilerplateLine("Sign up for Cardinals alerts"), "signup alerts");
assert(isBoilerplateLine("Subscribe: the morning newsletter"), "subscribe line");
assert(isBoilerplateLine("Jump to: comments"), "jump-to");
assert(isBoilerplateLine("Posted in Sports"), "posted-in");
assert(isBoilerplateLine("Share this: Facebook"), "share-this");
assert(isBoilerplateLine("To read this story, subscribe"), "to-read-this");
assert(isBoilerplateLine("(Getty images)"), "bare getty");
assert(isBoilerplateLine("Click here"), "click here");
assert(isBoilerplateLine("Download the app"), "download the app");
assert(isBoilerplateLine("Follow us on Twitter"), "follow us");
assert(!isBoilerplateLine("Hill caught the ball and ran."), "a real sentence stays");

const chrome = stripBoilerplateCopy(
  ["Hill scored.", "------", "Sign up for NFL alerts", "The drive stalled.", "(Getty images)"].join("\n"),
);
assertEqual(chrome, "Hill scored.\n\nThe drive stalled.", "boilerplate lines drop");

const html = `
  <p>Hours before kickoff the group chat lit up.</p>
  <h2>Monday, Sept. 28: four on the floor</h2>
  <p><strong>and a fifth in the group chat</strong></p>
  <p>Hours before the game, the coaches met.</p>
`;
const fromHtml = htmlToNewspaperText(html);
assert(fromHtml.includes("four on the floor"), "subhead text is kept");
assert(fromHtml.includes("four on the floor\n\nand a fifth in the group chat"), "strong-only para stays its own line");
assert(fromHtml.includes("group chat\n\nHours before the game"), "the next graf starts after the subhead");
const cleanedHtml = cleanStoryCopy(html).text;
assert(
  cleanedHtml.includes("four on the floor") && cleanedHtml.includes("Hours before the game"),
  "cleaned HTML still has the subhead and the graf",
);
assert(cleanedHtml.includes("\n\n"), "cleaned HTML keeps paragraph breaks");
assert(!/group chat Hours before/.test(cleanedHtml), "cleaned copy does not glue the subhead onto the next graf");

const pageDek = "With Page, the No. 1 overall pick is in camp this week. The club likes him a great deal more than the board expected.";
assertEqual(
  truncateAtSentence(pageDek, 60),
  "With Page, the No. 1 overall pick is in camp this week.",
  "No. does not end the sentence",
);
assertEqual(
  truncateAtSentence("Mr. Smith and St. Louis visit vs. the Jr. varsity on Saturday night. The game is Friday.", 70),
  "Mr. Smith and St. Louis visit vs. the Jr. varsity on Saturday night.",
  "Mr. St. vs. Jr. stay inside the sentence",
);
const oneLong = "With Page, the No. 1 overall pick is expected to start Saturday.";
assert(
  !truncateAtSentence(oneLong, 24).endsWith("No."),
  "a short max does not land on No.",
);
assert(
  truncateAtSentence(oneLong, 24) === oneLong,
  "a single sentence longer than max stays whole",
);
assert(!truncateAtSentence(oneLong, 24).includes("…"), "fitted copy never ellipsizes mid-sentence");
assertEqual(dropLastSentence("One done. Two done. Three done."), "One done. Two done.", "drops the last sentence");
assertEqual(dropLastSentence("Only one remains."), "", "one sentence that does not fit leaves a blank");

assertEqual(stripGettyCredit("The rotunda (Getty images)."), "The rotunda.", "getty slug strips from a caption");
assertEqual(stripGettyCredit("(Getty Images)"), "", "a bare getty caption is empty");

assert(isTeamNameCaption("Dallas Cowboys"), "bare team name is not a caption");
assert(isTeamNameCaption("Los Angeles Rams"), "another franchise name");
assert(!isTeamNameCaption("Matthew Stafford drops back against Dallas."), "a real caption stays");
assertEqual(
  newsImageCaption([{ name: "Dallas Cowboys", alt: "Dallas Cowboys", caption: "" }]),
  null,
  "ESPN team-name image field is not printed",
);
assertEqual(
  newsImageCaption([{ name: "Dallas Cowboys", caption: "Rams receiver Puka Nacua hauls in a catch." }]),
  "Rams receiver Puka Nacua hauls in a catch.",
  "a real source caption is kept",
);

assert(isBoilerplateLine("Terms of Use"), "terms of use is chrome");
assert(isBoilerplateLine("Privacy Policy"), "privacy policy is chrome");
assert(isBoilerplateLine("Watch: Cowboys postgame"), "watch-rail is chrome");
assert(isBoilerplateLine("Read more about the Cowboys"), "read-more is chrome");
assert(isBoilerplateLine("If you or someone you know has a gambling problem, call 1-800-GAMBLER"), "hotline line is chrome");
assert(isGamblingDisclaimer("Gambling problem? Call 1-800-GAMBLER or visit DraftKings"), "draftkings disclaimer");

const videoSoup =
  "not buying into Cowboys after win over Texans Stephen A. not buying into Cowboys after win over Texans 1:33 Did Drake Maye prove doubters wrong with win over Bills? Did Drake Maye prove doubters wrong with win over Bills?";
assert(isVideoTitleSoup(videoSoup), "repeated ESPN video titles are soup");
assertEqual(sanitizeArticleBody(videoSoup), "", "video-title soup sanitizes to empty");
assert(!isPrintableStoryBody(videoSoup), "video-title soup is not printable");

const gambler =
  "Gambling problem? Call 1-800-GAMBLER or 1-800-NEXT-STEP. Must be 21+. Void where prohibited. DraftKings. Terms of Use. Privacy Policy.";
assertEqual(sanitizeArticleBody(gambler), "", "a gambling disclaimer sanitizes to empty");
assert(
  !isPrintableStoryBody(gambler),
  "a disclaimer is not a recap",
);

const mixed = [
  "CeeDee Lamb caught two touchdowns and Dallas held on in Houston after a late Texans drive stalled at the goal line.",
  "Gambling problem? Call 1-800-GAMBLER.",
  "Watch: Cowboys highlights 1:33",
  "Dak Prescott threw for 312 yards as the Cowboys beat the Texans 34-30 and moved to 2-2 in the NFC East.",
].join("\n\n");
const cleanedMixed = sanitizeArticleBody(mixed);
assert(cleanedMixed.includes("CeeDee Lamb caught two touchdowns"), "the lede stays");
assert(cleanedMixed.includes("Dak Prescott threw for 312 yards"), "the second graf stays");
assert(!/GAMBLER/i.test(cleanedMixed), "the hotline drops out of a real story");
assert(!/Watch:/i.test(cleanedMixed), "the watch rail drops out of a real story");
assert(isPrintableStoryBody(mixed), "a real recap with chrome stripped is printable");

const captionOnly = sanitizeArticleBody("Dallas Cowboys");
assertEqual(captionOnly, "", "a team-name caption is not a story");

const eveningCowboys = `not buying into Cowboys after win over Texans Stephen A. not buying into Cowboys after win over Texans 1:33 Did Drake Maye prove doubters wrong with win over Bills? Did Drake Maye prove doubters wrong with win over Bills? 2:13 Stephen A. disappointed by C.J. Gardner-Johnson's 'classless' response to Bills' loss Stephen A. disappointed by C.J. Gardner-Johnson's 'classless' response to Bills' loss 0:51 Rex Ryan: Eagles O-line is 'hot garbage' Rex Ryan: Eagles O-line is 'hot garbage' 0:34 Referee livid after collision with Vikings LB Eric Wilson Referee livid after collision with Vikings LB Eric Wilson Terms of Use Privacy Policy Your US State Privacy Rights Children's Online Privacy Policy Interest-Based Ads About Nielsen Measurement Your Privacy Choices Contact Us Disney Ad Sales Site Work for ESPN Corrections GAMBLING PROBLEM? CALL 1-800-GAMBLER or 1-800-MY-RESET, (800) 327-5050 or visit gamblinghelplinema.org (MA). Call 877-8-HOPENY/text HOPENY (467369) (NY). Call 888-789-7777/visit ccpg.org (CT), or visit www.mdgamblinghelp.org (MD), 1-800-981-0023 (PR). 21+ and present in most states. (18+ DC/KY/NH/PR/WY). Void in ONT. Eligibility restrictions apply. Terms: draftkings.com/sportsbook. On behalf of Boot Hill Casino (KS). Pass-thru of per wager tax may apply in IL. Copyright: © 2026 ESPN Enterprises, LLC.`;
assertEqual(sanitizeArticleBody(eveningCowboys), "", "2026-10-05-evening Cowboys scrape sanitizes to empty");
assert(!isPrintableStoryBody(eveningCowboys), "evening Cowboys scrape is not printable");
assertEqual(sanitizeArticleBody("Dallas Cowboys vs. Houston Texans: Game Highlights"), "", "highlights title is not a recap");

console.log("newspaper-copy ok");
