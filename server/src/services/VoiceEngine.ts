import { FareEngine } from './FareEngine.js';
import { LocationService, GeocodedLocation } from './LocationService.js';
import { query, get } from '../db/index.js';
import { VehicleCategory, LanguageCode } from '../types/index.js';

export interface ParsedVoiceIntent {
  intent: 'BOOK_RIDE' | 'SCHEDULE_RIDE' | 'TRACK_RIDE' | 'CANCEL_RIDE' | 'VIEW_FARE' | 'SELECT_VEHICLE' | 'UNKNOWN';
  language: LanguageCode;
  confidence: number;
  rawText: string;
  entities: {
    destination?: string;
    destinationLocation?: GeocodedLocation;
    pickup?: string;
    pickupLocation?: GeocodedLocation;
    vehicleCategoryCode?: string;
    vehicleCategoryId?: string;
    vehicleCategoryName?: string;
    scheduledAt?: string;
    isScheduled?: boolean;
    paymentMethod?: 'UPI' | 'CASH' | 'CARD' | 'WALLET';
    driverPreference?: 'ANY' | 'FAVORITE' | 'SPECIFIC';
    specificDriverName?: string;
    stopAddress?: string;
    wheelchairNeeded?: boolean;
  };
  preview?: {
    estimatedFare: number;
    distanceKm: number;
    durationMin: number;
    spokenPrompt: string;
    actionRequired: 'CONFIRM_TO_BOOK' | 'ASK_DESTINATION' | 'ASK_VEHICLE' | 'DISPLAY_TRACKING' | 'CANCEL_CONFIRMED';
  };
}

