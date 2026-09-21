/*
  ============================================================
  YOUR WORK PHOTOS
  ============================================================

  1. Copy your photos into the folder:  images/work/
  2. Add one entry per photo to the list below.
  3. Save this file and refresh the website.

  Each entry:
    file:     the photo's file name, exactly as it is in images/work/
    title:    short name for the project
    town:     where it was done (optional)
    type:     which gallery filter it goes under. Use one of:
              framing, sheetrock, trim, flooring, decks,
              pergolas, porches, woodwork, carports, remodels
    featured: true = also show it in "Selected work" on the home page
              (the first 6 featured photos are used)

  Tips:
  - Photos show in the gallery in the same order as this list.
  - JPG or WEBP around 1600px wide keeps the site fast. Shrink big phone photos
    first, and fill in w and h with the new size.
  - If you change which photo is first, update the matching "preload" line
    near the top of gallery.html so the first photo still loads fastest.
  - If a file name is wrong or missing, a blank placeholder shows instead.
  - Every entry needs a comma after its closing }.
*/

window.PHOTOS = [
  { file: "whole-home-remodel-front-porch.jpg", w: 1600, h: 747,      title: "Whole-home remodel with covered front porch", town: "", type: "remodels", featured: true },
  { file: "timber-pavilion-and-carport.jpg", w: 1600, h: 1200,         title: "Timber pavilion and carport",                 town: "", type: "carports", featured: true },
  { file: "screened-porch-raised-deck.jpg", w: 1600, h: 1200,          title: "Screened porch on a raised deck",             town: "", type: "porches",  featured: true },
  { file: "gable-carport-timber-trusses.jpg", w: 1200, h: 1200,        title: "Gable carport with timber trusses",           town: "", type: "carports", featured: true },
  { file: "elevated-deck-black-balusters.webp", w: 500, h: 667,      title: "Elevated deck with black balusters",          town: "", type: "decks",    featured: true },
  { file: "vaulted-carport-ceiling.jpg", w: 1125, h: 1500,             title: "Vaulted tongue-and-groove carport ceiling",   town: "", type: "carports", featured: true },
  { file: "stained-tongue-groove-porch-ceiling.jpg", w: 747, h: 1600, title: "Stained tongue-and-groove porch ceiling",     town: "", type: "woodwork" },
  { file: "bathroom-remodel-glass-shower.jpg", w: 747, h: 1600,       title: "Bathroom remodel with glass shower",          town: "", type: "remodels" },
  { file: "mudroom-bench-coat-hooks.webp", w: 500, h: 666,           title: "Mudroom bench with coat hooks",               town: "", type: "woodwork" },
  { file: "screened-porch-corner-view.jpg", w: 1600, h: 1200,          title: "Screened porch, corner view",                 town: "", type: "porches" },
  { file: "outdoor-grill-station-shelf-wall.jpg", w: 1600, h: 1200,    title: "Outdoor grill station with shelf wall",       town: "", type: "woodwork" },
  { file: "deck-stairs-to-walkway.webp", w: 500, h: 667,             title: "Deck stairs down to the walkway",             town: "", type: "decks" },
  { file: "bathroom-plank-ceiling-tile-shower.jpg", w: 1200, h: 1600,  title: "Bathroom with plank ceiling and tile shower", town: "", type: "remodels" },
  { file: "gable-carport-side-view.jpg", w: 1200, h: 1047,             title: "Gable carport, side view",                    town: "", type: "carports" },
  { file: "remodel-back-porch-window-wall.jpg", w: 1600, h: 747,      title: "Remodel: back porch and window wall",         town: "", type: "remodels" },
  { file: "pavilion-rafters-and-shelf-wall.jpg", w: 1200, h: 1600,     title: "Pavilion rafters and shelf wall",             town: "", type: "carports" },
  { file: "shop-lean-to-carport.webp", w: 1000, h: 1333,               title: "Lean-to carport on a shop",                   town: "", type: "carports" },
  { file: "remodel-exterior-stairs-balcony.jpg", w: 1600, h: 747,     title: "Remodel: exterior stairs and balcony",        town: "", type: "remodels" },
  { file: "remodel-side-siding-gutters.jpg", w: 1600, h: 747,         title: "Remodel: new siding and gutters",             town: "", type: "remodels" },
  { file: "timber-pavilion-in-progress.jpg", w: 1600, h: 1200,         title: "Timber pavilion taking shape",                town: "", type: "carports" },
  { file: "timber-pavilion-framing.jpg", w: 1600, h: 1200,             title: "Timber pavilion, framing stage",              town: "", type: "carports" },
];

/* Close-up photo for the "The approach" section on the home page.
   Put the file in images/work/ and write its name here, e.g. "trim-detail.jpg". */
window.DETAIL_PHOTO = "stained-tongue-groove-porch-ceiling.jpg";
