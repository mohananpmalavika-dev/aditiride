import React, { useState } from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import {
  Truck,
  Users,
  DollarSign,
  CheckCircle,
  Activity,
  Shield,
  FileText,
  Plus
} from 'lucide-react';

interface FleetPortalProps {
  currentUser: User;
  language: LanguageCode;
}

export const FleetPortal: React.FC<FleetPortalProps> = ({ currentUser, language }) => {
  const [fleetDrivers] = useState([
    { id: '1', name: 'Rahul Nair', vehicle: 'Honda City (KL-08-BW-7777)', category: 'Prime Sedan', status: 'ONLINE', tripsToday: 6, earnings: '₹1,850' },
    { id: '2', name: 'Arun Kumar', vehicle: 'Bajaj RE Auto (KL-08-CC-2345)', category: 'Auto Rickshaw', status: 'ONLINE', tripsToday: 9, earnings: '₹1,420' },
    { id: '3', name: 'Priya K.', vehicle: 'Tata Tiago EV (KL-08-EV-9090)', category: 'Economy EV', status: 'ONLINE', tripsToday: 4, earnings: '₹980' },
    { id: '4', name: 'Suresh Babu', vehicle: 'Hero Splendor (KL-08-AZ-4512)', category: 'Bike Taxi', status: 'OFFLINE', tripsToday: 11, earnings: '₹1,100' }
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 text-white flex items-center justify-center shadow-lg">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Kerala Star Mobility Fleet Portal</h2>
            <p className="text-xs text-slate-500 font-medium">Enterprise Operator ID: FLT-KL-8902 • 14 Registered Vehicles</p>
          </div>
        </div>

        <button className="flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-xs shadow-md">
          <Plus className="w-4 h-4" />
          <span>Add New Vehicle / Driver</span>
        </button>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Fleet Revenue</p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">₹1,48,200</p>
          <p className="text-[10px] text-slate-400 mt-0.5">This Month</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Online Units</p>
          <p className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">3 / 4 Online</p>
          <p className="text-[10px] text-slate-400 mt-0.5">75% Utilization rate</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Trips</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">482</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Avg rating: ⭐ 4.91</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compliance Status</p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">100% Valid</p>
          <p className="text-[10px] text-slate-400 mt-0.5">All RC & Insurance Active</p>
        </div>
      </div>

      {/* Fleet Roster Table & Telematics Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Roster Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Assigned Captains & Fleet Units</h3>
          
          <div className="space-y-3">
            {fleetDrivers.map(d => (
              <div key={d.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">{d.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      d.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                  <p className="text-slate-500">{d.vehicle} • <span className="font-semibold text-brand-600">{d.category}</span></p>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm">{d.earnings}</p>
                  <p className="text-[10px] text-slate-400">{d.tripsToday} trips today</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Telematics Map */}
        <div className="lg:col-span-5 min-h-[380px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
          <OpenStreetMap
            center={{ lat: 10.5276, lng: 76.2144 }}
            className="w-full h-full"
          />
        </div>

      </div>

    </div>
  );
};
