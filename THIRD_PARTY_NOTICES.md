# Third-party notices

This project embeds the following third-party artwork. No third-party code is
executed at runtime, and the plugin has zero npm dependencies.

## DeepSeek brand artwork

`client.js` embeds two pieces of official DeepSeek artwork:

- the whale silhouette path (`FISH_LOGO_PATH` / `BRAND_ART.fishPath`), and
- the "DeepSeek" wordmark glyph paths used for the brand name.

Both were extracted from the `@deepseek-ai/dsh-client-ui-primitives` package
(version `0.2.2-rc.1`, published by DeepSeek) so that this plugin can recolor
the official mark for its Chat ⇄ Work mode switch without importing the
client primitives package. They are used here for brand identification only;
this project is not an official DeepSeek product.

License of the artwork:

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
