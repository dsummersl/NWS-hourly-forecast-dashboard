// See https://observablehq.com/framework/config for documentation.
export default {
  title: "Hourly Forecast",

  root: "src",

  head: `
    <link rel="manifest" href="./manifest.json">
    <link rel="icon" type="image/svg+xml" href="./icon.svg">
    <link rel="apple-touch-icon" href="./icon.svg">
    <meta name="theme-color" content="#0f172a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  `,

  footer: `Built ${new Date().toLocaleString("en-US", {
    dateStyle: "medium", timeStyle: "short",
  })}`,

  toc: false,
  sidebar: false,
  pager: false,
};
