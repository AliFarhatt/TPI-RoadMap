The seven-page roadmap template is implemented as a renderer:
`app/js/roadmap.js` (TP_RENDER_ROADMAP). It is GENERATED from the original
prototype markup by optional-tools/build-roadmap-js.py, which splices
view-model interpolations into the frozen design; run that script after any
change to the reference design. It consumes only the roadmap_view_model
(built by app/js/viewmodel.js) and never recalculates anything.
Rendered examples: examples/*/roadmap.html; legacy reference:
examples/legacy-karl/karl-roadmap.html.
