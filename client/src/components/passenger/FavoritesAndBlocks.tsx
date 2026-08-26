import React, { useState, useEffect } from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { Heart, ShieldBan, Trash2, UserCheck, Star, Car } from 'lucide-react';

interface FavoritesAndBlocksProps {
  currentUser: User;
  language: LanguageCode;
}

export const FavoritesAndBlocks: React.FC<FavoritesAndBlocksProps> = ({ currentUser, language }) => {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const favRes = await api.getFavoriteDrivers(currentUser.id);
      setFavorites(favRes.favorites || []);

      const blkRes = await api.getBlocks(currentUser.id);
      setBlocks(blkRes.blocks || []);
    } catch (err) {
      console.error('Error loading favorites/blocks:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const handleRemoveFavorite = async (driverId: string) => {
    try {
      await api.removeFavoriteDriver(driverId, currentUser.id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    try {
      await api.unblockUser(targetUserId, currentUser.id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      
      {/* Favorites Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center space-x-2.5">
          <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Your Favorite Drivers</h3>
            <p className="text-xs text-slate-500">Send direct ride requests to these trusted captains when booking.</p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <p className="text-xs text-slate-400">No favorite drivers saved yet. Complete a trip and tap "Add to Favorites"!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favorites.map(fav => (
              <div
                key={fav.favorite_id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3 truncate">
                  <img
                    src={fav.driver_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-brand-500"
                  />
                  <div className="truncate">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{fav.driver_name}</h4>
                    <p className="text-slate-500 font-medium">★ {fav.rating_avg} • {fav.vehicle_brand} {fav.vehicle_model}</p>
                    <span className="text-[10px] font-mono text-brand-600 font-bold">{fav.vehicle_plate}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveFavorite(fav.driver_id)}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two-Way Blocked Users Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center space-x-2.5">
          <ShieldBan className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Two-Way Block List</h3>
            <p className="text-xs text-slate-500">You will never be intentionally matched with these users.</p>
          </div>
        </div>

        {blocks.length === 0 ? (
          <p className="text-xs text-slate-400">No blocked users.</p>
        ) : (
          <div className="space-y-2">
            {blocks.map(b => (
              <div
                key={b.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{b.blocked_user_name || 'User'}</p>
                  <p className="text-[11px] text-slate-400">Reason: {b.reason}</p>
                </div>

                <button
                  onClick={() => handleUnblock(b.blocked_user_id)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
