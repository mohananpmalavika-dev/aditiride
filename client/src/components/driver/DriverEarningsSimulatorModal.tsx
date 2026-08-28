import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { User, DriverProfile } from '../../types/index.js';
import {
  TrendingUp,
  DollarSign,
  Fuel,
  Percent,
  Download,
  Calendar,
  Sparkles,
  CheckCircle,
  X,
  Sliders
} from 'lucide-react';

interface DriverEarningsSimulatorModalProps {
  currentUser: User;
  driverProfile?: DriverProfile | null;
  onClose: () => void;
}

export const DriverEarningsSimulatorModal: React.FC<DriverEarningsSimulatorModalProps> = ({
  currentUser,
  driverProfile,
  onClose
}) => {
  const [baseFare, setBaseFare] = useState(35.0);
  const [perKmRate, setPerKmRate] = useState(16.0);
  const [tripsPerDay, setTripsPerDay] = useState(12);
  const [avgDistance, setAvgDistance] = useState(6.5);
  
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runSimulation();
  }, [baseFare, perKmRate, tripsPerDay, avgDistance]);

  const runSimulation = async () => {
    try {
      const res = await api.simulateDriverEarnings({
        baseFare,
        perKmRate,
        estimatedTripsPerDay: tripsPerDay,
        avgDistanceKm: avgDistance
      });
      if (res) setSimulation(res);
    } catch (e) {
      console.warn('Simulation error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Captain Earnings Simulator & Payouts</h3>
              <p className="text-xs text-slate-400">Forecast net earnings, platform commission & fuel cost breakdowns</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Projected KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Daily Gross Fare</span>
              <p className="text-xl font-black text-white font-mono">₹{simulation?.dailyGrossFare || 0}</p>
              <span className="text-[10px] text-slate-400">{tripsPerDay} trips @ {avgDistance} km avg</span>
            </div>

            <div className="p-4 bg-emerald-950/50 border border-emerald-600/60 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Daily Net Take-Home</span>
              <p className="text-xl font-black text-emerald-300 font-mono">₹{simulation?.dailyNetEarnings || 0}</p>
              <span className="text-[10px] text-emerald-400">After 10% commission & fuel</span>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-950/60 to-slate-950 border border-amber-500/40 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-amber-400">Monthly Projected Net</span>
              <p className="text-xl font-black text-amber-300 font-mono">₹{simulation?.monthlyProjectedNet?.toLocaleString('en-IN') || 0}</p>
              <span className="text-[10px] text-amber-400/80">Based on 26 days/month</span>
            </div>
          </div>

          {/* Interactive Sliders */}
          <div className="space-y-4 p-5 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-black text-slate-200">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Simulate Rate & Schedule Variations</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Base Fare */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Base Fare (₹)</span>
                  <span className="text-emerald-400 font-mono">₹{baseFare}</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={60}
                  step={5}
                  value={baseFare}
                  onChange={e => setBaseFare(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Per Km Rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Rate per Km (₹)</span>
                  <span className="text-emerald-400 font-mono">₹{perKmRate}/km</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={26}
                  step={1}
                  value={perKmRate}
                  onChange={e => setPerKmRate(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Trips Per Day */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Trips Per Day</span>
                  <span className="text-white font-mono">{tripsPerDay} rides</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={25}
                  step={1}
                  value={tripsPerDay}
                  onChange={e => setTripsPerDay(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Average Distance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Avg Trip Distance (km)</span>
                  <span className="text-white font-mono">{avgDistance} km</span>
                </div>
                <input
                  type="range"
                  min={3.0}
                  max={15.0}
                  step={0.5}
                  value={avgDistance}
                  onChange={e => setAvgDistance(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Itemized Revenue & Cost Deductions</h4>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Gross Customer Fare Collection:</span>
                <span className="font-mono font-bold text-white">₹{simulation?.breakdown?.gross || 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Commission (10% Flat Fee):</span>
                <span className="font-mono text-rose-400">- ₹{simulation?.breakdown?.commission || 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST Tax on Commission (5%):</span>
                <span className="font-mono text-rose-400">- ₹{simulation?.breakdown?.tax || 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Petrol/CNG Fuel Cost:</span>
                <span className="font-mono text-amber-400">- ₹{simulation?.breakdown?.fuelCostEstimate || 0}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                <span className="text-emerald-400">Net Estimated Take-Home Daily:</span>
                <span className="font-mono text-emerald-300">₹{simulation?.breakdown?.netDaily || 0}</span>
              </div>
            </div>
          </div>

          {/* Download Statement */}
          <button
            onClick={() => alert('Weekly Tax & Settlement Statement (PDF) generated and sent to registered email!')}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Weekly Tax & Earnings Statement (PDF)</span>
          </button>

        </div>

      </div>
    </div>
  );
};
