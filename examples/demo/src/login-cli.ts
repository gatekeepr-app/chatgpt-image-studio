/* --------------------------------------------------------------
   Black‑minimal UI for the ChatGPT Image Studio (Next.js + webpack)
   -------------------------------------------------------------- */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* --------------------------------------------------------------
   Colour & font
   -------------------------------------------------------------- */
:root {
  color-scheme: dark;
  background: #000;
  color: #f5f5f5;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
body { margin: 0; }

* { box-sizing: border-box; }

button, select, textarea { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }

/* focus ring */
button:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

/* --------------------------------------------------------------
   Page layout
   -------------------------------------------------------------- */
main {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  min-height: 100vh;
}

/* left rail – navigation / controls */
.left-rail {
  border-right: 1px solid #111;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  padding: 20px;
}
.wordmark {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* prompt / model / batch card */
.prompt-card {
  border: 1px solid #151515;
  border-radius: 6px;
  padding: 14px;
}
.field-row {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 90px;
}
label {
  color: #777;
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
select,
textarea {
  background: #050505;
  border: 1px solid #202020;
  border-radius: 6px;
  color: #f5f5f5;
  padding: 10px 12px;
}
textarea {
  line-height: 1.4;
  min-height: 150px;
  resize: vertical;
}

/* {}

/* generate button */
.generate {
  background: #f5f5f5;
  border: 0;
  border-radius: 6px;
  color: #000;
  cursor: pointer;
  font-weight: 700;
  padding: 10px 14px;
}
.generate:disabled {
  background: #2a2a2