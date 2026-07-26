Leveraging the [Observable Framework](https://observablehq.com/framework), this project recreates the National Weather Service's hourly graphical forecast as an interactive meteogram, sourcing live data directly from the NWS National Digital Forecast Database (NDFD) public API. The Python loader fetches, flattens, and converts forecast data to a unified hourly grid, incorporating temperature, wind, sky cover, and precipitation metrics, then visualizes them via Observable Plot. The app handles unit conversion and localizes wall-clock times to forecast region, computes sunrise/sunset for shading, and builds a responsive dashboard with crosshair details and sortable tables, all without the need for an API key. Scheduled rebuilds (see [GitHub Actions template](https://github.com/features/actions)) keep the forecast current, with a composable workflow for easy deployment.

**Key findings and features:**
- Direct API use enables hourly detail and unit conversion for robust, accurate local forecasts.
- Flat hourly expansion fixes mismatched element intervals from the NDFD API.
- Cross-browser, theme-adaptable visualization with well-separated series and interactive panels.
- Loader computes sunrise/sunset locally to supplement missing API elements.
- Open-source build/deploy pipeline for reproducible, automated updates.
