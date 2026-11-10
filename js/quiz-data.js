// The design quiz. Edit this file to add, reword or reorder questions.
//
// It is a plain script rather than a JSON file so the page still works when opened
// straight from disk, the same reason js/picks-data.js is a script.
//
// Each question: an id (used in the emailed result), a title, an optional note, and
// 2-6 options. Each option: a label, an optional note, and an image. Images can be
// drawings (scripts/build_quiz_art.py) or photos - any path the browser can load.
// Photos are never cropped by anything here; they are fitted inside the tile.
window.QUIZ = {
  title: "Design quiz",
  blurb: "A few quick questions so I build the details the way you actually want them. No wrong answers, and nothing here is binding.",
  questions: [
    {
      id: "window-door-trim",
      title: "Window &amp; door trim",
      note: "Same window, same wall, same paint. Only the casing changes.",
      options: [
        {
          label: "Square cut",
          note: "Flat boards, square ends, a plain header on top",
          image: "images/quiz/01-window-door-trim/square-cut.svg"
        },
        {
          label: "22° angle",
          note: "Header ends cut back, a gentle flare",
          image: "images/quiz/01-window-door-trim/22-degree-angle.svg"
        },
        {
          label: "45° angle",
          note: "The same cut, steeper and more pronounced",
          image: "images/quiz/01-window-door-trim/45-degree-angle.svg"
        },
        {
          label: "Standard casing",
          note: "Milled profile, mitred corners, the conventional look",
          image: "images/quiz/01-window-door-trim/standard-casing.svg"
        }
      ]
    },
    {
      id: "interior-doors",
      title: "Interior doors",
      note: "Same opening, same casing. Only the door changes.",
      options: [
        {
          label: "Flat slab",
          note: "No panels at all, flush and modern",
          image: "images/quiz/02-interior-doors/flat-slab.svg"
        },
        {
          label: "Two panel",
          note: "Two tall recesses, quiet and current",
          image: "images/quiz/02-interior-doors/two-panel.svg"
        },
        {
          label: "Three panel",
          note: "A little more detail, still simple",
          image: "images/quiz/02-interior-doors/three-panel.svg"
        },
        {
          label: "Five panel",
          note: "What most houses round here were built with",
          image: "images/quiz/02-interior-doors/five-panel.svg"
        }
      ]
    }
  ]
};
