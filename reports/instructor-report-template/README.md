The instructor/administrator report template is implemented as a renderer:
`app/js/report.js` (functions renderIndividualReport / renderGroupReport).
It consumes calculated results only and contains no calculation logic.
Rendered examples: examples/individual-demo/instructor-report.html and
examples/group-demo/group-report.html. Styling is embedded in the renderer
so every generated report is a single self-contained HTML file.
