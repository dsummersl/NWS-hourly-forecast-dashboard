# NWS hourly forecast dashboard

An interactive version of the [National Weather Service hourly forecast](https://forecast.weather.gov/MapClick.php?w0=t&w2=wc&w3=sfcwind&w3u=1&w4=sky&w13u=0&w14u=1&w15u=1&AheadHour=0&Submit=Submit&FcstType=graphical&textField1=36.01&textField2=-79.227&site=all&unit=0&dd=&bw=) page.

Visit [this hourly forecast on github pages](https://dsummersl.github.io/NWS-hourly-forecast-dashboard).


[dashboard demo video](./demo.webm)

## Run it

```bash
npm install                # once
pip install -r scripts/requirements.txt
npm run dev                # dev server at http://127.0.0.1:3000
npm run build              # static site to dist/
```

## License

Licensed under the Apache License, Version 2.0.
