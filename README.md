[![Build Status](https://travis-ci.org/gwuhaolin/chrome-pool.svg?branch=master)](https://travis-ci.org/gwuhaolin/chrome-pool)
[![Npm Downloads](http://img.shields.io/npm/dm/chrome-pool.svg?style=flat-square)](https://www.npmjs.com/package/chrome-pool)
[![Dependency Status](https://david-dm.org/gwuhaolin/chrome-pool.svg?style=flat-square)](https://npmjs.org/package/chrome-pool)

[![NPM](https://nodei.co/npm/chrome-pool.png)](https://nodei.co/npm/chrome-pool/)

# chrome-pool
Headless chrome tabs manage pool, concept come from database connection pool for reuse chrome tab improve performance.

## Use
1. install from npm by `npm i chrome-pool`



2. start ChromePool:
  ```js
  const ChromePool = require('chrome-pool');
  
  const chromePoll = await ChromePool.new();
  await chromePoll.destroyPoll();
  ```
  
  `await ChromePool.new()` will make a new ChromePool and start a new chrome. A ChromePool means a chrome.
   
  static method new() support options:
  - `maxTab`: {number} max tab to render pages, default is no limit.
  - `port`: {number} chrome debug port, default is random a free port.
  - `protocols`: {array} require chrome devtool protocol to be enable before use. e.g `['Network','Log']`.
  
  
  `await chromePoll.destroyPoll()` can release all resource used by this pool, kill chrome.


    
3. require a tab to use:
```js
// require a free tab from pool to use
const { tabId,protocol } = await chromeTabsPoll.require();
// tabId
const { Page,Target,Network,...} = protocol;
```    
  `await chromeTabsPoll.require()` will return a object with prop:
  - `tabId`: chrome tab id.
  - `protocol`: chrome remote control protocol. 


    
4. use protocol to control tab:
```js
const { Page,Target,Network,...} = protocol;
```    
protocol detail use see [chrome-devtools-protocol doc](https://chromedevtools.github.io/devtools-protocol/).


 
5. after use a tab release it to pool:
```js
chromeTabsPoll.release(tabId);
```

see [test](./index.test.js) for more use case.

## Dependencies
1. [Chrome 59+](https://www.google.com/chrome/browser/desktop/index.html) should install on you system
2. Nodejs 7+

## Friends
- [chrome-render](https://github.com/gwuhaolin/chrome-render) general server render base on chrome.
- [koa-chrome-render](https://github.com/gwuhaolin/koa-chrome-render) chrome-render middleware for koa
- [koa-seo](https://github.com/gwuhaolin/koa-seo) koa SEO middleware