export class VoiceEngine {
  /**
   * Parse natural speech text across 6 Indian regional languages + English
   */
  public static parseUtterance(text: string, currentLat: number = 10.5276, currentLng: number = 76.2144, preferredLang: LanguageCode = 'en'): ParsedVoiceIntent {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // Detect language or fallback
    let detectedLang: LanguageCode = preferredLang;
    if (/[\u0D00-\u0D7F]/.test(raw)) detectedLang = 'ml'; // Malayalam unicode
    else if (/[\u0900-\u097F]/.test(raw)) detectedLang = 'hi'; // Hindi unicode
    else if (/[\u0B80-\u0BFF]/.test(raw)) detectedLang = 'ta'; // Tamil unicode
    else if (/[\u0C80-\u0CFF]/.test(raw)) detectedLang = 'kn'; // Kannada unicode
    else if (/[\u0C00-\u0C7F]/.test(raw)) detectedLang = 'te'; // Telugu unicode

    const entities: ParsedVoiceIntent['entities'] = {};
    let intent: ParsedVoiceIntent['intent'] = 'BOOK_RIDE';

    // 1. Check for cancel / tracking intents
    if (
      lower.includes('cancel') ||
      raw.includes('റദ്ദാക്കുക') ||
      raw.includes('വേണ്ട') ||
      raw.includes('रद्द') ||
      raw.includes('ரத்து')
    ) {
      intent = 'CANCEL_RIDE';
      return {
        intent,
        language: detectedLang,
        confidence: 0.95,
        rawText: raw,
        entities: {},
        preview: {
          estimatedFare: 0,
          distanceKm: 0,
          durationMin: 0,
          spokenPrompt: detectedLang === 'ml' ? 'നിങ്ങളുടെ റൈഡ് റദ്ദാക്കണോ?' : 'Do you want to cancel your current ride?',
          actionRequired: 'CANCEL_CONFIRMED'
        }
      };
    }

    if (
      lower.includes('where is my driver') ||
      lower.includes('track') ||
      raw.includes('ഡ്രൈവർ എവിടെ') ||
      raw.includes('ഡ്രൈവർ എവിടെ എത്തി') ||
      raw.includes('ड्राइवर कहाँ है') ||
      raw.includes('டிரைவர் எங்கே')
    ) {
      intent = 'TRACK_RIDE';
      return {
        intent,
        language: detectedLang,
        confidence: 0.95,
        rawText: raw,
        entities: {},
        preview: {
          estimatedFare: 0,
          distanceKm: 0,
          durationMin: 0,
          spokenPrompt: detectedLang === 'ml' ? 'ഡ്രൈവർ ലൈവ് ലൊക്കേഷൻ കാണിക്കുന്നു' : 'Tracking your assigned driver live on the map.',
          actionRequired: 'DISPLAY_TRACKING'
        }
      };
    }

    // 2. Extract Vehicle Category
    if (lower.includes('auto') || lower.includes('rickshaw') || raw.includes('ഓട്ടോ') || raw.includes('ऑटो') || raw.includes('ஆட்டோ')) {
      entities.vehicleCategoryCode = 'AUTO';
      entities.vehicleCategoryId = 'cat_auto';
      entities.vehicleCategoryName = 'Aditi Auto';
    } else if (lower.includes('bike') || lower.includes('scooter') || raw.includes('ബൈക്ക്') || raw.includes('बाइक') || raw.includes('பைக்')) {
      entities.vehicleCategoryCode = 'BIKE';
      entities.vehicleCategoryId = 'cat_bike';
      entities.vehicleCategoryName = 'Aditi Bike Taxi';
    } else if (lower.includes('sedan') || lower.includes('prime') || raw.includes('സെഡാൻ') || raw.includes('सेडान') || raw.includes('செடான்')) {
      entities.vehicleCategoryCode = 'SEDAN';
      entities.vehicleCategoryId = 'cat_sedan';
      entities.vehicleCategoryName = 'Aditi Prime Sedan';
    } else if (lower.includes('suv') || lower.includes('xl') || lower.includes('6 seater') || raw.includes('എസ്.യു.വി') || raw.includes('എക്സ്.എൽ')) {
      entities.vehicleCategoryCode = 'SUV';
      entities.vehicleCategoryId = 'cat_suv';
      entities.vehicleCategoryName = 'Aditi XL (6 Seater)';
    } else if (lower.includes('outstation') || raw.includes('ഔട്ട്സ്റ്റേഷൻ') || raw.includes('ഇന്റർസിറ്റി')) {
      entities.vehicleCategoryCode = 'OUTSTATION';
      entities.vehicleCategoryId = 'cat_outstation';
      entities.vehicleCategoryName = 'Aditi Outstation';
    } else if (lower.includes('rental') || lower.includes('package') || raw.includes('റെന്റൽ')) {
      entities.vehicleCategoryCode = 'RENTAL';
      entities.vehicleCategoryId = 'cat_rental';
      entities.vehicleCategoryName = 'Aditi Rentals';
    } else {
      // Default to Auto or Sedan based on context
      entities.vehicleCategoryCode = 'AUTO';
      entities.vehicleCategoryId = 'cat_auto';
      entities.vehicleCategoryName = 'Aditi Auto';
    }

    // 3. Extract Schedule Date/Time
    const isScheduleUtterance =
      lower.includes('tomorrow') ||
      lower.includes('schedule') ||
      lower.includes('later') ||
      raw.includes('നാളെ') ||
      raw.includes('പിന്നെ') ||
      raw.includes('कल') ||
      raw.includes('நாளை');

    if (isScheduleUtterance) {
      intent = 'SCHEDULE_RIDE';
      entities.isScheduled = true;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check time extraction (e.g. 7 AM, 6:30 PM, 7 മണിക്ക്)
      let hour = 8;
      let minute = 0;
      const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridian = timeMatch[3];
        if (meridian === 'pm' && h < 12) h += 12;
        if (meridian === 'am' && h === 12) h = 0;
        hour = h;
        minute = m;
      }
      tomorrow.setHours(hour, minute, 0, 0);
      entities.scheduledAt = tomorrow.toISOString();
    }

    // 4. Extract Destination
    let destQuery = '';
    if (lower.includes('lulu') || raw.includes('ലുലു')) {
      destQuery = 'Lulu International Shopping Mall Thrissur';
    } else if (lower.includes('airport') || raw.includes('എയർപോർട്ട്') || raw.includes('വിമാനത്താവളം') || raw.includes('एयरपोर्ट')) {
      destQuery = 'Cochin International Airport (COK)';
    } else if (lower.includes('railway') || lower.includes('station') || raw.includes('റെയിൽവേ') || raw.includes('സ്റ്റേഷൻ')) {
      destQuery = 'Thrissur Central Railway Station';
    } else if (lower.includes('technopark') || raw.includes('ടെക്നോപാർക്ക്')) {
      destQuery = 'Technopark Campus Phase 1 & 3';
    } else if (lower.includes('infopark') || raw.includes('ഇൻഫോപാർക്ക്')) {
      destQuery = 'Infopark Phase 1 & 2';
    } else if (lower.includes('home') || raw.includes('വീട്') || raw.includes('വീട്ടിലേക്ക്') || raw.includes('घर')) {
      destQuery = 'Home (Sobha City / Ayyanthole)';
    } else if (lower.includes('office') || lower.includes('work') || raw.includes('ഓഫീസ്') || raw.includes('ഓഫീസിലേക്ക്') || raw.includes('काम')) {
      destQuery = 'Work (Tech Hub Ayyanthole)';
    } else if (lower.includes('marine drive') || raw.includes('മറൈൻ ഡ്രൈവ്')) {
      destQuery = 'Marine Drive Promenade';
    } else if (lower.includes('hospital') || raw.includes('ആശുപത്രി') || raw.includes('അമൃത')) {
      destQuery = 'Amrita Hospital & Institute of Medical Sciences';
    } else {
      // Clean query from common keywords
      const cleaned = lower
        .replace(/book|an|a|to|the|at|take|me|from|need|schedule|please|ride|cab|taxi/gi, '')
        .replace(/ഓട്ടോ|വേണം|പോകണം|ബുക്ക്|ചെയ്യുക|എനിക്ക്|നാളെ|രാവിലെ/g, '')
        .trim();
      destQuery = cleaned.length > 2 ? cleaned : 'Lulu International Shopping Mall Thrissur';
    }

