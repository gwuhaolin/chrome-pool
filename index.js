'use strict';
const net = require('net');
const { launchWithHeadless, launchWithoutNoise } = require('chrome-runner');
const chrome = require('chrome-remote-interface');
const ProtocolDomains = require('chrome-remote-interface/lib/protocol.json').domains;

/**
 * launch Chrome
 */
async function launchChrome(runnerOptions) {
  let runner;
  if (process.env.SHOW_CHROME) {
    runner = await launchWithoutNoise(runnerOptions);
  } else {
    runner = await launchWithHeadless(runnerOptions);
  }
  return runner;
}

/**
 * chrome remote interface protocols data, enable should enable protocols before use
 */
const DomainData = {};
ProtocolDomains.forEach((domain) => {
  const { domain: name, events: domainEvents = [], commands: domainCommands = [] } = domain;
  const hasEnableCommand = domainCommands.findIndex(({ name }) => name === 'enable') >= 0;
  const events = domainEvents.map(({ name }) => name);
  DomainData[name] = {
    hasEnableCommand,
    events,
  }
});

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
   *  chromeRunnerOptions: {object} options from chrome-runner and will pass to chrome-runner when launch chrome
   *  protocols: {array} require chrome devtool protocol to enable.
   * }
   * @returns {Promise.<*>}
   */
  static async new(options = {}) {
    let { maxTab = Infinity, port, protocols = [], chromeRunnerOptions } = options;
    const chromePoll = new ChromePool();
    chromePoll.chromeRunner = await launchChrome(Object.assign({}, chromeRunnerOptions, { port }));
    chromePoll.port = chromePoll.chromeRunner.port;// chrome remote debug port
    chromePoll.protocols = protocols;
    chromePoll.tabs = {};// all tabs manage by this poll
    chromePoll.maxTab = maxTab;
    chromePoll.requireResolveTasks = [];

    chromePoll.shouldEnabledProtocol = new Set(['Page']);
    chromePoll.protocols.forEach(name => {
      if (DomainData[name].hasEnableCommand) {
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
   * @param {boolean} clear - navigate to about:blank after release
   */
  async release(tabId, clear = true) {
    let tab = this.tabs[tabId];

    // navigate this tab to blank to release this tab's resource
    // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-navigate
    if (clear) {
      await tab.protocol.Page.navigate({url: 'about:blank'});
    }
    tab.free = true;

    // remove all listeners to fix MaxListenersExceededWarning: Possible EventEmitter memory leak detected
    this.protocols.forEach((domainName) => {
      const { events } = DomainData[domainName];
      events.forEach((eventName) => {
        tab.protocol.removeAllListeners(`${domainName}.${eventName}`);
      });
    });

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
    await this.chromeRunner.kill();
    clearTimeout(this.cleanTimer);
    delete this.cleanTimer;
    delete this.tabs;
    delete this.chromeRunner;
    delete this.port;
    delete this.requireResolveTasks;
  }

}

module.exports = ChromePool;
