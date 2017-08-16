'use strict';
const ChromePool = require('../index');
const assert = require('assert');

process.on('unhandledRejection', console.trace);

describe('#ChromePool', function () {
  this.timeout(5000);

  it('#new() #destroyPoll()', async () => {
    const chromePoll = await ChromePool.new();
    Object.keys(chromePoll.tabs).forEach(tabId => {
      const { free, protocol } = chromePoll.tabs[tabId];
      assert.equal(free, true);
      assert.notEqual(protocol, null);
      console.log(tabId);
    });
    return await chromePoll.destroyPoll();
  });

  it('#createTab()', async () => {
    const chromePoll = await ChromePool.new();
    const tabId = await chromePoll.createTab();
    console.log(tabId);
    const tab = chromePoll.tabs[tabId];
    const { free, protocol } = tab;
    assert.equal(free, true);
    assert.notEqual(protocol, null);
    return await chromePoll.destroyPoll();
  });

  it('#createTab() set maxTab', async function () {
    this.timeout(15000);
    const maxTab = 4;
    let chromePoll = await ChromePool.new({
      maxTab,
    });
    assert.equal(chromePoll.maxTab, maxTab);
    const { tabId: tabId1 } = await chromePoll.require();
    const { tabId: tabId2 } = await chromePoll.require();
    const { tabId: tabId3 } = await chromePoll.require();
    const { tabId: tabId4 } = await chromePoll.require();
    assert.equal(Object.keys(chromePoll.tabs).length, maxTab, `open tabs should be equal to ${maxTab}`);
    console.log(`${maxTab} tabs has created, next require will return util a tab has be released after 2s`);
    setTimeout(async () => {
      await chromePoll.release(tabId1);
      await chromePoll.release(tabId2);
      await chromePoll.release(tabId3);
      await chromePoll.release(tabId4);
      Object.keys(chromePoll.tabs).forEach(tabId => {
        assert.equal(chromePoll.tabs[tabId].free, true, 'all tabs should be free now');
      });
    }, 2000);
    // wait 9S
    await new Promise((resolve) => {
      setTimeout(resolve, 9000);
    });
    assert.equal(Object.keys(chromePoll.tabs).length, 1, 'after cleanTabs,should left 1 tab');
    await chromePoll.require();
    await chromePoll.require();
    assert.equal(Object.keys(chromePoll.tabs).length, 2, 'after require tab,should left 1 tab');
    return await chromePoll.destroyPoll();
  });

  it('#require() #release()', async () => {
    const chromePoll = await ChromePool.new();
    const client = await chromePoll.require();
    assert.equal(chromePoll.tabs[client.tabId].free, false, 'after require tab should be busy');
    await chromePoll.release(client.tabId);
    assert.equal(chromePoll.tabs[client.tabId].free, true, 'after release tab should be free');
    return await chromePoll.destroyPoll();
  });

  it('set port then get port', async () => {
    const chromePoll = await ChromePool.new({
      port: 5657
    });
    assert.equal(chromePoll.port, 5657);
    return await chromePoll.destroyPoll();
  });

});
