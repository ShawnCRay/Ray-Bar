# Ray Bar

A drink menu for a home bar, built to live on an iPad as a sign. It looks like a wall of salvaged, mismatched signs: rusted metal, painted planks, chipped enamel, hazard plates, cardboard and duct tape, with every letter of the bar name on a different scrap plate and a flickering neon sign in the corner.

## The two pages

| Page | What it does |
| --- | --- |
| `index.html` | **The sign.** Pure display. Fills the screen in either orientation, keeps the screen awake, and picks up menu changes on its own. Press and hold anywhere to show the **Edit menu** button. |
| `edit.html` | **The editor.** Works on any phone, tablet or computer. Change the bar name, tagline, neon text and footer, pick the wall and sign styles, and add, reorder, hide or remove drinks. Edits show in the live preview as you make them, then **Publish** puts them on the sign. |

### What you can change

- **Signs (sections):** title, a small note, sign style (rusted metal, painted wood, enamel plate, hazard yellow, cardboard, chalkboard, atomic diner, or auto), shown or hidden, order.
- **Drinks:** name, description, price, in stock or out, house special (gets a star).
- **Look:** wall (concrete, wood paneling, corrugated metal), number of columns (auto picks whatever makes the text biggest), prices on or off, descriptions on or off, and whether drinks you're out of get stamped **OUT** or hidden.
- **Prices:** a plain number like `12` shows with a bottle cap. Anything else (`$8`, `free`) shows as typed.

## Addresses

- Sign: https://shawncray.github.io/Ray-Bar/
- Editor: https://shawncray.github.io/Ray-Bar/edit.html

## Setting up the iPad

1. Open the sign in Safari, tap **Share**, then **Add to Home Screen**. Launch it from that icon and it runs full screen with no browser bars.
2. Set **Settings > Display & Brightness > Auto-Lock** to **Never**. The sign also asks the iPad to stay awake, but this makes sure.
3. Optional: turn on **Settings > Accessibility > Guided Access** to lock the iPad to the sign so guests can't wander off into other apps.

## Editing from another device

1. Open the editor address on your phone or computer.
2. The first time, connect that device to GitHub (the **Publishing** box walks through it):
   - Tap **Create a key on GitHub**.
   - Under **Repository access**, choose **Only select repositories** and pick **Ray-Bar**.
   - Under **Permissions**, add **Contents** and set it to **Read and write**.
   - Tap **Generate token**, copy it, paste it into the editor, and tap **Connect**.
3. Make your changes. They save on that device as a draft and show in the preview.
4. Tap **Publish**. The sign checks for changes every 30 seconds and switches over on its own.

You can also edit on the iPad itself: press and hold anywhere on the sign, then tap **Edit menu**. It needs its own key the first time, like any other device.

The key is stored only in that device's browser and can only change this repo. If it expires or is revoked, the editor asks for a new one. If two devices publish different changes, the editor asks before replacing what's on the sign.

## How it works

- The published menu is `menu.json` on the `menu` branch of this repo. Publishing commits a new version of it, so every published menu is kept in the history.
- The sign reads that file through GitHub's API every 30 seconds. Checks where nothing changed don't count against GitHub's hourly limit. If GitHub is unreachable, the sign keeps showing the last menu it loaded.
- The site itself is served from the `main` branch by GitHub Pages, so publishing a menu doesn't rebuild the site.
- Where the menu lives is set in `js/config.js`. Change it there if the repo is renamed or moved.

## Hosting

The pages are plain HTML, CSS and JavaScript with no build step. They need to be served over HTTPS so the iPad can reach them, for example with GitHub Pages, Cloudflare Pages or Netlify. The fonts load from Google Fonts.

## Running it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 for the sign and http://localhost:8000/edit.html for the editor. The local copy reads and publishes the same menu as the live site.

## Files

```
index.html             the sign
edit.html              the editor
css/sign.css           the scrapyard look (all textures are generated in CSS and SVG, no image files)
css/editor.css         the editor's styling
js/config.js           where the published menu lives on GitHub
js/store.js            menu data, the sample menu, saving, loading and publishing
js/sign.js             draws the wall, fits it to the screen, checks for new menus, keeps the screen on
js/editor.js           the editor, including connecting and publishing
manifest.webmanifest   lets it install to the Home Screen
icons/                 app icons
```
