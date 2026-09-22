test('an answer that is not the contract is never priced as one', async () => {
  // His screenshot, 19 Sep 2026: typed MGC, got "Vanguard Morningstar Mega Cap
  // E" at 281.72, and the card printed gold's published size underneath a share
  // price. The feed refuses that answer now; if one ever reaches the page, the
  // page says what came back rather than pricing it as the contract.
  const p = await loadPage({
    feed: candleSet({ symbol: 'MGC', name: 'Vanguard Morningstar Mega Cap E', type: 'ETF', exchange: 'NYSEArca' }),
  });
  const card = p.els.get('fOut').innerHTML;
  assert.match(card, /one point is <b>\$10\.00<\/b>/, 'the contract size is still stated');
  assert.match(card, /What came back is ETF \(Vanguard Morningstar Mega Cap E\)/, 'named as what it is');
  assert.match(card, /not the MGC contract/, 'and named as not the contract');
  assert.match(card, /the prices above are not its market either/, 'so no gold price is implied by them');

  const told = p.sandbox.feedText();
  assert.match(told, /The feed says this instrument is ETF on NYSEArca/);
  assert.match(told, /do not read these bars as MGC/);
  assert.match(p.sandbox.askSystem(), /do not price a level off them/);
  assert.match(p.els.get('fWhen').textContent, /not a contract/, 'and the load line says so too');

  // A contract is left completely alone by all of it.
  const q = await loadPage({ feed: candleSet({ symbol: 'MNQ=F', type: 'FUTURE', exchange: 'CME' }) });
  assert.doesNotMatch(q.els.get('fOut').innerHTML, /What came back is/);
  assert.match(q.els.get('fWhen').textContent, /MNQ=F loaded\./);
  assert.match(q.sandbox.feedText(), /The feed says this instrument is FUTURE on CME/);

  // And a code he reads as an index on purpose is not accused of anything: the
  // feed only has the VIX index, so asking for it is the whole point.
  const v = await loadPage({
    feed: candleSet({ symbol: 'VIX', name: 'CBOE Volatility Index', type: 'INDEX', exchange: 'Cboe Indices' }),
  });
  assert.doesNotMatch(v.els.get('fOut').innerHTML, /What came back is/);
  assert.match(v.els.get('fOut').innerHTML, /No published contract size for VIX/);
  assert.doesNotMatch(v.els.get('fWhen').textContent, /not a contract/);
  assert.doesNotMatch(v.sandbox.feedText(), /do not read these bars as VIX/);
});

