[![Npm Package](https://img.shields.io/npm/v/chrome-pool.svg?style=flat-square)](https://www.npmjs.com/package/chrome-pool)
[![Build Status](https://img.shields.io/travis/gwuhaolin/chrome-pool.svg?style=flat-square)](https://travis-ci.org/gwuhaolin/chrome-pool)
[![Dependency Status](https://david-dm.org/gwuhaolin/chrome-pool.svg?style=flat-square)](https://npmjs.org/package/chrome-pool)
[![Npm Downloads](http://img.shields.io/npm/dm/chrome-pool.svg?style=flat-square)](https://www.npmjs.com/package/chrome-pool)


# chrome-pool
Headless chrome tabs manage pool, concept come from database connection pool for reuse chrome tab improve performance.

## Use
#### 1. install from npm by `npm i chrome-pool`


#### 2. start ChromePool:
  ```js
  const ChromePool = require('chrome-pool');
  
  const chromePoll = await ChromePool.new(options);
  await chromePoll.destroyPoll();
  ```
  
  `await ChromePool.new()` will make a new ChromePool and start a new chrome. A ChromePool means a chrome.
   
  static method new() support options:
  - `maxTab`: {number} max tab to render pages, default is no limit.
  - `port`: {number} chrome debug port, default is random a free port.
  - `chromeRunnerOptions`: {object} options from [chrome-runner](https://github.com/gwuhaolin/chrome-runner#options) and will pass to chrome-runner when launch chrome
  - `protocols`: {array} require chrome devtool protocol to be enable before use. e.g `['Network','Log']`.
  
  
  `await chromePoll.destroyPoll()` can release all resource used by this pool, kill chrome.


#### 3. require a tab to use:
```js
// require a free tab from pool to use
const { tabId,protocol } = await chromeTabsPoll.require();
// tabId
const { Page,Target,Network,...} = protocol;
```    
  `await chromeTabsPoll.require()` will return a object with prop:
  - `tabId`: chrome tab id.
  - `protocol`: chrome remote control protocol. 

    
#### 4. use protocol to control tab:
```js
const { Page,Target,Network,...} = protocol;
```    
protocol detail use see [chrome-devtools-protocol doc](https://chromedevtools.github.io/devtools-protocol/).
all protocol required be enable before use has been enable by chrome-pool.
 
#### 5. after use a tab release it to pool:
```js
await chromeTabsPoll.release(tabId);
```
`release` will release all resource used by this tab include removeAllListeners, so you don't need to removeListener by yourself.
By default `release` will navigate tab to `about:blank` to reduce chrome resource use, you can close this feature by call `chromeTabsPoll.release(tabId,false)`


#### 6. show chrome
In dev time, you may want to know what chrome are doing rather than let chrome run in headless.
You can set env `SHOW_CHROME=true` when run your nodejs app to disable headless to debug chrome.


see [test](test/index.test.js) for more use case.

#### Notice [chrome 59+](https://www.google.com/chrome/browser/desktop/index.html) must install on you system

## Friends
- [chrome-render](https://github.com/gwuhaolin/chrome-render) general server render base on chrome.
- [chrome-runner](https://github.com/gwuhaolin/chrome-runner) launch chrome by code.
- [koa-chrome-render](https://github.com/gwuhaolin/koa-chrome-render) chrome-render middleware for koa
- [koa-seo](https://github.com/gwuhaolin/koa-seo) koa SEO middleware
