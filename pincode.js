// Indian delivery addresses: the list of states, and a PIN code checker.
//
// A PIN code is checked in two ways:
//  1. Offline — the first two digits of every PIN belong to a known postal region, so we can
//     always tell whether a PIN can exist and whether it matches the chosen state.
//  2. Live — India Post's public directory tells us whether that exact PIN is real, and gives
//     its district, state and post offices. If the directory cannot be reached we fall back to
//     the offline check, so a slow directory never blocks an order.

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// first two digits of the PIN → states it can belong to
const REGIONS = {};
const region = (from, to, ...states) => { for (let n = from; n <= to; n++) REGIONS[n] = [...(REGIONS[n] || []), ...states]; };
region(11, 11, 'Delhi');
region(12, 13, 'Haryana');
region(14, 16, 'Punjab'); region(16, 16, 'Chandigarh');
region(17, 17, 'Himachal Pradesh');
region(18, 19, 'Jammu and Kashmir', 'Ladakh');
region(20, 28, 'Uttar Pradesh'); region(24, 24, 'Uttarakhand'); region(26, 26, 'Uttarakhand');
region(30, 34, 'Rajasthan');
region(36, 39, 'Gujarat', 'Dadra and Nagar Haveli and Daman and Diu');
region(40, 44, 'Maharashtra'); region(40, 40, 'Goa');
region(45, 48, 'Madhya Pradesh');
region(49, 49, 'Chhattisgarh');
region(50, 50, 'Telangana');
region(51, 53, 'Andhra Pradesh'); region(53, 53, 'Puducherry');
region(56, 59, 'Karnataka');
region(60, 64, 'Tamil Nadu'); region(60, 60, 'Puducherry');
region(67, 69, 'Kerala'); region(67, 67, 'Puducherry'); region(68, 68, 'Lakshadweep');
region(70, 74, 'West Bengal'); region(73, 73, 'Sikkim'); region(74, 74, 'Andaman and Nicobar Islands');
region(75, 77, 'Odisha');
region(78, 78, 'Assam');
region(79, 79, 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura');
region(80, 85, 'Bihar'); region(81, 83, 'Jharkhand');

const statesForPin = pin => REGIONS[String(pin).slice(0, 2)] || [];

// the directory spells a few names differently ("Pondicherry", "Orissa", "… & …")
const key = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/^the\s+/, '').replace(/[^a-z]/g, '');
const ALIASES = { pondicherry: 'Puducherry', orissa: 'Odisha', uttaranchal: 'Uttarakhand', nctofdelhi: 'Delhi', newdelhi: 'Delhi', chattisgarh: 'Chhattisgarh', telengana: 'Telangana', damananddiu: 'Dadra and Nagar Haveli and Daman and Diu', dadraandnagarhaveli: 'Dadra and Nagar Haveli and Daman and Diu' };
const BY_KEY = Object.fromEntries(STATES.map(s => [key(s), s]));
const stateName = s => BY_KEY[key(s)] || ALIASES[key(s)] || '';

const cache = new Map(); // pin → result, kept while the server is running
const HOUR = 3600e3;

// → { valid, verified, pin, state, states, district, areas, error }
//   valid:    the PIN can be delivered to
//   verified: India Post's directory confirmed this exact PIN (false = offline check only)
async function lookup(pin, timeoutMs = 6000) {
  pin = String(pin || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) return { valid: false, pin, error: 'Please enter a valid 6-digit PIN code.' };
  const states = statesForPin(pin);
  if (!states.length) return { valid: false, pin, error: 'This PIN code does not exist. Please check it.' };

  const hit = cache.get(pin);
  if (hit && hit.until > Date.now()) return hit.value;
  const offline = { valid: true, verified: false, pin, states, state: states.length === 1 ? states[0] : '', district: '', areas: [] };
  try {
    const r = await fetch('https://api.postalpincode.in/pincode/' + pin, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new Error('directory answered ' + r.status);
    const first = (await r.json())[0] || {};
    const offices = Array.isArray(first.PostOffice) ? first.PostOffice : [];
    let value;
    if (offices.length) {
      const state = stateName(offices[0].State);
      value = {
        valid: true, verified: true, pin, state, states: state ? [state] : states,
        district: String(offices[0].District || '').slice(0, 60),
        areas: [...new Set(offices.map(o => String(o.Name || '').replace(/\s+[SBHG]\.?O\.?$/i, '').trim()).filter(Boolean))].slice(0, 40)
      };
    } else if (/no records/i.test(first.Message || '')) {
      value = { valid: false, verified: true, pin, error: 'We could not find this PIN code. Please check it.' };
    } else throw new Error('unexpected directory reply');
    cache.set(pin, { value, until: Date.now() + 24 * HOUR });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return value;
  } catch (e) {
    return offline; // directory slow or down — the offline check still applies
  }
}

module.exports = { STATES, lookup, statesForPin };
