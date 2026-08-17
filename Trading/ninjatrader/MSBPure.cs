#region Using declarations
using System;
using System.ComponentModel.DataAnnotations;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
#endregion

// =============================================================================
//  MARKET STRUCTURE BRIDGE — PURE  (NinjaTrader 8 strategy)
//
//  Structure and nothing else. No VWAP, no RVOL, no ADX, no oscillators. The
//  only numbers this reads are swing highs and swing lows.
//
//  THE SEQUENCE, on the execution chart:
//    (1) price closes through a swing high      -> break of structure
//    (2) price trades back through that level   -> the retest begins
//    (3) price closes back above it             -> the reclaim
//    (4) it holds for N closed bars             -> the wait
//    (5) price closes past the reclaim bar      -> the fresh break = ENTRY
//
//  PERMISSION: the bias series (Daily by default) must be making higher highs
//  AND higher lows for a long. The bridge series (4H) must agree at the trigger.
//
//  DEATH: a close beyond the protected swing, the bias flipping, or the setup
//  running past its bar limit.
//
//  EXITS: half at 1R with the stop to break-even, the rest at the next opposing
//  swing on the bridge or bias series. If price is in open air with no swing
//  ahead of it, the target is the measured move of the leg that built the setup.
//
//  RUN IT IN SIM FIRST. Strategy Analyzer for history, then a Sim101 account for
//  live data. It places real orders on a real account the moment you enable it
//  on one - that is the entire point of a bot and the entire risk of one.
// =============================================================================

namespace NinjaTrader.NinjaScript.Strategies
{
    public class MSBPure : Strategy
    {
        // ── series indexes ───────────────────────────────────────────────────
        private const int Exec   = 0;   // the chart it is applied to
        private const int Bridge = 1;   // added in Configure
        private const int Bias   = 2;

        // ── structure state, one slot per series ─────────────────────────────
        private double[] hi1, hi2, lo1, lo2;
        private int[]    trend;

        // ── the setup ────────────────────────────────────────────────────────
        private int    st;          // 0 idle | 1 armed | 2 back through | 3 reclaimed
        private int    stDir;
        private double zone;        // the broken level - the setup pivots on this
        private double prot;        // protected swing; a close beyond it kills it
        private double trigLvl;     // reclaim bar's extreme; step 5 must close past
        private double pullExt;     // deepest point of the pullback = where the stop goes
        private double legHi, legLo;
        private int    heldBars, stBars;

        private double swHi, swLo;  // last confirmed swings on the execution chart

        // ── bookkeeping ──────────────────────────────────────────────────────
        private int      tradesToday;
        private DateTime lastDay = DateTime.MinValue;
        private bool     beMoved;
        private double   plannedStop, plannedT1, plannedT2;
        private int      qtyRest;    // the runner's size, fixed at entry

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Market Structure Bridge - pure structure. Break, back through, reclaim, hold, fresh break, with higher-timeframe permission.";
                Name        = "MSBPure";
                Calculate   = Calculate.OnBarClose;          // closed candles only. Wicks lie.
                EntriesPerDirection                     = 2; // two units so half can come off at 1R
                EntryHandling                           = EntryHandling.UniqueEntries;
                IsExitOnSessionCloseStrategy            = true;
                ExitOnSessionCloseSeconds               = 60;
                IsFillLimitOnTouch                      = false;
                MaximumBarsLookBack                     = MaximumBarsLookBack.TwoHundredFiftySix;
                OrderFillResolution                     = OrderFillResolution.Standard;
                Slippage                                = 1;
                StartBehavior                           = StartBehavior.WaitUntilFlat;
                TimeInForce                             = TimeInForce.Gtc;
                TraceOrders                             = false;
                RealtimeErrorHandling                   = RealtimeErrorHandling.StopCancelCloseIgnoreRejects;
                StopTargetHandling                      = StopTargetHandling.PerEntryExecution;
                BarsRequiredToTrade                     = 40;
                IsInstantiatedOnEachOptimizationIteration = false;

