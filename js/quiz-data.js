// The design quiz. Edit this file to add, reword or reorder questions.
//
// It is a plain script rather than a JSON file so the page still works when opened
// straight from disk, the same reason js/picks-data.js is a script.
//
// Each question: an id (used in the emailed result and in the ?q= link), a title, an
// optional note, and 2-6 options. Each option: a label, an optional note, and an
// image. Images can be drawings (scripts/build_quiz_art.py) or photos - any path the
// browser can load. Photos are fitted inside the tile, never cropped.
//
// Not every client needs every question. /quiz-builder picks a subset and writes the
// link; the ids below are what ends up in it.
window.QUIZ = {
  title: "Design quiz",
  blurb: "A few quick questions so I build the details the way you actually want them. No wrong answers, and nothing here is binding.",
  questions: [
    {
      id: "window-door-trim",
      title: "Window &amp; door trim",
      note: "Same window, same wall, same paint. Only the casing changes.",
      options: [
        { label: "Square cut", note: "Flat boards, square ends, a plain header on top",
          image: "images/quiz/01-window-door-trim/square-cut.svg" },
        { label: "22° angle", note: "Header ends cut back, a gentle flare",
          image: "images/quiz/01-window-door-trim/22-degree-angle.svg" },
        { label: "45° angle", note: "The same cut, steeper and more pronounced",
          image: "images/quiz/01-window-door-trim/45-degree-angle.svg" },
        { label: "Standard casing", note: "Milled profile, mitred corners, the conventional look",
          image: "images/quiz/01-window-door-trim/standard-casing.svg" }
      ]
    },
    {
      id: "interior-doors",
      title: "Interior doors",
      note: "Same opening, same casing. Only the door changes.",
      options: [
        { label: "Flat slab", note: "No panels at all, flush and modern",
          image: "images/quiz/02-interior-doors/flat-slab.svg" },
        { label: "Two panel", note: "Two tall recesses, quiet and current",
          image: "images/quiz/02-interior-doors/two-panel.svg" },
        { label: "Three panel", note: "A little more detail, still simple",
          image: "images/quiz/02-interior-doors/three-panel.svg" },
        { label: "Five panel", note: "What most houses round here were built with",
          image: "images/quiz/02-interior-doors/five-panel.svg" }
      ]
    },
    {
      id: "baseboard",
      title: "Baseboard height",
      note: "Shown against a door casing, so you can see the difference.",
      options: [
        { label: "3¼ inch", note: "Standard. Disappears into the room",
          image: "images/quiz/03-baseboard/three-quarter.svg" },
        { label: "5¼ inch", note: "Taller, and reads as deliberate",
          image: "images/quiz/03-baseboard/five-quarter.svg" },
        { label: "7¼ inch", note: "Tall. Suits an older house with high ceilings",
          image: "images/quiz/03-baseboard/seven-quarter.svg" }
      ]
    },
    {
      id: "deck-railing",
      title: "Deck railing",
      note: "Same posts and rails. Only what fills the gap changes.",
      options: [
        { label: "Black metal", note: "Thin balusters, least in the way of a view",
          image: "images/quiz/04-deck-railing/black-metal.svg" },
        { label: "Wood picket", note: "Painted boards, the traditional one",
          image: "images/quiz/04-deck-railing/wood-picket.svg" },
        { label: "Cable", note: "Nearly invisible from a few feet back",
          image: "images/quiz/04-deck-railing/cable.svg" },
        { label: "Horizontal slat", note: "Boards run sideways. More privacy, more shade",
          image: "images/quiz/04-deck-railing/horizontal-slat.svg" }
      ]
    },
    {
      id: "porch-ceiling",
      title: "Porch ceiling",
      note: "Tongue and groove boards, finished four ways.",
      options: [
        { label: "Stained", note: "Warm, and hides a lot",
          image: "images/quiz/05-porch-ceiling/stained.svg" },
        { label: "Painted white", note: "Bounces light back down onto the porch",
          image: "images/quiz/05-porch-ceiling/painted-white.svg" },
        { label: "Natural cedar", note: "Left to go its own colour over time",
          image: "images/quiz/05-porch-ceiling/natural-cedar.svg" },
        { label: "Haint blue", note: "The Southern one. Pale blue-green",
          image: "images/quiz/05-porch-ceiling/haint-blue.svg" }
      ]
    },
    {
      id: "hardware-finish",
      title: "Hardware finish",
      note: "Whatever you pick, every handle in the room should match it.",
      options: [
        { label: "Matte black", note: "High contrast, very current",
          image: "images/quiz/06-hardware-finish/matte-black.svg" },
        { label: "Brass", note: "Warm. Looks better the older it gets",
          image: "images/quiz/06-hardware-finish/brass.svg" },
        { label: "Brushed nickel", note: "Quiet, and hides fingerprints",
          image: "images/quiz/06-hardware-finish/brushed-nickel.svg" },
        { label: "Oil-rubbed bronze", note: "Dark brown, softer than black",
          image: "images/quiz/06-hardware-finish/oil-rubbed-bronze.svg" }
      ]
    },
    {
      id: "crown-moulding",
      title: "Crown moulding",
      note: "Where the wall meets the ceiling.",
      options: [
        { label: "None", note: "A clean line. Nothing to collect dust",
          image: "images/quiz/07-crown-moulding/none.svg" },
        { label: "Single cove", note: "One piece, a soft curve",
          image: "images/quiz/07-crown-moulding/single-cove.svg" },
        { label: "Two piece", note: "More depth and a stronger shadow",
          image: "images/quiz/07-crown-moulding/two-piece.svg" },
        { label: "Built up", note: "Three pieces stacked. For a formal room",
          image: "images/quiz/07-crown-moulding/built-up.svg" }
      ]
    }
  ]
};
