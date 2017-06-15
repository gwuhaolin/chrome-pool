'use strict';
const net = require('net');
const { launch } = require('chrome-launcher');
const chrome = require('chrome-remote-interface');

/**
 * launch Chrome
 * @returns {Promise.<function>} chrome launcher
 */
async function launchChrome(port) {
  return await launch({
    port: port,
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-speech-api',
    ]
  });
}

// https://chromedevtools.github.io/devtools-protocol/
const ShouldEnableBeforeUseProtocolNames = {
  'Animation': true,
  'ApplicationCache': true,
  'CSS': true,
  'CacheStorage': true,
  'Console': true,
  'DOM': true,
  'DOMStorage': true,
  'Database': true,
  'Debugger': true,
  'HeapProfiler': true,
  'IndexedDB': true,
  'Inspector': true,
  'LayerTree': true,
  'Log': true,
  'Network': true,
  'Overlay': true,
  'Page': true,
  'Profiler': true,
  'Security': true,
  'ServiceWorker': true,
}

/**
 * ChromePool used to manage chrome tabs, for reuse tab
 * use #new() static method to make a ChromePool, don't use new ChromePool()
 * #new() is a async function, new ChromePool is useable util #ChromePool.new() to be completed
 */
class ChromePool {

  /**
   * make a new ChromePool
   * @param {object} options
   * {
   *  maxTab: {number} max tab to render pages, default is no limit.
   *  port: {number} chrome debug port, default is random a free port.
   *  protocols: {array} require chrome devtool protocol to enable.
   * }
   * @returns {Promise.<*>}
   */
  static async new(options = {}) {
    let { maxTab = Infinity, port, protocols = [] } = options;
    const chromePoll = new ChromePool();
    chromePoll.chromeLauncher = await launchChrome(port);
    chromePoll.port = chromePoll.chromeLauncher.port;// chrome remote debug port
    chromePoll.protocols = protocols;
    chromePoll.tabs = {};// all tabs manage by this poll
    chromePoll.maxTab = maxTab;
    chromePoll.requireResolveTasks = [];

    chromePoll.shouldEnabledProtocol = new Set(['Page']);
    chromePoll.protocols.forEach(name => {
      if (ShouldEnableBeforeUseProtocolNames[name]) {
        chromePoll.shouldEnabledProtocol.add(name);
      }
    });

    // Request the list of the available open targets/tabs of the remote instance.
    // @see https://github.com/cyrus-and/chrome-remote-interface/#cdplistoptions-callback
    const tabs = await chrome.List({ port: chromePoll.port });

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const { id, type } = tab;
      // ignore background_page
      if (type === 'page') {
        chromePoll.tabs[id] = {
          // is this tab free to use
          free: true,
          // chrome tab control protocol
          protocol: await chromePoll.connectTab(id),
        };
      }
    }
    return chromePoll;
  }

  /**
   * connect to an exited tab for control it
   * @param {string} tabId chrome tab id
   * @return {Promise.<{tabId: *, Page: *, DOM: *, Runtime: *, Network: *}>} tab control client
   */
  async connectTab(tabId) {

    // Connects to a remote instance using the Chrome Debugging Protocol.
    // @see https://github.com/cyrus-and/chrome-remote-interface/#cdpoptions-callback
    const protocol = await chrome({
      target: tabId,
      port: this.port,
    });

    // wait all protocols be enabled
    await Promise.all(Array.from(this.shouldEnabledProtocol).map(name => protocol[name].enable()));

    return protocol;
  }

  /**
   * create a new tab in connected chrome then add it to poll
   * if tab count >= maxTab will not create new tab and return undefined
   * @return {Promise.<string>} tabId
   */
  async createTab() {
    const tabCount = Object.keys(this.tabs).length;
    if (tabCount < this.maxTab) {

      // Create a new target/tab in the remote instance.
      // @see https://github.com/cyrus-and/chrome-remote-interface/#cdpnewoptions-callback
      const tab = await chrome.New({ port: this.port });

      const { id } = tab;
      this.tabs[id] = {
        free: true,
        protocol: await this.connectTab(id),
      };
      return id;
    }
  }

  /**
   * get now is free tab to do job then set this tab to be busy util call #release() on this tab
   * @return {Promise.<{tabId: *, Page: *, DOM: *, Runtime: *, Network: *}|*>}
   */
  async require() {
    // find the first free tab for return
    let tabId = Object.keys(this.tabs).find(id => this.tabs[id].free);
    if (tabId === undefined) {
      // no free tab now
      tabId = await this.createTab();
      // up to maxTab limit, should wait for tab release
      if (tabId === undefined) {
        tabId = await new Promise((resolve) => {
          // first in first out
          this.requireResolveTasks.push(resolve);
        });
      }
    }
    const tab = this.tabs[tabId];
    tab.free = false;
    return {
      tabId,
      protocol: tab.protocol,
    };
  }

  /**
   * call on a tab when your job on this tab is finished
   * @param {string} tabId
   */
  release(tabId) {
    let tab = this.tabs[tabId];
    // navigate this tab to blank to release this tab's resource
    // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-navigate
    tab.free = true;
    tab.protocol.Page.navigate({ url: 'about:blank' });
    if (this.requireResolveTasks.length > 0) {
      const resolve = this.requireResolveTasks.shift();
      resolve(tabId);
    } else {
      clearTimeout(this.cleanTimer);
      this.cleanTimer = setTimeout(this.cleanTabs.bind(this), 5000);
    }
  }

  /**
   * clean free tabs left one
   */
  cleanTabs() {
    // all free tabs now
    const freeTabs = Object.keys(this.tabs).filter(tabId => this.tabs[tabId].free);
    // close all free tabs left one
    freeTabs.slice(1).forEach(this.closeTab.bind(this));
  }

  /**
   * close tab and remove it from this.tabs
   * @param tabId
   * @returns {Promise.<void>}
   */
  async closeTab(tabId) {
    try {
      // https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-closeTarget
      await chrome.Close({
        port: this.port,
        id: tabId,
      });
      delete this.tabs[tabId];
    } catch (err) {
      throw err;
    }
  }

  /**
   * close chrome and release all resource used by this poll
   * @return {Promise.<void>}
   */
  async destroyPoll() {
    await this.chromeLauncher.kill();
    delete this.tabs;
    delete this.chromeLauncher;
    delete this.port;
    delete this.requireResolveTasks;
  }

}

module.exports = ChromePool;
