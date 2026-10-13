# Plastics and their substitutes: global trade explorer

An interactive explorer of world trade in plastics and in the natural and mineral materials that could replace them, 2005–2024.

- **First page:** one "pizza" of world exports: plastics by stage of their life cycle, substitutes by raw materials and value-added
  products. The band under it is the same pizza over the years; a click on a slice takes that piece and cuts it by exporter.
- **Explorer:** what (the pizza), where (United Nations map), when (time line). Exporters, importers, flows between economies, the
  balance of each economy, specialisation; a chart and a table for the same questions; profiles of economies and of groups.

Open `dashboard/index.html` in a browser, or serve the folder `dashboard/` as a static site. There is no build step.

## Data
UNCTAD calculations based on UNCTADstat "Plastics trade by partner" and "Trade in non-plastic substitutes" (experimental product
groupings on HS 2022 subheadings; UN Comtrade), and UNCTADstat GDP, population and total merchandise trade.

- Value in current US$ as each economy reports it: exports by the exporter, imports by the importer. Where an economy did not report
  imports, what the reporting economies exported to it is shown instead and marked †.
- "World" is the sum of reporting economies; nothing is estimated for those that did not report. 2024 is provisional.
- The substitute groupings are broad customs headings, many of them traded mainly for other uses: a high value does not mean that
  plastics are being replaced. The methodology panel of the explorer explains every indicator.

## Map
The boundaries and names shown and the designations used on the map do not imply official endorsement or acceptance by the United
Nations. Dotted and dashed lines represent approximate borders for which the final status has not yet been agreed.

## What is in this repository
Only the explorer as it is served: `dashboard/` (page, scripts, data files) and the workflow that publishes it to GitHub Pages.
The pipeline that builds the data files from the UNCTADstat downloads and the automated checks are not included yet.