                SwingStrengthLeft  = 3;
                SwingStrengthRight = 3;
                BridgeMinutes      = 240;
                UseBias            = true;
                UseBridge          = true;
                HoldBars           = 1;
                SetupTimeout       = 40;
                RequireFreshBreak  = true;
                StopTicks          = 4;
                MinRoomR           = 1.0;
                UseMeasuredMove    = true;
                Contracts          = 2;
                MaxTradesPerDay    = 1;
                UseSession         = true;
                SessionStart       = 93000;
                SessionEnd         = 150000;
            }
            else if (State == State.Configure)
            {
                // Bridge and bias structure. Order matters: index 1 then index 2.
                AddDataSeries(BarsPeriodType.Minute, BridgeMinutes);
                AddDataSeries(BarsPeriodType.Day, 1);
            }
            else if (State == State.DataLoaded)
            {
                hi1 = new double[3]; hi2 = new double[3];
                lo1 = new double[3]; lo2 = new double[3];
                trend = new int[3];
                for (int i = 0; i < 3; i++)
                {
                    hi1[i] = hi2[i] = lo1[i] = lo2[i] = double.NaN;
                    trend[i] = 0;
                }
                ResetSetup();
                swHi = swLo = double.NaN;
            }
        }

        protected override void OnBarUpdate()
        {
            // Every series updates its own structure read.
            UpdateStructure(BarsInProgress);

            if (BarsInProgress != Exec)
                return;
            if (CurrentBars[Exec] < BarsRequiredToTrade)
                return;
            if (CurrentBars[Bridge] < 5 || CurrentBars[Bias] < 5)
                return;

            // one bullet a day
            DateTime d = Times[Exec][0].Date;
            if (d != lastDay)
            {
                lastDay     = d;
                tradesToday = 0;
            }

            // Half off at 1R -> the rest rides with the stop at break-even.
            // Two ways to know 1R happened: the T1 half actually filled (the
            // quantity dropped to the runner's size), or — trading a single
            // contract, where there is no half to come off — a close through
            // the T1 price. Comparing against Contracts / 2 here was the old
            // bug: with 3 contracts the runner is 2, 2 <= 1 is never true, and
            // the stop never moved.
            if (Position.MarketPosition != MarketPosition.Flat && !beMoved)
            {
                bool isLong    = Position.MarketPosition == MarketPosition.Long;
                bool t1Filled  = qtyRest > 0 && Position.Quantity <= qtyRest && Position.Quantity < Contracts;
                bool t1Crossed = Contracts == 1 &&
                    (isLong ? Closes[Exec][0] >= plannedT1 : Closes[Exec][0] <= plannedT1);
                if (t1Filled || t1Crossed)
                {
                    string runner = isLong ? "L2" : "S2";
                    SetStopLoss(runner, CalculationMode.Price, Position.AveragePrice, false);
                    beMoved = true;
                }
            }

            TrackSwings();
            AdvanceSequence();

            if (Position.MarketPosition != MarketPosition.Flat)
                return;
            if (tradesToday >= MaxTradesPerDay)
                return;
            if (UseSession && !InSession())
                return;

            bool biasLong   = !UseBias   || trend[Bias]   ==  1;
            bool biasShort  = !UseBias   || trend[Bias]   == -1;
            bool bridgeLong = !UseBridge || trend[Bridge] ==  1;
            bool bridgeShort= !UseBridge || trend[Bridge] == -1;

            bool heldOK = heldBars >= HoldBars;
            bool freshL = !RequireFreshBreak || (!double.IsNaN(trigLvl) && Closes[Exec][0] > trigLvl);
            bool freshS = !RequireFreshBreak || (!double.IsNaN(trigLvl) && Closes[Exec][0] < trigLvl);

            if (st == 3 && stDir == 1 && heldOK && freshL && bridgeLong && biasLong)
                TryEnter(true);
            else if (st == 3 && stDir == -1 && heldOK && freshS && bridgeShort && biasShort)
                TryEnter(false);
        }

        // ── the trade ────────────────────────────────────────────────────────
        private void TryEnter(bool isLong)
        {
            double entry = Closes[Exec][0];
            double buf   = StopTicks * TickSize;

            double stop = isLong
                ? Math.Min(pullExt, zone) - buf
                : Math.Max(pullExt, zone) + buf;

            double risk = Math.Abs(entry - stop);
            if (risk <= 0)
                return;

            // The wall: nearest opposing swing on the bridge or bias series.
            double wall = double.NaN;
            if (isLong)
            {
                wall = NearestAbove(wall, hi1[Bridge], entry);
                wall = NearestAbove(wall, hi1[Bias],   entry);
            }
            else
            {
                wall = NearestBelow(wall, lo1[Bridge], entry);
                wall = NearestBelow(wall, lo1[Bias],   entry);
            }

            // Open air: no swing ahead. Project the leg that built the setup.
            if (double.IsNaN(wall) && UseMeasuredMove)
            {
                double leg = legHi - legLo;
                if (leg > 0)
                    wall = isLong ? entry + leg : entry - leg;
            }
            if (double.IsNaN(wall))
                return;

            double roomR = Math.Abs(wall - entry) / risk;
            if (roomR < MinRoomR)
                return;

            // With one contract there is no half to take off — the whole unit
            // rides to T2 and the stop still goes to break-even at 1R. The old
            // Math.Max(1, ...) on both halves quietly turned Contracts = 1
            // into a 2-lot.
            int half = Contracts / 2;
            int rest = Contracts - half;
            qtyRest  = rest;

            plannedStop = stop;
            plannedT1   = isLong ? entry + risk : entry - risk;   // 1R
            plannedT2   = wall;
            beMoved     = false;

            string s1 = isLong ? "L1" : "S1";
            string s2 = isLong ? "L2" : "S2";

            if (half > 0)
            {
                SetStopLoss(s1, CalculationMode.Price, plannedStop, false);
                SetProfitTarget(s1, CalculationMode.Price, plannedT1);
            }
            SetStopLoss(s2, CalculationMode.Price, plannedStop, false);
            SetProfitTarget(s2, CalculationMode.Price, plannedT2);

            if (isLong)
            {
                if (half > 0) EnterLong(half, s1);
                EnterLong(rest, s2);
            }
            else
            {
                if (half > 0) EnterShort(half, s1);
                EnterShort(rest, s2);
            }

            tradesToday++;
            ResetSetup();       // one bullet per sequence; a new one must build from scratch

            Print(string.Format("{0}  {1}  entry {2}  stop {3}  T1 {4}  T2 {5}  room {6:F1}R",
                Times[Exec][0], isLong ? "LONG" : "SHORT", entry, plannedStop, plannedT1, plannedT2, roomR));
        }

        // ── the sequence ─────────────────────────────────────────────────────
        private void TrackSwings()
        {
            if (IsPivotHigh(Exec, SwingStrengthLeft, SwingStrengthRight))
                swHi = Highs[Exec][SwingStrengthRight];
            if (IsPivotLow(Exec, SwingStrengthLeft, SwingStrengthRight))
                swLo = Lows[Exec][SwingStrengthRight];
        }

        private void AdvanceSequence()
        {
            double c  = Closes[Exec][0];
            double c1 = Closes[Exec][1];
            double h  = Highs[Exec][0];
            double l  = Lows[Exec][0];

            bool bosUp = !double.IsNaN(swHi) && c > swHi && c1 <= swHi;
            bool bosDn = !double.IsNaN(swLo) && c < swLo && c1 >= swLo;

            bool armedNow = false;

            if (st == 0)
            {
                bool biasLong  = !UseBias || trend[Bias] ==  1;
                bool biasShort = !UseBias || trend[Bias] == -1;

                if (bosUp && biasLong)
                {
                    st = 1; stDir = 1;
                    zone = swHi;
                    prot = double.IsNaN(swLo) ? l : swLo;
                    legLo = prot; legHi = h;
                    pullExt = l; trigLvl = double.NaN;
                    heldBars = 0; stBars = 0; armedNow = true;
                }
                else if (bosDn && biasShort)
                {
                    st = 1; stDir = -1;
                    zone = swLo;
                    prot = double.IsNaN(swHi) ? h : swHi;
                    legHi = prot; legLo = l;
                    pullExt = h; trigLvl = double.NaN;
                    heldBars = 0; stBars = 0; armedNow = true;
                }
            }
            else
                stBars++;

            if (st > 0 && !armedNow)
            {
                if (stDir == 1)
                {
                    pullExt = Math.Min(pullExt, l);
                    legHi   = Math.Max(legHi, h);

                    if (st == 1 && l < zone)
                        st = 2;
                    else if (st == 2 && c > zone)
                    {
                        st = 3; trigLvl = h; heldBars = 0;
                    }
                    else if (st == 3)
                    {
                        if (c < zone) { st = 2; heldBars = 0; }
                        else heldBars++;
                    }
                }
                else
                {
                    pullExt = Math.Max(pullExt, h);
                    legLo   = Math.Min(legLo, l);

                    if (st == 1 && h > zone)
                        st = 2;
                    else if (st == 2 && c < zone)
                    {
                        st = 3; trigLvl = l; heldBars = 0;
                    }
                    else if (st == 3)
                    {
                        if (c > zone) { st = 2; heldBars = 0; }
                        else heldBars++;
                    }
                }
            }

            bool dead =
                st > 0 &&
                ((stDir ==  1 && ((!double.IsNaN(prot) && c < prot) || (UseBias && trend[Bias] == -1))) ||
                 (stDir == -1 && ((!double.IsNaN(prot) && c > prot) || (UseBias && trend[Bias] ==  1))) ||
                 stBars > SetupTimeout);

            if (dead)
                ResetSetup();
        }

        private void ResetSetup()
        {
            st = 0; stDir = 0;
            zone = prot = trigLvl = pullExt = legHi = legLo = double.NaN;
            heldBars = 0; stBars = 0;
        }

        // ── structure: higher highs AND higher lows, or the read stands ──────
        private void UpdateStructure(int bip)
        {
            if (CurrentBars[bip] < SwingStrengthLeft + SwingStrengthRight + 2)
                return;

            if (IsPivotHigh(bip, SwingStrengthLeft, SwingStrengthRight))
            {
                hi2[bip] = hi1[bip];
                hi1[bip] = Highs[bip][SwingStrengthRight];
            }
            if (IsPivotLow(bip, SwingStrengthLeft, SwingStrengthRight))
            {
                lo2[bip] = lo1[bip];
                lo1[bip] = Lows[bip][SwingStrengthRight];
            }

            if (double.IsNaN(hi1[bip]) || double.IsNaN(hi2[bip]) ||
                double.IsNaN(lo1[bip]) || double.IsNaN(lo2[bip]))
                return;

            if (hi1[bip] > hi2[bip] && lo1[bip] > lo2[bip])
                trend[bip] = 1;
            else if (hi1[bip] < hi2[bip] && lo1[bip] < lo2[bip])
                trend[bip] = -1;
            // otherwise the previous read stands. Structure does not flip on one bar.
        }

        private bool IsPivotHigh(int bip, int left, int right)
        {
            if (CurrentBars[bip] < left + right + 1)
                return false;

            double v = Highs[bip][right];
            for (int k = 1; k <= right; k++)
                if (Highs[bip][right - k] > v) return false;
            for (int k = 1; k <= left; k++)
                if (Highs[bip][right + k] >= v) return false;
            return true;
        }

        private bool IsPivotLow(int bip, int left, int right)
        {
            if (CurrentBars[bip] < left + right + 1)
                return false;

            double v = Lows[bip][right];
            for (int k = 1; k <= right; k++)
                if (Lows[bip][right - k] < v) return false;
            for (int k = 1; k <= left; k++)
                if (Lows[bip][right + k] <= v) return false;
            return true;
        }

        private double NearestAbove(double cur, double lvl, double px)
        {
            if (double.IsNaN(lvl) || lvl <= px) return cur;
            return double.IsNaN(cur) ? lvl : Math.Min(cur, lvl);
        }

        private double NearestBelow(double cur, double lvl, double px)
        {
            if (double.IsNaN(lvl) || lvl >= px) return cur;
            return double.IsNaN(cur) ? lvl : Math.Max(cur, lvl);
        }

        private bool InSession()
        {
            int t = ToTime(Times[Exec][0]);
            return t >= SessionStart && t <= SessionEnd;
        }

        #region Properties
        [NinjaScriptProperty, Range(1, 20)]
        [Display(Name = "Swing strength (left)", Order = 1, GroupName = "Structure")]
        public int SwingStrengthLeft { get; set; }

        [NinjaScriptProperty, Range(1, 20)]
        [Display(Name = "Swing strength (right)", Order = 2, GroupName = "Structure")]
        public int SwingStrengthRight { get; set; }

        [NinjaScriptProperty, Range(1, 1440)]
        [Display(Name = "Bridge minutes (240 = 4H)", Order = 3, GroupName = "Structure")]
        public int BridgeMinutes { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Daily bias must agree", Order = 4, GroupName = "Structure")]
        public bool UseBias { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Bridge must agree at the trigger", Order = 5, GroupName = "Structure")]
        public bool UseBridge { get; set; }

        [NinjaScriptProperty, Range(0, 10)]
        [Display(Name = "Bars the reclaim must hold", Order = 1, GroupName = "Sequence")]
        public int HoldBars { get; set; }

        [NinjaScriptProperty, Range(5, 500)]
        [Display(Name = "Setup expires after N bars", Order = 2, GroupName = "Sequence")]
        public int SetupTimeout { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Require the fresh break (step 5)", Order = 3, GroupName = "Sequence")]
        public bool RequireFreshBreak { get; set; }

        [NinjaScriptProperty, Range(0, 100)]
        [Display(Name = "Stop buffer (ticks past the swing)", Order = 1, GroupName = "Risk")]
        public int StopTicks { get; set; }

        [NinjaScriptProperty, Range(0.0, 20.0)]
        [Display(Name = "Reject if room below this (R)", Order = 2, GroupName = "Risk")]
        public double MinRoomR { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Open air: use the measured move", Order = 3, GroupName = "Risk")]
        public bool UseMeasuredMove { get; set; }

        [NinjaScriptProperty, Range(1, 100)]
        [Display(Name = "Contracts (even: half off at 1R · 1: all rides to T2, stop to BE at 1R)", Order = 4, GroupName = "Risk")]
        public int Contracts { get; set; }

        [NinjaScriptProperty, Range(1, 20)]
        [Display(Name = "Max trades per day", Order = 1, GroupName = "Your rules")]
        public int MaxTradesPerDay { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Session filter on", Order = 2, GroupName = "Your rules")]
        public bool UseSession { get; set; }

        [NinjaScriptProperty, Range(0, 235959)]
        [Display(Name = "Session start (HHMMSS, chart time)", Order = 3, GroupName = "Your rules")]
        public int SessionStart { get; set; }

        [NinjaScriptProperty, Range(0, 235959)]
        [Display(Name = "Session end (HHMMSS, chart time)", Order = 4, GroupName = "Your rules")]
        public int SessionEnd { get; set; }
        #endregion
    }
}
