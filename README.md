# codedoodl.es

A curated showcase of creative coding sketches, preserved for self-hosting.
The original service closed in 2020. This fork modernizes its application and
container while retaining the original artwork, visual design, URLs and credits.
The original Chrome extension and submission service are historical integrations.

## Local development

Use **Node 24.21.0 / npm 11.19.0** and clone the
[artwork archive](https://github.com/treyturner/codedoodl.es-doodles) beside this
repository as `../codedoodl.es-doodles`:

```bash
nvm install
nvm use
npm ci
npm run dev
```

Open http://localhost:3002. BrowserSync reloads browser and server changes, and
the app serves the sibling archive through the same origin. `DOODLES_ARCHIVE`
selects another local checkout; `DOODLES_URL` selects a remote archive host.
See [building and development](docs/build.md).

## Container

```bash
docker build -t codedoodles:local .
docker run --rm -p 3000:3000 \
  -e BASE_URL=https://doodles.example.com \
  -e DOODLES_URL=https://artwork.example.com \
  -e DOODLE_DATA_SOURCE=production codedoodles:local
```

Replace the example URLs with your public app and archive origins. Configure the
archive host to serve gzip bytes under their original filenames with the correct
MIME type and Content-Encoding. The runtime runs compiled JavaScript as a
non-root user. Current desktop browsers and mobile Safari/Chrome are supported;
IE support has been retired. Individual archived sketches retain their original
mobile/GPU limitations.

Sketch numbers and short URLs retain their original identities. Fury Ribbons
(#073) is omitted because its artwork was missing from the archive. Boobs (#074)
is unpublished by editorial choice. These numbering gaps are intentional;
renumbering later sketches would change shortlink routing. The API also excludes
these slugs when an older upstream master still lists them.

The image defaults to production mode and production archive manifests. Set
`DOODLE_DATA_SOURCE=development` to select the remote DEV master. Listener ports
use `BIND_PORT`, then `PORT`, then the application default. CI checks these image
defaults with `bash scripts/test-container.sh IMAGE` before publication. The
checks launch the real image command under a one-CPU quota and cover its single
application process, archive requests, password assets/sessions and shutdown.
Standalone password-page styles and the original social-preview image ship in
the image; see [restored asset provenance](docs/restored-assets.md).

## Working on the project

- [Setup, commands and local sketch tools](docs/build.md)
- [Server configuration and environment variables](docs/server.md)
- [Browser behavior and retained dependency exception](docs/browser.md)
- [Container/browser/artwork tests](docs/testing.md): `npm test`
- [Dependency audits and update policy](docs/security.md): `npm run audit:dependencies`
- [Candidate publication, promotion and rollback](docs/release.md)
- [Contribution guide](CONTRIBUTING.md) and [original artwork criteria](docs/criteria.md)

Local sketch creation and preview are supported. The original AWS/S3 publishing,
email and review automation is preserved in [legacy documentation](legacy/README.md)
and excluded from the default dependency graph. The disabled webhook remains disabled.

### Thanks

This project is a [FLUUUID](http://FLUUU.ID) production - but we just created the infrastructure to allow this to happen, the real thanks goes to the digital artists who have contributed doodles:

**[Edan Kwan](http://www.edankwan.com/) ([tw](http://twitter.com/edankwan), [gh](http://github.com/edankwan)) \ [Jon Andersson](http://jonandersson.se) ([tw](http://twitter.com/andersson_jon), [gh](http://github.com/j0n)) \ [Pablo Cabana](http://caostar.com/thoughts/) ([tw](http://twitter.com/pablocabana), [gh](http://github.com/caostar)) \ [Damien Seguin](http://dmnsgn.me/) ([tw](http://twitter.com/dmnsgn), [gh](http://github.com/dmnsgn)) \ [Anders Hoff](http://inconvergent.net) ([tw](http://twitter.com/inconvergent), [gh](http://github.com/inconvergent)) \ [Rauri Rochford](http://www.esquemedia.com) ([tw](http://twitter.com/raurir), [gh](http://github.com/raurir)) \ [Fred Briolet](http://fredericbriolet.com/) ([tw](http://twitter.com/fredbriolet), [gh](http://github.com/FredericBriolet)) \ [Nicolas Barradeau](http://www.barradeau.com) ([tw](http://twitter.com/nicoptere), [gh](http://github.com/nicoptere)) \ [André Venâncio](https://andrevenancio.com) ([tw](http://twitter.com/andrevenancio), [gh](http://github.com/andrevenancio)) \ [Mat Groves](http://www.goodboydigital.com/) ([tw](http://twitter.com/doormat23), [gh](http://github.com/GoodBoyDigital)) \ [Tim Holman](http://tholman.com) ([tw](http://twitter.com/twholman), [gh](http://github.com/tholman)) \ [Samsy](http://samsy.ninja) ([tw](http://twitter.com/Samsyyyy), [gh](http://github.com/Samsy)) \ [Sterling Crispin](http://www.sterlingcrispin.com) ([tw](http://twitter.com/sterlingcrispin), [gh](http://github.com/sterlingcrispin)) \ [Florian Morel](http://ayamflow.fr) ([tw](http://twitter.com/ayamflow), [gh](http://github.com/ayamflow)) \ [Damien Mortini](http://dmmn.io) ([tw](http://twitter.com/d_m_m_n_), [gh](http://github.com/dmmn)) \ [Justin Windle](http://soulwire.co.uk) ([tw](http://twitter.com/soulwire), [gh](http://github.com/soulwire)) \ [Silvio Paganini](http://s2paganini.com) ([tw](http://twitter.com/silviopaganini), [gh](http://github.com/silviopaganini)) \ [Gwen Vanhee](http://nocomputer.be) ([tw](http://twitter.com/wearenocomputer), [gh](http://github.com/gwenvanhee)) \ [Diego Montoya](http://www.diego-montoya.com) ([tw](http://twitter.com/diego_montoya_), [gh](http://github.com/montoyadiego)) \ [Jay Weeks](http://jayweeks.com) ([tw](http://twitter.com/jpweeks), [gh](http://github.com/jpweeks)) \ [zadvorsky](http://zadvorsky.com) ([tw](http://twitter.com/zadvorsky), [gh](http://github.com/zadvorsky)) \ [Neil Carpenter](http://neilcarpenter.com) ([tw](http://twitter.com/neilcarpenter), [gh](http://github.com/neilcarpenter)) \ [Manny Tan](http://uncontrol.com) ([tw](http://twitter.com/mannytan), [gh](http://github.com/mannytan)) \ [Yi-Wen Lin](http://blog.bongiovi.tw/) ([tw](http://twitter.com/yiwen_lin), [gh](http://github.com/yiwenl)) \ [cabbibo](http://cabbi.bo) ([tw](http://twitter.com/cabbibo), [gh](http://github.com/cabbibo)) \ [Robin Delaporte](http://robindelaporte.fr) ([tw](http://twitter.com/not__robin), [gh](http://github.com/robin-dela)) \ [Bruno Imbrizi](http://brunoimbrizi.com) ([tw](http://twitter.com/brunoimbrizi), [gh](http://github.com/brunoimbrizi)) \ [Jérémie Boulay](http://jeremieboulay.fr) ([tw](http://twitter.com/JeremBoo), [gh](http://github.com/Jeremboo)) \ [Thomas Hooper](http://www.stainlessvision.com/) ([tw](http://twitter.com/tdhooper), [gh](http://github.com/tdhooper)) \ [Georgiana Blantin](http://codepen.io/giana/) ([tw](http://twitter.com/gianablantin), [gh](http://github.com/GianaB)) \ [Xiaohan Zhang](http://www.hellochar.com/) ([tw](http://twitter.com/hellocharlien), [gh](http://github.com/hellochar)) \ [Fábio Azevedo](http://icantcontrolmyego.net) ([tw](http://twitter.com/naso), [gh](http://github.com/naso)) \ [William Mapan](http://wllmpn.com/) ([tw](http://twitter.com/williamapan), [gh](http://github.com/williamapan)) \ [Karol Stopyra](http://stopyransky.com) ([tw](http://twitter.com/stopyransky), [gh](http://github.com/stopyransky)) \ [Taylor Baldwin](https://tbaldw.in) ([tw](http://twitter.com/taylorbaldwin), [gh](http://github.com/rolyatmax)) \ [grgrdvrt](http://www.grgrdvrt.com) ([tw](http://twitter.com/grgrdvrt), [gh](http://github.com/grgrdvrt)) \ [David Paul Rosser](http://ivxvixviii.io) ([tw](http://twitter.com/ivxvixviii), [gh](http://github.com/ivxvixviii)) \ [Godart Raets](http://www.gdart.be/intro.html) ([tw](http://twitter.com/SirSmoooth), [gh](http://github.com/SirGodart)) \ [Felix Woitzel](http://www.cake23.de) ([tw](http://twitter.com/Flexi23), [gh](http://github.com/Flexi23))**
