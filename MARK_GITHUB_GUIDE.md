# Getting Dead Signal onto GitHub — for Mark

Hey Mark — Trevor here. This guide is for getting your campaign tracker code onto GitHub so I can pick it up on my computer and finish the Firebase work.

You don't need VS Code. You don't need to install anything. We're doing this entirely in your web browser.

## What you need before you start

- A computer (laptop or desktop, not phone — the web upload only works on desktop browsers)
- The downloaded folder full of `.html`, `.css`, `.js` files
- About 10 minutes

## Step 1 — Make a GitHub account

1. Go to **github.com**
2. Click **Sign up** in the top right
3. Use any email and pick a username — anything works
4. Verify the email when GitHub sends you a confirmation
5. When it asks what your goal is, you can skip those questions

## Step 2 — Create a new repository

1. Once you're signed in, click the **+** button in the top right of the page
2. Pick **New repository**
3. Repository name: type `dead-signal`
4. Description: `D&D campaign tracker` (optional)
5. Make sure **Public** is selected (Trevor needs to see it)
6. **Important** — check the box that says **"Add a README file"**
7. Click the green **Create repository** button at the bottom

You now have an empty repo at `github.com/YOURUSERNAME/dead-signal`

## Step 3 — Upload the files

1. On your new repo page, you'll see a tab bar near the top: `Code | Issues | Pull requests | ...`. Stay on **Code**
2. Click the **Add file** dropdown button (it's near the green Code button)
3. Choose **Upload files**
4. Open your file explorer, navigate to the `dead_signal` folder I sent you
5. Select **everything inside** (not the folder itself — the contents): all the `.html` files, the `css` folder, the `js` folder, the `.md` files
6. Drag those files and folders into the GitHub upload area in your browser
7. Wait for the upload to finish (small green checkmarks next to each)
8. Scroll down to **Commit changes** at the bottom
9. Leave the default message ("Add files via upload") or type whatever
10. Click **Commit changes**

That's it. Refresh the page and you should see all your files listed.

## Step 4 — Send Trevor the link

Send Trevor this URL:

```
github.com/YOURUSERNAME/dead-signal
```

Replace `YOURUSERNAME` with whatever you picked when signing up.

Trevor will clone it, add Firebase, and push the updates back. You can keep using the localStorage version in the meantime — your tracker will still work exactly the same offline.

## If you want to update files later

Same process — go into the repo, click into the file you want to change, click the pencil icon, edit, commit. Or use **Add file → Upload files** to upload a new version.

If something goes weird, message Trevor — don't try to "fix" git stuff in the browser, it gets confusing fast.

## Common problems

**"My files won't upload because they're too big"** — If a single image is over 25MB, GitHub will reject it. None of the code files should be near that. If it happens, it's probably an accidental video or huge image somewhere. Skip that file.

**"I can't see the css/js folders after uploading"** — Click into the folder names on GitHub. They show as folders in the file list. If they're missing, you uploaded files individually instead of the folders. Re-upload by dragging the folders themselves.

**"The README is showing instead of my files"** — That's fine, GitHub always shows the README on the front page. Your files are in the file list above it.