    const matchedLocations = LocationService.searchLocations(destQuery);
    const destinationLocation = matchedLocations[0] || {
      id: 'loc_dyn_voice',
      name: destQuery,
      address: destQuery + ', Thrissur, Kerala',
      lat: 10.5360,
      lng: 76.2220,
      type: 'LANDMARK' as const
    };

    entities.destination = destinationLocation.name;
    entities.destinationLocation = destinationLocation;

    // Default Pickup to Current Location
    const pickupAddress = LocationService.reverseGeocode(currentLat, currentLng);
    entities.pickup = pickupAddress;
    entities.pickupLocation = {
      id: 'loc_pickup_curr',
      name: 'Current Location',
      address: pickupAddress,
      lat: currentLat,
      lng: currentLng,
      type: 'LANDMARK'
    };

    // 5. Extract Favorite Driver Intent
    if (lower.includes('favorite') || lower.includes('rahul') || raw.includes('പ്രിയപ്പെട്ട') || raw.includes('രാഹുൽ')) {
      entities.driverPreference = 'FAVORITE';
      entities.specificDriverName = 'Rahul Nair';
    }

    // 6. Extract Payment Preference
    if (lower.includes('cash') || raw.includes('പണം') || raw.includes('ക്യാഷ്') || raw.includes('नकद')) {
      entities.paymentMethod = 'CASH';
    } else if (lower.includes('wallet') || raw.includes('വാലറ്റ്')) {
      entities.paymentMethod = 'WALLET';
    } else {
      entities.paymentMethod = 'UPI';
    }

    // 7. Calculate Fare Quote Preview
    const route = LocationService.calculateRoute(
      { lat: currentLat, lng: currentLng },
      { lat: destinationLocation.lat, lng: destinationLocation.lng }
    );

    const quote = FareEngine.calculateFare({
      vehicleCategoryId: entities.vehicleCategoryId || 'cat_auto',
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      pickupLat: currentLat,
      pickupLng: currentLng
    });

    // 8. Generate Multi-lingual Spoken Confirmation Text
    let spokenPrompt = '';
    if (detectedLang === 'ml') {
      const timeStr = entities.isScheduled ? 'നാളെ ' : '';
      spokenPrompt = `${timeStr}${destinationLocation.name}-ലേക്ക് ${entities.vehicleCategoryName}. ഏകദേശ നിരക്ക് ₹${quote.total_fare}. ബുക്ക് ചെയ്യാൻ "Confirm" എന്ന് പറയുക.`;
    } else if (detectedLang === 'hi') {
      spokenPrompt = `${destinationLocation.name} के लिए ${entities.vehicleCategoryName}। अनुमानित किराया ₹${quote.total_fare}। बुक करने के लिए "Confirm" कहें।`;
    } else if (detectedLang === 'ta') {
      spokenPrompt = `${destinationLocation.name}-க்கு ${entities.vehicleCategoryName}। உத்தேச கட்டணம் ₹${quote.total_fare}। உறுதிப்படுத்த "Confirm" சொல்லுங்கள்.`;
    } else {
      const schedulePrefix = entities.isScheduled ? 'Scheduled for tomorrow: ' : '';
      spokenPrompt = `${schedulePrefix}${entities.vehicleCategoryName} to ${destinationLocation.name}. Estimated fare is ₹${quote.total_fare} (approx. ${route.durationMin} mins, ${route.distanceKm} km). Say "Confirm" to book.`;
    }

    return {
      intent,
      language: detectedLang,
      confidence: 0.92,
      rawText: raw,
      entities,
      preview: {
        estimatedFare: quote.total_fare,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        spokenPrompt,
        actionRequired: 'CONFIRM_TO_BOOK'
      }
    };
  }
}
