import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../db/index.js';
import { VoiceEngine } from '../services/VoiceEngine.js';

describe('Multi-Lingual VoiceEngine NLP Tests', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('parses Malayalam voice utterance for auto booking to Lulu Mall', () => {
    const parsed = VoiceEngine.parseUtterance('എനിക്ക് ലുലു മാളിലേക്ക് ഒരു ഓട്ടോ വേണം');
    expect(parsed.intent).toBe('BOOK_RIDE');
    expect(parsed.language).toBe('ml');
    expect(parsed.entities.vehicleCategoryCode).toBe('AUTO');
    expect(parsed.entities.destination).toContain('Lulu');
    expect(parsed.preview?.estimatedFare).toBeGreaterThan(0);
    expect(parsed.preview?.spokenPrompt).toContain('Lulu');
    expect(parsed.preview?.spokenPrompt).toContain('ബുക്ക് ചെയ്യാൻ');
  });

  it('parses English voice utterance for scheduled SUV to Airport', () => {
    const parsed = VoiceEngine.parseUtterance('Schedule an SUV tomorrow at 6 AM to the airport');
    expect(parsed.intent).toBe('SCHEDULE_RIDE');
    expect(parsed.entities.isScheduled).toBe(true);
    expect(parsed.entities.vehicleCategoryCode).toBe('SUV');
    expect(parsed.entities.destination).toContain('Airport');
    expect(parsed.preview?.spokenPrompt).toContain('Airport');
  });

  it('parses Malayalam driver tracking request', () => {
    const parsed = VoiceEngine.parseUtterance('എന്റെ ഡ്രൈവർ എവിടെ എത്തി?');
    expect(parsed.intent).toBe('TRACK_RIDE');
    expect(parsed.language).toBe('ml');
    expect(parsed.preview?.actionRequired).toBe('DISPLAY_TRACKING');
  });

  it('parses Hindi auto request', () => {
    const parsed = VoiceEngine.parseUtterance('मुझे एयरपोर्ट के लिए एक ऑटो चाहिए');
    expect(parsed.intent).toBe('BOOK_RIDE');
    expect(parsed.language).toBe('hi');
    expect(parsed.entities.vehicleCategoryCode).toBe('AUTO');
  });

  it('parses ride cancellation intent', () => {
    const parsed = VoiceEngine.parseUtterance('Cancel my ride');
    expect(parsed.intent).toBe('CANCEL_RIDE');
    expect(parsed.preview?.actionRequired).toBe('CANCEL_CONFIRMED');
  });
});
