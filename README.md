## How to Use

### Install
```sh
npm i build-meta
```

### Import Info Main/Entry JS File
In any js file, import the meta json file and save it to a window object. It's recommended you namespace it to your company name.

```js
import meta from './meta.json';

window.yourcompany = window.yourcompany || {};
window.yourcompany.meta = window.yourcompany.meta || meta;
```