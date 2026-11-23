# Ray Bar

A drink menu for a home bar, built to live on an iPad as a sign. It looks like a wall of salvaged, mismatched signs: rusted metal, painted planks, chipped enamel, hazard plates, cardboard and duct tape, with every letter of the bar name on a different scrap plate and a flickering neon sign in the corner.

## The two pages

| Page | What it does |
| --- | --- |
| `index.html` | **The sign.** Pure display. Fills the screen in either orientation, keeps the screen awake, and picks up menu changes on its own. Press and hold anywhere to show the **Edit menu** button. |
| `edit.html` | **The editor.** Change the bar name, tagline, neon text and footer, pick the wall and sign styles, and add, reorder, hide or remove drinks. Every change saves immediately and shows in the live preview. |

### What you can change

- **Signs (sections):** title, a small note, sign style (rusted metal, painted wood, enamel plate, hazard yellow, cardboard, chalkboard, atomic diner, or auto), shown or hidden, order.
- **Drinks:** name, description, price, in stock or out, house special (gets a star).
- **Look:** wall (concrete, wood paneling, corrugated metal), number of columns (auto picks whatever makes the text biggest), prices on or off, descriptions on or off, and whether drinks you're out of get stamped **OUT** or hidden.
- **Prices:** a plain number like `12` shows with a bottle cap. Anything else (`$8`, `free`) shows as typed.

## Setting up the iPad

1. Open the sign in Safari, tap **Share**, then **Add to Home Screen**. Launch it from that icon and it runs full screen with no browser bars.
2. To edit, press and hold anywhere on the sign, then tap **Edit menu**. **Always edit from inside the Home Screen app**: Safari and the Home Screen app keep separate copies of the menu.
3. Set **Settings > Display & Brightness > Auto-Lock** to **Never**. The sign also asks the iPad to stay awake, but this makes sure.
4. Optional: turn on **Settings > Accessibility > Guided Access** to lock the iPad to the sign so guests can't wander off into other apps.

## Where the menu is saved

The menu is saved in the browser on the device you edit it on (local storage). There is no server or account. That means:

- The editor and the sign need to run on the **same device** and in the **same app** (both in the Home Screen app, or both in Safari).
- Use **Backup > Export menu file** in the editor now and then. **Import menu file** restores it or moves it to another device.

## Hosting

The pages are plain HTML, CSS and JavaScript with no build step. They need to be served over HTTPS so the iPad can reach them, for example with GitHub Pages, Cloudflare Pages or Netlify. The fonts load from Google Fonts.

## Running it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 for the sign and http://localhost:8000/edit.html for the editor.

## Files

```
index.html             the sign
edit.html              the editor
css/sign.css           the scrapyard look (all textures are generated in CSS and SVG, no image files)
css/editor.css         the editor's styling
js/store.js            menu data, the sample menu, saving and loading
js/sign.js             draws the wall, fits it to the screen, keeps the screen on, press-and-hold controls
js/editor.js           the editor
manifest.webmanifest   lets it install to the Home Screen
icons/                 app icons
```
