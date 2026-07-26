// See https://observablehq.com/framework/config for documentation.
export default {
  title: "Hourly Forecast",

  // The path to the source root.
  root: "src",

  footer: `Built ${new Date().toLocaleString("en-US", {
    dateStyle: "medium", timeStyle: "short",
  })}`,

  toc: false,
  sidebar: false,
  pager: false,
};
