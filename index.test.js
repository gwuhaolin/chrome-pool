'use strict';
const ChromePool = require('./index');
const assert = require('assert');

describe('#ChromePool', function () {

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
    this.timeout(7000);
    const maxTab = 4;
    let chromePoll = await ChromePool.new({
      maxTab,
    });
    assert.equal(chromePoll.maxTab, maxTab);
    await chromePoll.require();
    await chromePoll.require();
    const { tabId: tabId1 } = await chromePoll.require();
    const { tabId: tabId2 } = await chromePoll.require();
    assert.equal(Object.keys(chromePoll.tabs).length, maxTab, `open tabs should be equal to ${maxTab}`);
    console.log(`${maxTab} tabs has created, next require will return util a tab has be released after 5s`);
    setTimeout(() => {
      chromePoll.release(tabId1);
      chromePoll.release(tabId2);
    }, 5000);
    await chromePoll.require();
    await chromePoll.require();
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

});
