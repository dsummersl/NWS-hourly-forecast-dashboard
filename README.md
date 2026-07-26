# NWS hourly forecast

An interactive rebuild of the National Weather Service **graphical forecast** page —
the one at
[`forecast.weather.gov/MapClick.php?…&FcstType=graphical`](https://forecast.weather.gov/MapClick.php?w0=t&w2=wc&w3=sfcwind&w3u=1&w4=sky&w13u=0&w14u=1&w15u=1&AheadHour=0&Submit=Submit&FcstType=graphical&textField1=36.01&textField2=-79.227&site=all&unit=0&dd=&bw=)
that plots temperature (`w0=t`), wind chill (`w2=wc`), surface wind (`w3=sfcwind`) and
sky cover (`w4=sky`) for a point — built on
**[Observable Framework](https://observablehq.com/framework)**, same shape as the
`well-viz-real-data` app in this repo: Python data loaders fetch live data at build
time, Observable Plot draws it, and a scheduled rebuild republishes.

![dashboard demo](./demo.webm)

## Run it

```bash
npm install                # once
pip install -r scripts/requirements.txt
npm run dev                # dev server at http://127.0.0.1:3000
npm run build              # static site to dist/
```

## License

Licensed under the Apache License, Version 2.0.
