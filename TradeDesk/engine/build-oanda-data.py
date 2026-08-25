#!/usr/bin/env python3
"""Rebuild NAS100/XAU 1H+15m bars from the FutureSharks/financial-data repo.

Clone first (read-only, public):
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/FutureSharks/financial-data /home/user/futuresharks/financial-data
  git -C /home/user/futuresharks/financial-data sparse-checkout set \
    pyfinancialdata/data/currencies/oanda/NAS100_USD pyfinancialdata/data/currencies/oanda/XAU_USD

Timestamps in the source are UTC (Friday's last bar is 21:59 = 16:59 ET).
Output: TradeDesk/data/{NAS100,XAU}-{1h,15m}.csv - not committed, ~40MB.
"""
import csv, os, glob
from datetime import datetime, timezone

BASE = "/home/user/futuresharks/financial-data/pyfinancialdata/data/currencies/oanda"
OUT = os.path.join(os.path.dirname(__file__), "..", "data")

def build(inst, out_prefix):
    files = []
    for ydir in sorted(glob.glob(f"{BASE}/{inst}/[0-9]*")):
        y = os.path.basename(ydir)
        for m in range(1, 13):
            p = f"{ydir}/oanda-{inst}-{y}-{m}.csv"
            if os.path.exists(p): files.append(p)
    bars = {900: {}, 3600: {}}
    for p in files:
        with open(p) as f:
            r = csv.reader(f); head = next(r)
            it, ic, ih, il, io = (head.index(k) for k in ('time','close','high','low','open'))
            for row in r:
                epoch = int(datetime.strptime(row[it], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp())
                o, h, l, c = float(row[io]), float(row[ih]), float(row[il]), float(row[ic])
                for size, store in bars.items():
                    k = epoch // size * size
                    b = store.get(k)
                    if b is None: store[k] = [o, h, l, c]
                    else:
                        if h > b[1]: b[1] = h
                        if l < b[2]: b[2] = l
                        b[3] = c
    for size, suffix in ((900, '15m'), (3600, '1h')):
        with open(f"{OUT}/{out_prefix}-{suffix}.csv", "w") as f:
            f.write("time,open,high,low,close,Volume\n")
            for k in sorted(bars[size]):
                o, h, l, c = bars[size][k]
                f.write(f"{k},{o},{h},{l},{c},0\n")
        print(out_prefix, suffix, len(bars[size]), "bars")

build("NAS100_USD", "NAS100")
build("XAU_USD", "XAU")
