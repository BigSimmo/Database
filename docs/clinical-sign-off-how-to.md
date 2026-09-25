# How to sign off clinical content

This guide is for the clinical owner. It explains, step by step, how to read and sign off
the guidance for the WA Mental Health Act 2014 forms and the plain-English Act-section
summaries. You do it on your own computer. Nothing is sent anywhere until the last step.

Only you can sign off. Claude and other tools are blocked from doing it: the sign-off tool
refuses to write anything unless a person is typing at a real terminal.

## What a sign-off does

Every form in the app currently says "awaiting clinical review". When you sign a form off,
that label comes off for that form only. The rest keep it until you get to them, so you can
do a few at a time.

Your sign-off is tied to the exact text you read. If anyone edits that text afterwards, the
app's checks notice and the form goes back to needing your sign-off. You will never be
vouching for words you did not see.

## Before you start

You need a terminal window open in your copy of the project folder on your computer.

- **Mac:** open the Terminal app, type `cd ` (with a space after it), drag the project folder
  into the window, and press Enter.
- **Windows:** use Command Prompt, not PowerShell. Open the project folder in File Explorer,
  click the address bar at the top, type `cmd` and press Enter. A Command Prompt window opens
  already in the project folder. (If you do use PowerShell, type `npm.cmd` wherever this
  guide says `npm`.)

Type each command below exactly as shown, then press Enter.

1. Check your computer has the right version of Node, the program the project runs on:

   ```bash
   node --version
   ```

   The answer must start with `v24`. If it does not, stop and tell Claude what it printed.

2. Get the latest version of the project:

   ```bash
   git fetch origin
   ```

3. Switch to the version that has the sign-off tool:

   ```bash
   git switch claude/sweet-carson-e7ur0s-wa-signoff
   ```

   If it says your local changes would be overwritten, stop and ask Claude before going on.
   While you are signing off, this version is yours: Claude will not change it until you
   have sent your sign-offs.

4. Install the project's tools for this version. It takes a few minutes, and you only need
   to do it again after you next switch to a newer version of the project:

   ```bash
   npm ci --include=dev
   ```

5. Check the tool works. This only shows what is waiting and changes nothing:

   ```bash
   npm run clinical:review
   ```

## Signing off forms

6. Start the walk-through. Replace `<your surname>`, angle brackets included, with your
   surname, so the name reads exactly as you want it shown in the app. Keep the quote marks.
   The tool refuses the name if the angle brackets are still there.

   ```bash
   npm run clinical:review -- --write --walk --kind form --reviewed-by "Dr <your surname>"
   ```

   Your name is shown publicly in the app. Do not use your email address, AHPRA number,
   provider number or staff number; the tool will refuse them.

7. The tool shows one form at a time, highest consequence first: **3C, 10B, 10E, 11B, 11E,
   6C**, then the rest in catalogue order. For each form it shows everything you are
   vouching for, exactly as the app shows it: the three summary cards at the top of the
   form's page (clock, who makes it, criteria), the purpose, who may make it, when it applies, the clock, what it does and
   does not authorise, the traps, the pre-use checks, the safety pearl, the documentation
   stem, and the Act sections it was drafted from. Have the approved form open beside you and
   read the screen in full.

8. Answer the three questions. Type `yes` or `no` and press Enter.
   - **"The wording matches its source."** Every statement on the screen matches the Act
     sections named and the current approved form. Nothing is added that the source does
     not say.
   - **"The clinical meaning is correct."** Read as a clinician would at the bedside, it
     means the right thing: the clock starts at the right moment, the maker is right, and
     the limits of what the form authorises are right.
   - **"It is safe to show this as reviewed."** You are content for the app to drop the
     "awaiting clinical review" label for this form.

   Any `no` means that form is not signed off. Nothing is written for it, and the tool moves
   on to the next form. It stays "awaiting clinical review" until you come back to it.

9. After three `yes` answers, type the form's code to confirm (for example `3C`) and press
   Enter. That form is saved straight away.

10. Stop whenever you like: type `quit` at any question or at the code prompt, or press Ctrl
    and C together. Nothing is saved for the form on screen; every form you already confirmed
    stays saved. Next time, the walk-through starts at the first
    form you have not signed.

## Signing off Act-section summaries

The same walk-through works for the plain-English summaries of each Act section. It shows
the verbatim Act text above the drafted summary, in section-number order. The three
questions mean the same thing, applied to the summary against the Act text. Confirm each one
by typing its section number (for example `26`).

```bash
npm run clinical:review -- --write --walk --kind section --reviewed-by "Dr <your surname>"
```

## Saving and sending your sign-offs

Your sign-offs are saved only on your computer until you send them. When you have finished
a session:

11. Mark the changed files to be saved. For forms:

```bash
git add data/forms-content-review.json docs/evidence/forms-operational-guidance-review.md
```

For Act sections, instead:

```bash
git add data/mha-2014-sections.json
```

12. Save them with a short note:

    ```bash
    git commit -m "Clinical sign-off: forms"
    ```

    (For sections, use `"Clinical sign-off: Act sections"`.)

13. Send them:

    ```bash
    git push
    ```

    This can take a minute or two while the project runs its own checks.

Then tell Claude "I've pushed my sign-offs", and Claude will take it from there.

If `git push` (or any step) fails, copy the last line of the message it printed and paste it
to Claude in the chat. Your sign-offs are still saved on your computer, so nothing is lost.

## If something looks wrong

- **The tool says "content changed since sign-off".** Someone edited a form or summary
  after you signed it. It is back in your queue; run the walk-through again to re-read it.
- **The text on screen is wrong.** Answer `no`. Nothing is saved for that form. Tell Claude
  which form and what is wrong, and it will be corrected and come back to you.
- **The tool says the project's tools are not installed.** Run `npm ci --include=dev` (step
  4), then start the walk-through again.
- **The tool says another sign-off is saving the file.** Close any other terminal window
  that is running the sign-off tool and try again. It clears a lock left behind by a
  session that crashed, or one older than 30 minutes, by itself. If it still refuses, copy
  the last line of the message and paste it to Claude.
- **Anything else.** Copy the last line of the message and paste it to Claude.
